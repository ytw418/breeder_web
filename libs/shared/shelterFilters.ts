/**
 * 보호소 아이들 필터(2026-10-24 입양 탭 개편 — 앱 design/mockups/adoption-v2/A-karrot.html).
 * 지역(시/도·시·군·구)·품종·크기·정렬을 주소 쿼리와 API 쿼리가 같은 모양으로 읽고 쓴다. 순수 함수만 둔다(서버 import 없음).
 *
 * 결정 기록(한 번만 정한다):
 * - 목록 API(GET /api/products)가 이미 쪽 크기를 `size` 로 받는다. 그래서 크기(소형·중형·대형) 필터의 쿼리 키는 `dogSize` 다.
 *   객체 안의 칸 이름은 계약대로 `size` 이고(`filters.size`), 주소·API 쿼리에 쓸 때만 `dogSize` 가 된다.
 * - 쿼리 인코딩: 값이 여럿이면 쉼표로 이어 한 키에 담는다. 키는 category · sido · sigungu · breed · dogSize · sort.
 *   sido 는 Product.regionSido 에 저장된 시/도 전체 이름("경기도"), sigungu 는 regionSigungu("수원시"), breed 는 Product.externalBreed.
 *   시·군·구 이름은 여러 시/도에서 겹치므로("중구") 같이 보내는 sido 와 함께 거른다.
 * - 크기는 몸무게(kg, Product.externalWeightKg) 기준이다: 소형 7 이하 · 중형 7 초과 15 이하 · 대형 15 초과.
 *   강아지 전용이라 category 가 고양이면 읽을 때 버린다(카테고리 없음 = 강아지·고양이 둘 다 = 크기 가능). 몸무게를 모르는 글은 크기를 걸면 빠진다.
 * - 정렬: latest(기본, 주소·API 쿼리에서는 생략) · deadline(공고 마감이 가까운 순, 마감 안 지난 공고 먼저 · 모르는 건 뒤).
 * - 종 칩(category)은 웹 주소에서는 기존 `?chip=dog|cat` 으로 두므로 주소를 만들 때는 category 를 빼고, API 쿼리에서는 포함한다.
 *
 * 앱 bredy_app src/lib/shelterFilters.ts = 웹 libs/shared/shelterFilters.ts 사본이라 함께 고친다.
 */

import { SIDO_SHORT } from "./regions";

export type ShelterCategory = "강아지" | "고양이";
export type ShelterSizeId = "small" | "medium" | "large";
export type ShelterSortId = "latest" | "deadline";

/** 크기 구간(kg). min 은 초과, max 는 이하다: small ≤7 · medium >7 ≤15 · large >15. */
export const SHELTER_SIZES: ReadonlyArray<{ id: ShelterSizeId; label: string; min?: number; max?: number }> = [
  { id: "small", label: "소형", max: 7 },
  { id: "medium", label: "중형", min: 7, max: 15 },
  { id: "large", label: "대형", min: 15 },
];

export const SHELTER_SORTS: ReadonlyArray<{ id: ShelterSortId; label: string }> = [
  { id: "latest", label: "최신 공고" },
  { id: "deadline", label: "마감 임박" },
];

/** GET /api/products/shelter-facets 응답. 필터 시트의 숫자(공고 수)를 채운다. */
export interface ShelterFacetsResponse {
  success: true;
  /** 보이는 보호소 글 수(종을 넘겼으면 그 종만, 시/도를 모르는 글 포함). */
  total: number;
  /** 시/도별 공고 수(많은 순). name 은 저장된 전체 이름("경기도"), short 는 화면용("경기"). */
  sido: Array<{ name: string; short: string; count: number }>;
  /** 요청한 sido 안 시·군·구별 공고 수(많은 순). sido 를 넘겼을 때만 채워진다. */
  sigungu: Array<{ name: string; count: number }>;
  /** 품종별 공고 수(많은 순, 품종 모름 제외). category 를 넘겼을 때만 채워진다. */
  breed: Array<{ name: string; count: number }>;
}

export interface ShelterFilters {
  category?: ShelterCategory;
  /** 시/도 전체 이름("경기도"). 화면은 한 번에 한 곳만 고른다. */
  sido?: string[];
  /** 시·군·구("수원시"). sido 와 함께 쓴다. */
  sigungu?: string[];
  breed?: string[];
  /** 몸무게 구간(강아지만). 쿼리 키는 dogSize. */
  size?: ShelterSizeId;
  /** 없으면 latest. */
  sort?: ShelterSortId;
}

/** 주소·API 쿼리에서 읽는 키(쪽 크기 `size` 와 겹치지 않게 크기는 dogSize). */
export const SHELTER_FILTER_QUERY_KEYS = ["category", "sido", "sigungu", "breed", "dogSize", "sort"] as const;

const MAX_VALUES = { sido: 20, sigungu: 60, breed: 40 } as const;
const MAX_VALUE_LENGTH = 40;

type QueryValue = string | string[] | undefined | null;
/** Next 의 req.query(객체) 와 URLSearchParams·ReadonlyURLSearchParams 를 모두 받는다. */
export type ShelterQuerySource = Record<string, QueryValue> | { get(name: string): string | null };

const readRaw = (source: ShelterQuerySource, key: string): string[] => {
  const raw: QueryValue =
    typeof (source as { get?: unknown }).get === "function"
      ? (source as { get(name: string): string | null }).get(key)
      : (source as Record<string, QueryValue>)[key];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.flatMap((value) => String(value).split(","));
};

/** 쉼표 목록 → 앞뒤 공백 없는 고유 값(처음 나온 순서, 길이·개수 제한). */
const readList = (source: ShelterQuerySource, key: string, max: number): string[] | undefined => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of readRaw(source, key)) {
    const value = part.trim();
    if (!value || value.length > MAX_VALUE_LENGTH || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= max) break;
  }
  return out.length ? out : undefined;
};

export const isShelterSizeId = (value: unknown): value is ShelterSizeId =>
  SHELTER_SIZES.some((size) => size.id === value);
export const isShelterSortId = (value: unknown): value is ShelterSortId =>
  SHELTER_SORTS.some((sort) => sort.id === value);

/** 주소·API 쿼리 → 필터. 모르는 값은 버리고, 비어 있는 칸은 아예 두지 않는다. */
export function parseShelterFilters(query: ShelterQuerySource | null | undefined): ShelterFilters {
  if (!query) return {};
  const filters: ShelterFilters = {};
  const category = readRaw(query, "category")[0]?.trim();
  if (category === "강아지" || category === "고양이") filters.category = category;
  const sido = readList(query, "sido", MAX_VALUES.sido);
  if (sido) filters.sido = sido;
  const sigungu = readList(query, "sigungu", MAX_VALUES.sigungu);
  if (sigungu) filters.sigungu = sigungu;
  const breed = readList(query, "breed", MAX_VALUES.breed);
  if (breed) filters.breed = breed;
  const size = readRaw(query, "dogSize")[0]?.trim();
  if (isShelterSizeId(size) && filters.category !== "고양이") filters.size = size;
  const sort = readRaw(query, "sort")[0]?.trim();
  if (isShelterSortId(sort) && sort !== "latest") filters.sort = sort;
  return filters;
}

/** 필터 → 쿼리 객체(값이 있는 칸만, 키 순서 고정). `new URLSearchParams(shelterFiltersToQuery(f))` 로 쓴다. */
export function shelterFiltersToQuery(filters: ShelterFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.category) query.category = filters.category;
  if (filters.sido?.length) query.sido = filters.sido.join(",");
  if (filters.sigungu?.length) query.sigungu = filters.sigungu.join(",");
  if (filters.breed?.length) query.breed = filters.breed.join(",");
  if (filters.size && filters.category !== "고양이") query.dogSize = filters.size;
  if (filters.sort && filters.sort !== "latest") query.sort = filters.sort;
  return query;
}

/** 지역·품종·크기·정렬 중 하나라도 걸려 있는지(종 칩은 세지 않는다). */
export function hasShelterFilters(filters: ShelterFilters): boolean {
  return Boolean(
    filters.sido?.length || filters.sigungu?.length || filters.breed?.length || filters.size || filters.sort
  );
}

/** 몸무게(kg) → 크기 구간. 모르거나 0 이하면 null. */
export function shelterSizeOf(weightKg: number | null | undefined): ShelterSizeId | null {
  if (typeof weightKg !== "number" || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  const found = SHELTER_SIZES.find(
    (size) => (size.min === undefined || weightKg > size.min) && (size.max === undefined || weightKg <= size.max)
  );
  return found?.id ?? null;
}

/** 크기 구간 → 몸무게 조건(Prisma 의 gt·lte 와 같은 뜻). */
export function shelterSizeRange(size: ShelterSizeId): { gt?: number; lte?: number } {
  const found = SHELTER_SIZES.find((item) => item.id === size);
  return {
    ...(found?.min !== undefined ? { gt: found.min } : {}),
    ...(found?.max !== undefined ? { lte: found.max } : {}),
  };
}

// ── 필터 줄 글자 ─────────────────────────────────────────────────

const withRest = (first: string, count: number) => (count > 1 ? `${first} 외 ${count - 1}` : first);

export interface ShelterFilterSummary {
  region: { label: string; applied: boolean };
  breed: { label: string; applied: boolean };
  size: { label: string; applied: boolean };
  sort: { label: string; applied: boolean };
}

/**
 * 필터 줄 알약 글자. 걸리지 않았으면 이름만('지역'·'품종'·'크기'), 걸렸으면 '지역: 수원시 외 1' · '품종: 말티즈 외 1' · '크기: 소형'.
 * 정렬은 늘 '정렬: 최신 공고'처럼 보이고, 기본(최신 공고)이 아닐 때만 applied 다. 시/도만 골랐으면 짧은 이름('지역: 경기').
 */
export function shelterFilterSummary(filters: ShelterFilters): ShelterFilterSummary {
  const sigungu = filters.sigungu ?? [];
  const sido = filters.sido ?? [];
  const breed = filters.breed ?? [];
  const region = sigungu.length
    ? `지역: ${withRest(sigungu[0], sigungu.length)}`
    : sido.length
      ? `지역: ${withRest(SIDO_SHORT[sido[0]] ?? sido[0], sido.length)}`
      : "지역";
  const sizeLabel = filters.size ? SHELTER_SIZES.find((item) => item.id === filters.size)?.label : undefined;
  const sortId = filters.sort ?? "latest";
  const sortLabel = SHELTER_SORTS.find((item) => item.id === sortId)?.label ?? SHELTER_SORTS[0].label;
  return {
    region: { label: region, applied: sigungu.length > 0 || sido.length > 0 },
    breed: { label: breed.length ? `품종: ${withRest(breed[0], breed.length)}` : "품종", applied: breed.length > 0 },
    size: { label: sizeLabel ? `크기: ${sizeLabel}` : "크기", applied: Boolean(sizeLabel) },
    sort: { label: `정렬: ${sortLabel}`, applied: sortId !== "latest" },
  };
}
