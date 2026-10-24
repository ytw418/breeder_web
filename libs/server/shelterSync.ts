/**
 * 보호소 아이들 동기화(앱 docs/prd/shelter-animals.md F-1·F-2·E-1·E-2·E-4).
 * 국가동물보호정보시스템 구조동물 API(보호 중 강아지·고양이)를 받아 Product(dealType rehoming)로 넣고 고치고 숨긴다.
 * 3시간마다 GitHub Actions 가 /api/internal/cron/shelter-sync 를 불러 실행한다.
 *
 * - 받기가 하나라도 실패하면(E-1) 아무것도 바꾸지 않는다.
 * - 새 공고는 회차당 maxNew 건만 넣고 나머지는 다음 회차로 넘긴다(E-4). 사진은 animal.go.kr 주소를 그대로 쓴다.
 * - 숨김은 '연속 두 번 성공한 회차에서 목록에 없을 때'다(F-2). 첫 번째로 빠진 회차에는 tags 에 SHELTER_MISSED_TAG 를 붙이고,
 *   다시 나타나면 떼고, 두 번째에도 없으면 isHidden=true 로 한다. updatedAt 으로 '마지막으로 본 때'를 재지 않는 까닭:
 *   조회수(POST /api/products/:id/view)가 product.update 라 보는 사람이 있으면 updatedAt 이 계속 갱신된다.
 *   받은 목록이 덜 왔거나(페이지 모자람) 총수가 지난 회차보다 30% 넘게 줄었으면(E-2) 숨김·표시를 모두 건너뛴다.
 * - 한 번 숨긴 글은 다시 나타나도 되살리지 않는다(운영 제재로 숨긴 글과 구분할 수 없어서).
 * - DB 와 fetch 는 주입받는다(테스트는 모의로).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { parsePetInfo, type PetInfo } from "@libs/shared/petSpace";
import {
  SHELTER_SOURCE,
  toShelterProduct,
  type ShelterApiItem,
  type ShelterProduct,
  type ShelterSpecies,
} from "@libs/shared/shelterAnimal";

export type ShelterDb = Pick<PrismaClient, "product">;

const API_URL = "https://apis.data.go.kr/1543061/abandonmentPublicService_v2/abandonmentPublic_v2";
const UPKIND: Record<ShelterSpecies, string> = { 강아지: "417000", 고양이: "422400" };
const SPECIES: ShelterSpecies[] = ["강아지", "고양이"];
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;
const REQUEST_TIMEOUT_MS = 20000;
const CHUNK = 1000;

export const SHELTER_MISSED_TAG = "shelter-missed";
export const SHELTER_MAX_NEW_PER_RUN = 150;
export const SHELTER_TIME_BUDGET_MS = 50000;
/** 받은 총수가 지금 보이는 보호소 글 수의 이 비율보다 적으면 숨김을 건너뛴다(E-2). */
export const SHELTER_HIDE_GUARD_RATIO = 0.7;

export interface ShelterSyncOptions {
  db: ShelterDb;
  fetchImpl?: typeof fetch;
  /** 기본 process.env.DATA_GO_KR_KEY */
  apiKey?: string;
  /** 보호소 계정 id. 기본 process.env.SHELTER_USER_ID */
  userId?: number;
  maxNew?: number;
  timeBudgetMs?: number;
  /** 종 이름 → Product.categoryId (카테고리 고정 범위 조회용). 없으면 null 로 둔다. */
  resolveCategoryId?: (name: string) => Promise<number | null>;
}

export interface ShelterSyncResult {
  ok: boolean;
  error?: string;
  /** 받은 공고 수(강아지+고양이, 중복 제외). */
  fetched: number;
  created: number;
  updated: number;
  adopted: number;
  hidden: number;
  /** 이번에 처음 목록에서 빠져 '한 번 놓침' 표시를 붙인 글. */
  marked: number;
  /** 다시 나타나 표시를 뗀 글. */
  recovered: number;
  skippedHideReason?: "incomplete-fetch" | "api-total-dropped";
  skippedNoPhoto: number;
  failed: number;
  /** 시간·회차 한도로 이번에 못 넣은 새 공고 수. */
  remaining: number;
  /** 시간 한도로 못 고친 기존 글 수. */
  pendingUpdates: number;
}

const emptyResult = (): ShelterSyncResult => ({
  ok: true,
  fetched: 0,
  created: 0,
  updated: 0,
  adopted: 0,
  hidden: 0,
  marked: 0,
  recovered: 0,
  skippedNoPhoto: 0,
  failed: 0,
  remaining: 0,
  pendingUpdates: 0,
});

// ── 받기 ────────────────────────────────────────────────────────

interface FetchedItem {
  item: ShelterApiItem;
  species: ShelterSpecies;
}

async function fetchPage(
  fetchImpl: typeof fetch,
  apiKey: string,
  species: ShelterSpecies,
  pageNo: number
): Promise<{ items: ShelterApiItem[]; total: number }> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    _type: "json",
    upkind: UPKIND[species],
    state: "protect",
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
  });
  const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
  const res = await fetchImpl(`${API_URL}?${params.toString()}`, signal ? { signal } : undefined);
  // 실패 응답 본문 앞부분을 남긴다(키 값은 응답에 없다). data.go.kr 은 키·파라미터 오류를 본문으로 알려 준다.
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160)}`);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error("응답이 JSON 이 아닙니다");
  const code = String(data?.response?.header?.resultCode ?? "");
  if (code !== "00" && code !== "0") throw new Error(`resultCode ${code || "없음"}`);
  const body = data?.response?.body;
  const raw = body?.items?.item;
  const items: ShelterApiItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return { items, total: Number(body?.totalCount) || 0 };
}

/** 한 종의 보호 중 공고 전부. 총수에 못 미치게 끝나면 complete=false. */
async function fetchSpecies(
  fetchImpl: typeof fetch,
  apiKey: string,
  species: ShelterSpecies
): Promise<{ items: ShelterApiItem[]; complete: boolean }> {
  const items: ShelterApiItem[] = [];
  let total = 0;
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    const page = await fetchPage(fetchImpl, apiKey, species, pageNo);
    total = page.total;
    for (const item of page.items) items.push(item);
    if (!page.items.length || items.length >= total) break;
  }
  return { items, complete: items.length >= total };
}

// ── 비교 ────────────────────────────────────────────────────────

const petKey = (info: PetInfo | null): string =>
  info ? [info.sex ?? "", info.age ?? "", info.reason ?? "", (info.health ?? []).join(",")].join("|") : "";

const chunks = <T>(list: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
};

const contentData = (p: ShelterProduct) => ({
  name: p.name,
  description: p.description,
  photos: p.photos,
  mainImage: p.photos[0] ?? null,
  petInfo: { ...p.petInfo } as Prisma.InputJsonValue,
  regionSido: p.regionSido,
  regionSigungu: p.regionSigungu,
});

const sourceLine = (noticeNo: string) => `출처: 국가동물보호정보시스템 공고 ${noticeNo}`;

// ── 실행 ────────────────────────────────────────────────────────

export async function runShelterSync(options: ShelterSyncOptions): Promise<ShelterSyncResult> {
  const { db } = options;
  const startedAt = Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey ?? process.env.DATA_GO_KR_KEY ?? "";
  const userId = options.userId ?? Number(process.env.SHELTER_USER_ID);
  const maxNew = options.maxNew ?? SHELTER_MAX_NEW_PER_RUN;
  const timeBudgetMs = options.timeBudgetMs ?? SHELTER_TIME_BUDGET_MS;
  const result = emptyResult();

  if (!apiKey || !Number.isInteger(userId) || userId <= 0) {
    return { ...result, ok: false, error: "DATA_GO_KR_KEY 또는 SHELTER_USER_ID 가 없습니다" };
  }

  // 1. 받기 — 하나라도 실패하면 아무것도 바꾸지 않는다(E-1).
  const all: FetchedItem[] = [];
  let complete = true;
  try {
    for (const species of SPECIES) {
      const got = await fetchSpecies(fetchImpl, apiKey, species);
      complete = complete && got.complete;
      for (const item of got.items) all.push({ item, species });
    }
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).split(apiKey).join("***");
    console.warn(`[shelter-sync] 공고를 받지 못했어요(E-1): ${message}`);
    return { ...result, ok: false, error: message };
  }

  const byId = new Map<string, FetchedItem>();
  for (const entry of all) {
    const id = String(entry.item.desertionNo ?? "").trim();
    if (id && !byId.has(id)) byId.set(id, entry);
  }
  const seen = new Set<string>();
  byId.forEach((_value, id) => seen.add(id));
  result.fetched = seen.size;

  // 2. 지금 있는 보호소 글
  const existing = await db.product.findMany({
    where: { externalSource: SHELTER_SOURCE },
    select: {
      id: true,
      externalId: true,
      isHidden: true,
      tags: true,
      name: true,
      description: true,
      photos: true,
      petInfo: true,
      regionSido: true,
      regionSigungu: true,
    },
  });
  const existingById = new Map<string, (typeof existing)[number]>();
  for (const row of existing) if (row.externalId) existingById.set(row.externalId, row);

  // 3. 기존 글은 바뀐 것만 고치고, 새 공고는 따로 모은다.
  const changes: Array<{ rowId: number; product: ShelterProduct }> = [];
  const fresh: Array<{ product: ShelterProduct; sdt: string }> = [];
  for (const [id, entry] of Array.from(byId.entries())) {
    const row = existingById.get(id);
    if (!String(entry.item.popfile1 ?? "").trim()) {
      if (!row) result.skippedNoPhoto += 1;
      continue;
    }
    const product = toShelterProduct(entry.item, entry.species);
    if (!row) {
      fresh.push({ product, sdt: String(entry.item.noticeSdt ?? "") });
      continue;
    }
    const same =
      row.name === product.name &&
      row.description === product.description &&
      row.photos.join("\n") === product.photos.join("\n") &&
      row.regionSido === product.regionSido &&
      row.regionSigungu === product.regionSigungu &&
      petKey(parsePetInfo(row.petInfo)) === petKey(product.petInfo);
    if (!same) changes.push({ rowId: row.id, product });
  }

  const updateDeadline = startedAt + timeBudgetMs * 0.4;
  for (const change of changes) {
    if (Date.now() > updateDeadline) {
      result.pendingUpdates += 1;
      continue;
    }
    try {
      await db.product.update({ where: { id: change.rowId }, data: contentData(change.product) });
      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      console.warn(`[shelter-sync] 글 #${change.rowId} 을 고치지 못했어요: ${errorText(error, apiKey)}`);
    }
  }

  // 4. 빠진 공고 처리(F-2) — 받기가 온전하고 총수가 크게 줄지 않았을 때만.
  const visible = existing.filter((row) => !row.isHidden);
  let skipReason: ShelterSyncResult["skippedHideReason"];
  if (!complete) skipReason = "incomplete-fetch";
  else if (visible.length > 0 && seen.size < SHELTER_HIDE_GUARD_RATIO * visible.length) skipReason = "api-total-dropped";
  if (skipReason) {
    result.skippedHideReason = skipReason;
    console.warn(`[shelter-sync] 숨김을 건너뛰어요(${skipReason}): 받은 ${seen.size}건 / 보이는 글 ${visible.length}건`);
  } else {
    const missing = visible.filter((row) => row.externalId && !seen.has(row.externalId));
    const hideIds = missing.filter((row) => row.tags.indexOf(SHELTER_MISSED_TAG) >= 0).map((row) => row.id);
    const markIds = missing.filter((row) => row.tags.indexOf(SHELTER_MISSED_TAG) < 0).map((row) => row.id);
    const recoverIds = visible
      .filter((row) => row.externalId && seen.has(row.externalId) && row.tags.indexOf(SHELTER_MISSED_TAG) >= 0)
      .map((row) => row.id);
    try {
      for (const ids of chunks(hideIds)) {
        result.hidden += (await db.product.updateMany({ where: { id: { in: ids } }, data: { isHidden: true } })).count;
      }
      for (const ids of chunks(markIds)) {
        result.marked += (
          await db.product.updateMany({ where: { id: { in: ids } }, data: { tags: { push: SHELTER_MISSED_TAG } } })
        ).count;
      }
      for (const ids of chunks(recoverIds)) {
        result.recovered += (await db.product.updateMany({ where: { id: { in: ids } }, data: { tags: { set: [] } } })).count;
      }
    } catch (error) {
      result.failed += 1;
      console.warn(`[shelter-sync] 숨김 처리에 실패했어요: ${errorText(error, apiKey)}`);
    }
  }

  // 5. 새 공고 넣기 — 최근 공고부터, 회차당 maxNew 건·시간 한도까지(E-4). 개발 서버에서 손으로 올린 옛 글은 이어받는다.
  fresh.sort((a, b) => b.sdt.localeCompare(a.sdt) || a.product.externalId.localeCompare(b.product.externalId));
  let legacy: Map<string, number> | null = null;
  const categoryIds: Record<string, number | null> = {};
  for (const { product } of fresh) {
    if (Date.now() - startedAt > timeBudgetMs) {
      result.remaining += 1;
      continue;
    }
    try {
      if (!legacy) legacy = await loadLegacy(db, userId);
      const legacyId = product.noticeNo ? legacy.get(product.noticeNo) : undefined;
      if (legacyId !== undefined) {
        await db.product.update({
          where: { id: legacyId },
          data: { ...contentData(product), externalSource: SHELTER_SOURCE, externalId: product.externalId },
        });
        legacy.delete(product.noticeNo);
        result.adopted += 1;
        continue;
      }
      if (result.created >= maxNew) {
        result.remaining += 1;
        continue;
      }
      if (!(product.category in categoryIds)) {
        categoryIds[product.category] = options.resolveCategoryId ? await options.resolveCategoryId(product.category) : null;
      }
      await db.product.create({
        data: {
          ...contentData(product),
          userId,
          category: product.category,
          categoryId: categoryIds[product.category],
          productType: product.productType,
          dealType: product.dealType,
          externalSource: SHELTER_SOURCE,
          externalId: product.externalId,
        },
      });
      result.created += 1;
    } catch (error) {
      // 겹친 회차가 같은 공고를 먼저 넣었으면(고유 색인 P2002) 조용히 넘어간다.
      if ((error as { code?: string } | null)?.code !== "P2002") {
        result.failed += 1;
        console.warn(`[shelter-sync] 공고 ${product.externalId} 를 넣지 못했어요: ${errorText(error, apiKey)}`);
      }
    }
  }

  return result;
}

const errorText = (error: unknown, apiKey: string): string =>
  (error instanceof Error ? error.message : String(error)).split(apiKey).join("***").slice(0, 300);

/** 손으로 올려 externalId 가 없는 옛 보호소 글 → 출처 줄의 공고번호별 글 id. */
async function loadLegacy(db: ShelterDb, userId: number): Promise<Map<string, number>> {
  const rows = await db.product.findMany({
    where: { userId, externalSource: null, dealType: "rehoming" },
    select: { id: true, description: true },
  });
  const prefix = sourceLine("");
  const map = new Map<string, number>();
  for (const row of rows) {
    const line = row.description.split("\n").find((l) => l.startsWith(prefix));
    const noticeNo = line?.slice(prefix.length).trim();
    if (noticeNo && !map.has(noticeNo)) map.set(noticeNo, row.id);
  }
  return map;
}
