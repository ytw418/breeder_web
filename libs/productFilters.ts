import { findCategoryBranch } from "@libs/categoryTaxonomy";
import { PRODUCT_PRICE_MAX } from "@libs/productRules";

/**
 * 상품 목록(/products) 필터 상태 ↔ URL 파라미터 ↔ GET /api/products 쿼리.
 * 앱 bredy_app src/lib/productFilters.ts 와 같은 규칙.
 * 화면은 필터를 바꿀 때마다 URL 에도 적어 둔다(router.replace) — 상세에 갔다가 뒤로 오면 필터가 그대로다.
 */
export type ProductSort = "latest" | "popular" | "priceAsc" | "priceDesc";

export type ProductFilters = {
  /** "전체" 또는 대분류 id */
  category: string;
  /** "" 또는 하위분류 */
  subcategory: string;
  productType: "" | "생물" | "용품";
  onSaleOnly: boolean;
  sort: ProductSort;
  /** min=0·max=0 이면 무료나눔(서버 price=0). */
  minPrice?: number;
  maxPrice?: number;
};

export const DEFAULT_PRODUCT_FILTERS: ProductFilters = {
  category: "전체",
  subcategory: "",
  productType: "",
  onSaleOnly: false,
  sort: "latest",
};

export const PRODUCT_SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "priceAsc", label: "가격 낮은순" },
  { value: "priceDesc", label: "가격 높은순" },
];

export const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "무료나눔", min: 0, max: 0 },
  { label: "1만원 이하", max: 10_000 },
  { label: "1만~5만원", min: 10_000, max: 50_000 },
  { label: "5만~10만원", min: 50_000, max: 100_000 },
  { label: "10만원 이상", min: 100_000 },
];

const PRODUCT_SORTS = PRODUCT_SORT_OPTIONS.map((o) => o.value);

type ParamValue = string | string[] | null | undefined;
export type ProductFilterParams =
  | Record<string, ParamValue>
  | { get(name: string): string | null };

const firstParam = (value: ParamValue) =>
  (Array.isArray(value) ? value[0] : value) ?? undefined;

const readParam = (params: ProductFilterParams, key: string) =>
  typeof (params as { get?: unknown }).get === "function"
    ? firstParam((params as { get(name: string): string | null }).get(key))
    : firstParam((params as Record<string, ParamValue>)[key]);

/**
 * 0 이상의 정수 문자열만 숫자로 읽는다(서버 toPrice 와 같은 기준).
 * 링크의 큰 값은 상품 가격 상한(10억원)으로 자른다(서버 price 는 INT4 라 넘치면 500).
 */
export const toFilterPrice = (value: string | undefined) =>
  value !== undefined && /^\d+$/.test(value)
    ? Math.min(Number(value), PRODUCT_PRICE_MAX)
    : undefined;

/** URL 쿼리(URLSearchParams 또는 객체) → 필터. 모르는 값은 기본값으로 둔다. */
export function parseProductFilterParams(params: ProductFilterParams): ProductFilters {
  // 하위분류(구피)·레거시 별칭(기타곤충)도 대분류/하위분류로 나눈다.
  const branch = findCategoryBranch(readParam(params, "category"));
  const productType = readParam(params, "productType");
  const sort = readParam(params, "sort");
  const price = toFilterPrice(readParam(params, "price"));

  return {
    category: branch.parent || "전체",
    subcategory: branch.child,
    productType: productType === "생물" || productType === "용품" ? productType : "",
    onSaleOnly: readParam(params, "status") === "판매중",
    sort: PRODUCT_SORTS.includes(sort as ProductSort) ? (sort as ProductSort) : "latest",
    // 정확한 가격(price)은 min=max 로 본다. 홈 무료나눔 카드 → price=0.
    minPrice: price ?? toFilterPrice(readParam(params, "minPrice")),
    maxPrice: price ?? toFilterPrice(readParam(params, "maxPrice")),
  };
}

/** 상품 목록 URL 에서 필터가 쓰는 키. 그 밖의 키(utm 등)는 건드리지 않는다. */
export const PRODUCT_FILTER_PARAM_KEYS = [
  "category",
  "productType",
  "status",
  "sort",
  "price",
  "minPrice",
  "maxPrice",
] as const;

/** 필터 → URL 쿼리(기본값은 넣지 않는다). parseProductFilterParams 와 왕복한다. */
export function serializeProductFilters(filters: ProductFilters): URLSearchParams {
  const search = new URLSearchParams();
  const category =
    filters.subcategory || (filters.category !== "전체" ? filters.category : "");
  if (category) search.set("category", category);
  if (filters.productType) search.set("productType", filters.productType);
  if (filters.onSaleOnly) search.set("status", "판매중");
  if (filters.sort !== "latest") search.set("sort", filters.sort);
  if (filters.minPrice === 0 && filters.maxPrice === 0) {
    search.set("price", "0");
  } else {
    if (filters.minPrice !== undefined) search.set("minPrice", String(filters.minPrice));
    if (filters.maxPrice !== undefined) search.set("maxPrice", String(filters.maxPrice));
  }
  return search;
}

/** 두 필터가 URL 로 적었을 때 같은지. */
export function sameProductFilters(a: ProductFilters, b: ProductFilters): boolean {
  return serializeProductFilters(a).toString() === serializeProductFilters(b).toString();
}

/** 현재 쿼리 문자열에서 필터 키만 바꿔 끼운 쿼리 문자열("?" 없음). */
export function withProductFilterSearch(currentSearch: string, filters: ProductFilters): string {
  const next = new URLSearchParams(currentSearch);
  PRODUCT_FILTER_PARAM_KEYS.forEach((key) => next.delete(key));
  serializeProductFilters(filters).forEach((value, key) => next.set(key, value));
  return next.toString();
}

export type ProductQueryParams = {
  category?: string;
  productType?: string;
  status?: string;
  sort: ProductSort;
  price?: number;
  minPrice?: number;
  maxPrice?: number;
};

/** GET /api/products 쿼리 값(page·size 제외). */
export function toProductQueryParams(filters: ProductFilters): ProductQueryParams {
  const { minPrice, maxPrice } = filters;
  const isFree = minPrice === 0 && maxPrice === 0;
  return {
    category:
      filters.subcategory || (filters.category !== "전체" ? filters.category : undefined),
    productType: filters.productType || undefined,
    status: filters.onSaleOnly ? "판매중" : undefined,
    sort: filters.sort,
    ...(isFree ? { price: 0 } : { minPrice, maxPrice }),
  };
}

/** /api/products?… 주소. undefined 값은 넣지 않는다. */
export function toProductsApiUrl(
  filters: ProductFilters,
  { page, size }: { page: number; size: number }
): string {
  const search = new URLSearchParams();
  search.set("page", String(page));
  search.set("size", String(size));
  Object.entries(toProductQueryParams(filters)).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return `/api/products?${search.toString()}`;
}

export function hasPriceFilter(filters: ProductFilters): boolean {
  return filters.minPrice !== undefined || filters.maxPrice !== undefined;
}

export function isDefaultFilters(filters: ProductFilters): boolean {
  return (
    filters.category === DEFAULT_PRODUCT_FILTERS.category &&
    filters.subcategory === DEFAULT_PRODUCT_FILTERS.subcategory &&
    filters.productType === DEFAULT_PRODUCT_FILTERS.productType &&
    filters.onSaleOnly === DEFAULT_PRODUCT_FILTERS.onSaleOnly &&
    filters.sort === DEFAULT_PRODUCT_FILTERS.sort &&
    !hasPriceFilter(filters)
  );
}

const won = (value: number) => value.toLocaleString("ko-KR");

/** 가격 칩 라벨: 값이 없으면 "가격", 프리셋과 같으면 프리셋 이름, 아니면 범위. */
export function priceChipLabel(filters: Pick<ProductFilters, "minPrice" | "maxPrice">): string {
  const { minPrice: min, maxPrice: max } = filters;
  const preset = PRICE_PRESETS.find((p) => p.min === min && p.max === max);
  if (preset) return preset.label;
  if (min === undefined) {
    return max === undefined ? "가격" : `${won(max)}원 이하`;
  }
  if (max === undefined) return `${won(min)}원 이상`;
  return min === max ? `${won(min)}원` : `${won(min)}~${won(max)}원`;
}

/** 가격 시트 적용: 최소가 최대보다 크면 서로 바꾼다. */
export function normalizePriceRange(
  min: number | null | undefined,
  max: number | null | undefined
): { minPrice?: number; maxPrice?: number } {
  let lo = min ?? undefined;
  let hi = max ?? undefined;
  if (lo !== undefined && hi !== undefined && lo > hi) [lo, hi] = [hi, lo];
  return { minPrice: lo, maxPrice: hi };
}

/** 같은 id 가 두 번 오면(페이지 사이에 새 상품이 낀 경우) 처음 것만 남긴다. */
export function uniqueById<T extends { id: number }>(items: readonly T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
