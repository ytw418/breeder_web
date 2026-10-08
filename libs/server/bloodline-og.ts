import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { fetchReceivedCounts } from "@libs/server/bloodline-mapper";
import { formatReceivedCount } from "@libs/shared/bloodline-card";
import { DELETED_USER_LABEL, displayUserName } from "@libs/shared/deletedUser";
import { formatRegionShort } from "@libs/shared/regions";

/**
 * 혈통 공유 미리보기(OG) 데이터. 공개 URL 은 /bloodline-management/card/{id} 하나다(설계 §3.9).
 * - ACTIVE 혈통만 payload 를 준다. 출처 카드(LINE) id 로 열면 뿌리 혈통 기준이다(출처 카드·뿌리 둘 다 ACTIVE).
 * - 회수(REVOKED)·숨김(INACTIVE)·없는 카드는 null → 페이지는 기본 제목 + noindex, 이미지는 루트 기본 OG.
 * - 사람 이름은 뿌리를 만든 사람만 쓴다(누구에게나 공개되는 이름). 받은 사람은 수만 쓴다.
 * - DB 오류는 그대로 던진다. 호출처(generateMetadata·opengraph-image)가 잡아 기본값으로 그린다.
 */

type Db = typeof client | Prisma.TransactionClient;

export interface BloodlineOgPayload {
  /** 뿌리 혈통 id(출처 카드 id 로 열어도 뿌리) */
  rootId: number;
  name: string;
  speciesType: string | null;
  /** formatRegionShort 결과("충남 공주"). 산지가 없으면 null */
  originLabel: string | null;
  /** 뿌리를 만든 사람. 탈퇴했으면 "탈퇴한 사용자" */
  creatorName: string;
  /** 받은 사람 수(같은 뿌리의 ACTIVE 출처 카드 현재 보유자 수, 만든 사람 제외) */
  receivedCount: number;
  /** BloodlineCard.image 그대로(Cloudflare 이미지 id) */
  imageId: string | null;
}

export const BLOODLINE_OG_SITE_URL = "https://bredy.app";
export const BLOODLINE_OG_DEFAULT_TITLE = "혈통 | 브리디";
export const BLOODLINE_OG_NAME_RULE = "혈통 이름은 만든 사람만 쓸 수 있어요.";
export const BLOODLINE_OG_DEFAULT_DESCRIPTION = `브리디에서 혈통을 확인해 보세요. ${BLOODLINE_OG_NAME_RULE}`;

const ogCardSelect = {
  id: true,
  cardType: true,
  status: true,
  bloodlineReferenceId: true,
  name: true,
  speciesType: true,
  originSido: true,
  originSigungu: true,
  image: true,
  creatorId: true,
  creator: { select: { name: true } },
} satisfies Prisma.BloodlineCardSelect;

export async function loadBloodlineOgPayload(
  cardId: number,
  db: Db = client
): Promise<BloodlineOgPayload | null> {
  if (!Number.isInteger(cardId) || cardId <= 0) return null;

  const card = await db.bloodlineCard.findUnique({ where: { id: cardId }, select: ogCardSelect });
  if (!card || card.status !== "ACTIVE") return null;

  let root = card;
  if (card.cardType === "LINE") {
    if (!card.bloodlineReferenceId) return null;
    const found = await db.bloodlineCard.findUnique({
      where: { id: card.bloodlineReferenceId },
      select: ogCardSelect,
    });
    if (!found) return null;
    root = found;
  }
  if (root.cardType !== "BLOODLINE" || root.status !== "ACTIVE") return null;

  const counts = await fetchReceivedCounts([{ id: root.id, creatorId: root.creatorId }], db);

  return {
    rootId: root.id,
    name: root.name,
    speciesType: root.speciesType?.trim() || null,
    originLabel: formatRegionShort({ sido: root.originSido, sigungu: root.originSigungu }),
    creatorName: displayUserName(root.creator?.name) || DELETED_USER_LABEL,
    receivedCount: counts.get(root.id) ?? 0,
    imageId: root.image?.trim() || null,
  };
}

/* ---------- 문구 ---------- */

/** 공개 상세 경로(앱 src/lib/bloodline-route.ts 와 같은 주소). */
export const bloodlinePublicPath = (cardId: number) => `/bloodline-management/card/${cardId}`;

/** "강산 라인 · 왕사슴벌레 | 브리디". 종이 없으면 "강산 라인 | 브리디". */
export function bloodlineOgTitle(payload: Pick<BloodlineOgPayload, "name" | "speciesType">) {
  return `${[payload.name, payload.speciesType].filter(Boolean).join(" · ")} | 브리디`;
}

/** "왕사슴벌레 · 충남 공주". 있는 것만 잇는다. */
export function bloodlineOgSpeciesLine(
  payload: Pick<BloodlineOgPayload, "speciesType" | "originLabel">
) {
  return [payload.speciesType, payload.originLabel].filter(Boolean).join(" · ");
}

/** "받은 사람 3명" / "아직 받은 사람 없음"(앱·웹 공용 문구). */
export function bloodlineOgReceivedLine(payload: Pick<BloodlineOgPayload, "receivedCount">) {
  return formatReceivedCount(payload.receivedCount) ?? "아직 받은 사람 없음";
}

/** "강산님이 만든 혈통 · 충남 공주 · 받은 사람 3명. 혈통 이름은 만든 사람만 쓸 수 있어요." */
export function bloodlineOgDescription(payload: BloodlineOgPayload) {
  const parts = [
    `${payload.creatorName}님이 만든 혈통`,
    payload.originLabel,
    bloodlineOgReceivedLine(payload),
  ].filter(Boolean);
  return `${parts.join(" · ")}. ${BLOODLINE_OG_NAME_RULE}`;
}

/* ---------- 카드 사진 ---------- */

const CLOUDFLARE_IMAGE_HOST = "https://imagedelivery.net/";
const CLOUDFLARE_IMAGE_BASE = `${CLOUDFLARE_IMAGE_HOST}OvWZrAz6J6K7n9LKUH5pKw`;
const CLOUDFLARE_IMAGE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const PHOTO_TIMEOUT_MS = 3000;
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES = ["image/png", "image/jpeg"] as const;

/**
 * 카드 사진 주소(Cloudflare public). 서버가 가져오는 주소라 Cloudflare 이미지 id 와 imagedelivery 주소만 허용한다
 * (image 는 사용자가 보낸 문자열이라 임의 주소를 서버에서 열지 않는다).
 */
export function bloodlineOgPhotoUrl(imageId: string | null | undefined): string | null {
  const value = imageId?.trim();
  if (!value) return null;
  if (value.startsWith(CLOUDFLARE_IMAGE_HOST)) return value;
  if (CLOUDFLARE_IMAGE_ID.test(value)) return `${CLOUDFLARE_IMAGE_BASE}/${value}/public`;
  return null;
}

/**
 * 카드 사진을 data URI 로 받아 온다. 실패하면 null(이미지는 #E9EBEE 자리로 그린다).
 * next/og 가 직접 주소를 받으면 실패 시 이미지 전체가 깨지므로 미리 받아 형식(PNG·JPEG)과 크기를 확인한다.
 * Cloudflare 는 Accept 로 WebP/AVIF 를 고르므로 PNG·JPEG 만 받겠다고 보낸다.
 */
export async function loadBloodlineOgPhoto(
  imageId: string | null | undefined,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<string | null> {
  const url = bloodlineOgPhotoUrl(imageId);
  if (!url) return null;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? PHOTO_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      headers: { accept: PHOTO_TYPES.join(",") },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!(PHOTO_TYPES as readonly string[]).includes(contentType)) return null;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > PHOTO_MAX_BYTES) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length || bytes.length > PHOTO_MAX_BYTES) return null;
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch (error) {
    console.warn("[bloodline-og] 카드 사진을 가져오지 못했어요", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
