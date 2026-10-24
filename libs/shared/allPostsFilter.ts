import type { PostCategory } from "@libs/constants";

/**
 * '게시글 전체보기'(/posts/all) 필터 규칙. 앱 src/lib/allPostsFilter.ts 와 같다(칩 순서·정렬 라벨·주소 쿼리).
 * 홈 인기글 TOP 10 의 '전체보기 ›' 는 `/posts/all?sort=popular` 로 온다.
 * 쿼리: `category`('전체' 또는 아래 카테고리 id), `sort`(popular|comments|latest, 기본 popular — 기본값은 주소에서 생략한다).
 */

export const ALL_POSTS_PATH = "/posts/all";
/** 홈 인기글 TOP 10 '전체보기 ›' 가 여는 주소. */
export const ALL_POSTS_POPULAR_HREF = `${ALL_POSTS_PATH}?sort=popular`;

export const ALL_POSTS_ALL_CATEGORY = "전체";

/** 칩 순서(전체 다음). 타입이 POST_CATEGORIES id 와 어긋나면 컴파일에서 막는다. */
const CATEGORY_ORDER = [
  "정보",
  "자유",
  "질문",
  "자랑",
  "후기",
  "사진",
  "토론",
  "동네",
  "변이",
] as const satisfies readonly PostCategory[];

export const ALL_POSTS_CATEGORIES: readonly string[] = [ALL_POSTS_ALL_CATEGORY, ...CATEGORY_ORDER];

export const ALL_POSTS_SORTS = [
  { id: "popular", label: "인기순" },
  { id: "comments", label: "댓글순" },
  { id: "latest", label: "최신순" },
] as const;
export type AllPostsSort = (typeof ALL_POSTS_SORTS)[number]["id"];

export const DEFAULT_ALL_POSTS_SORT: AllPostsSort = "popular";

export interface AllPostsFilter {
  category: string;
  sort: AllPostsSort;
}

type ParamsLike = { get(name: string): string | null } | null | undefined;

/** 주소 쿼리 → 필터. 모르는 값은 기본값('전체'·인기순)으로 돌린다. */
export function parseAllPostsParams(params: ParamsLike): AllPostsFilter {
  const category = params?.get("category") ?? "";
  const sort = params?.get("sort") ?? "";
  return {
    category: ALL_POSTS_CATEGORIES.includes(category) ? category : ALL_POSTS_ALL_CATEGORY,
    sort: ALL_POSTS_SORTS.some((s) => s.id === sort) ? (sort as AllPostsSort) : DEFAULT_ALL_POSTS_SORT,
  };
}

/** 필터 → 주소(기본값은 쓰지 않아 기본 상태면 `/posts/all`). 다른 쿼리(utm 등)는 current 에서 남긴다. */
export function allPostsHref(filter: AllPostsFilter, current = ""): string {
  const query = new URLSearchParams(current);
  query.delete("category");
  query.delete("sort");
  const next = new URLSearchParams();
  if (filter.category !== ALL_POSTS_ALL_CATEGORY) next.set("category", filter.category);
  if (filter.sort !== DEFAULT_ALL_POSTS_SORT) next.set("sort", filter.sort);
  query.forEach((value, key) => next.append(key, value));
  const qs = next.toString();
  return qs ? `${ALL_POSTS_PATH}?${qs}` : ALL_POSTS_PATH;
}
