import { TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { POST_CATEGORIES } from "@libs/constants";
import { FOLLOWING_POST_FILTER } from "@libs/shared/postCategory";
import { HOME_SALE_FILTER } from "@libs/shared/homeFeedMix";

/**
 * 웹 홈 '전체 게시글' 필터를 주소 쿼리에 두는 규칙(2026-10-21 커뮤니티 감사 11번).
 * 칩·정렬·종·소분류를 `?category=&sort=&species=&sub=` 로 쓰고 기본값은 생략한다.
 * 글을 보고 뒤로 오면 같은 필터로 돌아오고, 주소를 붙여 넣으면 같은 목록이 열린다.
 * 앱은 스택 화면이 홈 상태를 그대로 들고 있어 이 규칙이 없다(Parity: web-only).
 */

export const FEED_SORTS = ["latest", "popular", "comments"] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export interface FeedState {
  category: string;
  sort: FeedSort;
  species: string;
  /** 소분류. 종이 '전체'면 늘 빈 값이다. */
  sub: string;
}

export const DEFAULT_FEED_STATE: FeedState = { category: "전체", sort: "latest", species: "전체", sub: "" };

/** 밖에서 들어와 목록 제목으로 내려가야 할 때 붙이는 표시(`/?category=동네&at=list`). 읽은 뒤 주소에서 지운다. */
export const FEED_LIST_PARAM = "at";
export const FEED_LIST_VALUE = "list";

const CATEGORY_IDS = new Set<string>([
  "전체",
  FOLLOWING_POST_FILTER,
  HOME_SALE_FILTER,
  ...POST_CATEGORIES.map((c) => c.id),
]);
const SPECIES_IDS = new Set<string>(["전체", ...TOP_LEVEL_CATEGORIES.map((s) => s.id)]);

type ParamsLike = { get(name: string): string | null } | null | undefined;

/** 주소 쿼리 → 필터. 모르는 값은 기본값으로 돌린다(소분류는 화면이 종의 소분류 목록으로 다시 거른다). */
export function parseFeedParams(params: ParamsLike): FeedState {
  const category = params?.get("category") ?? "";
  const sort = params?.get("sort") ?? "";
  const species = params?.get("species") ?? "";
  const validSpecies = SPECIES_IDS.has(species) ? species : DEFAULT_FEED_STATE.species;
  return {
    category: CATEGORY_IDS.has(category) ? category : DEFAULT_FEED_STATE.category,
    sort: (FEED_SORTS as readonly string[]).includes(sort) ? (sort as FeedSort) : DEFAULT_FEED_STATE.sort,
    species: validSpecies,
    sub: validSpecies === DEFAULT_FEED_STATE.species ? "" : (params?.get("sub") ?? "").trim(),
  };
}

/** 필터 → 주소 쿼리 문자열('?' 없음). 기본값은 쓰지 않아 기본 상태면 빈 문자열이다. */
export function feedQuery(state: FeedState): string {
  const query = new URLSearchParams();
  if (state.category !== DEFAULT_FEED_STATE.category) query.set("category", state.category);
  if (state.sort !== DEFAULT_FEED_STATE.sort) query.set("sort", state.sort);
  if (state.species !== DEFAULT_FEED_STATE.species) {
    query.set("species", state.species);
    if (state.sub) query.set("sub", state.sub);
  }
  return query.toString();
}

/** 홈 주소. 쿼리가 없으면 '/'. */
export function feedHref(qs: string): string {
  return qs ? `/?${qs}` : "/";
}

const FEED_KEYS = ["category", "sort", "species", "sub", FEED_LIST_PARAM] as const;

/** 지금 주소 쿼리(current)의 필터 값만 qs 로 바꾼 홈 주소. utm 같은 다른 쿼리는 남기고 at=list 는 지운다. */
export function withFeedQuery(current: string, qs: string): string {
  const others = new URLSearchParams(current);
  for (const key of FEED_KEYS) others.delete(key);
  const next = new URLSearchParams(qs);
  others.forEach((value, key) => next.append(key, value));
  return feedHref(next.toString());
}

/** 글을 보고 돌아왔을 때 불러온 페이지 수·스크롤을 되살리는 기록(sessionStorage). */
export const FEED_RESTORE_PREFIX = "bredy:home:feed:";
export const FEED_RESTORE_TTL_MS = 10 * 60_000;

export interface FeedRestore {
  size: number;
  scrollY: number;
  /** 저장한 시각(ms). */
  at: number;
}

/** 저장된 기록을 읽는다. 형식이 깨졌거나 10분이 지났으면 null. */
export function readFeedRestore(raw: string | null, now: number): FeedRestore | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<FeedRestore>;
    const { size, scrollY, at } = value;
    if (typeof size !== "number" || typeof scrollY !== "number" || typeof at !== "number") return null;
    if (now - at > FEED_RESTORE_TTL_MS || size < 1) return null;
    return { size: Math.min(Math.floor(size), 20), scrollY: Math.max(0, scrollY), at };
  } catch {
    return null;
  }
}
