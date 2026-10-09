/**
 * 관심 카테고리(고정) 공용 타입·규칙. 서버·웹·앱이 같은 path 규칙을 쓴다.
 * path 는 '/reptile/tortoise/' 처럼 조상 slug 를 이은 값이고, 하위 범위는 path prefix 로 본다.
 */
export interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  path: string;
  sortOrder: number;
}

export interface CategoriesResponse {
  success: boolean;
  categories: CategoryItem[];
  error?: string;
}

export const DEAL_TYPES = ["sale", "adoption", "rehoming"] as const;
export type DealType = (typeof DEAL_TYPES)[number];
export const DEFAULT_DEAL_TYPE: DealType = "sale";
export const isDealType = (value: unknown): value is DealType =>
  typeof value === "string" && (DEAL_TYPES as readonly string[]).includes(value);

/**
 * 관심 카테고리 범위를 적용하는 화면. 앱(src/lib/categoryScope.ts)·웹이 같은 값을 쓴다.
 * 경매·혈통은 구조만 잡아 두었다(2026-10-09): 서버가 categoryPath 를 받고 경매·혈통 카드에 categoryId 를
 * 쌓기 시작했다. 데이터가 모이면 true 로 켜고 SCOPED_BREEDER_SCORE_WEIGHTS 의 가중치를 올린다.
 */
export const CATEGORY_SCOPE_SURFACES = {
  products: true,
  posts: true,
  breeders: true,
  auctions: false,
  bloodlines: false,
} as const;

/** 여러 카테고리를 함께 고정할 수 있어 쿼리 파라미터는 path 를 쉼표로 잇는다. */
export const CATEGORY_PATH_SEPARATOR = ",";
const CATEGORY_PATH_PATTERN = /^(\/[a-z0-9-]+)+\/$/;
/** 한 요청에 받는 범위 수 상한(고정 수 상한과 같다). */
export const MAX_PINNED_CATEGORIES = 10;

export const isCategoryPath = (value: unknown): value is string =>
  typeof value === "string" && CATEGORY_PATH_PATTERN.test(value);

/**
 * `categoryPath` 쿼리 값을 path 목록으로 푼다. 형식이 틀린 항목은 버리고, 조상이 함께 있으면 하위는 뺀다.
 * 유효한 path 가 하나도 없으면 null(범위 없음 = 전체 보기).
 */
export const parseCategoryPathParam = (
  value: string | string[] | undefined | null
): string[] | null => {
  const raw = Array.isArray(value) ? value.join(CATEGORY_PATH_SEPARATOR) : value ?? "";
  const paths = Array.from(
    new Set(
      raw
        .split(CATEGORY_PATH_SEPARATOR)
        .map((part) => part.trim())
        .filter(isCategoryPath)
    )
  ).slice(0, MAX_PINNED_CATEGORIES);
  const roots = paths.filter(
    (path) => !paths.some((other) => other !== path && path.startsWith(other))
  );
  return roots.length ? roots : null;
};

export const joinCategoryPaths = (paths: readonly string[]) =>
  paths.join(CATEGORY_PATH_SEPARATOR);

/** path 가 roots 중 하나의 하위(자기 자신 포함)인지. */
export const isUnderCategoryPaths = (path: string, roots: readonly string[]) =>
  roots.some((root) => path.startsWith(root));

/** path 가 roots 중 하나의 상위(자기 자신 제외)인지. */
export const isAncestorOfCategoryPaths = (path: string, roots: readonly string[]) =>
  roots.some((root) => root !== path && root.startsWith(path));
