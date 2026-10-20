/**
 * 팔로우 상태를 SWR 캐시에 반영하는 순수 함수(앱 useFollowMutation 의 applyFollowState).
 * - 상대 프로필: isFollowing, 팔로워 수 + delta
 * - 내 프로필: 팔로잉 수 + delta
 * - 팔로워·팔로잉 목록 페이지: 그 사람 행의 isFollowing
 * - 동네 브리더(홈 카드, /api/users/nearby)·브리더 랭킹(follow=1): 그 사람 행의 isFollowing
 * - 게시글·분양글·경매 상세: 작성자·분양자가 그 사람이면 user.isFollowing(작성자 줄 팔로우 버튼)
 * delta 0 이면 숫자는 두고 상태만 맞춘다(서버 응답으로 바로잡을 때).
 */
export interface FollowCounts {
  followers: number;
  following: number;
}

export interface ProfileLike {
  isFollowing?: boolean;
  user?: { _count: FollowCounts } & Record<string, unknown>;
}

export interface FollowListPageLike {
  users: { id: number; isFollowing: boolean }[];
}

export function withTargetFollowState<T extends ProfileLike>(data: T | undefined, isFollowing: boolean, delta: number) {
  if (!data?.user) return data;
  return {
    ...data,
    isFollowing,
    user: {
      ...data.user,
      _count: { ...data.user._count, followers: Math.max(0, data.user._count.followers + delta) },
    },
  };
}

export function withMyFollowingDelta<T extends ProfileLike>(data: T | undefined, delta: number) {
  if (!data?.user || delta === 0) return data;
  return {
    ...data,
    user: {
      ...data.user,
      _count: { ...data.user._count, following: Math.max(0, data.user._count.following + delta) },
    },
  };
}

export function withFollowListRow<T extends FollowListPageLike>(
  pages: T[] | undefined,
  targetUserId: number,
  isFollowing: boolean
) {
  if (!pages) return pages;
  return pages.map((page) => ({
    ...page,
    users: page.users.map((row) => (row.id === targetUserId ? { ...row, isFollowing } : row)),
  }));
}

export interface NearbyLike {
  items: { user: { id: number }; isFollowing?: boolean }[];
}

export function withNearbyFollowRow<T extends NearbyLike>(
  data: T | undefined,
  targetUserId: number,
  isFollowing: boolean
) {
  if (!data) return data;
  return {
    ...data,
    items: data.items.map((item) => (item.user.id === targetUserId ? { ...item, isFollowing } : item)),
  };
}

/** 상세 응답(`{ post | product | auction: { user } }`)에서 그 사람이 쓴 글이면 user.isFollowing 을 바꾼다. */
export type DetailEntityField = "post" | "product" | "auction";

export function withDetailAuthorFollow<T>(
  data: T | undefined,
  field: DetailEntityField,
  targetUserId: number,
  isFollowing: boolean
): T | undefined {
  const entity = (data as Record<string, { user?: { id?: number } } | undefined> | undefined)?.[field];
  if (!entity?.user || entity.user.id !== targetUserId) return data;
  return { ...data, [field]: { ...entity, user: { ...entity.user, isFollowing } } } as T;
}

/** SWR 캐시 키 판별. 프로필은 `/api/users/:id`, 팔로우 목록은 무한 목록 키(`$inf$/api/users/:id/followers?...`). */
export const isProfileKey = (key: unknown, userId: number) => key === `/api/users/${userId}`;
export const isFollowListKey = (key: unknown) =>
  typeof key === "string" && /^\$inf\$\/api\/users\/\d+\/(followers|following)\b/.test(key);

/** 반려생활 '팔로잉' 목록(useSWRInfinite) 키. 팔로우·언팔로우 뒤 다시 받는다(앱 ["posts","팔로잉"] 무효화). */
export const isFollowingFeedKey = (key: unknown) =>
  typeof key === "string" && key.includes("/api/posts?") && /[?&]following=1(&|$)/.test(key);

/** 동네 브리더 목록(`/api/users/nearby?limit=…`) 키. 홈 카드의 팔로우 버튼 상태를 맞춘다. */
export const isNearbyKey = (key: unknown) => typeof key === "string" && key.startsWith("/api/users/nearby");

/** 게시글·분양글·경매 상세(`/api/posts/:id` 등) 키. 작성자 줄 팔로우 버튼 상태를 맞춘다. */
export const isPostDetailKey = (key: unknown) => typeof key === "string" && /^\/api\/posts\/\d+$/.test(key);
export const isProductDetailKey = (key: unknown) => typeof key === "string" && /^\/api\/products\/\d+$/.test(key);
export const isAuctionDetailKey = (key: unknown) => typeof key === "string" && /^\/api\/auctions\/\d+$/.test(key);

/** 브리더 랭킹(`/api/rankings/breeders?...follow=1`) 키. 행 팔로우 버튼 상태를 맞춘다(모양은 동네 목록과 같은 items[].user). */
export const isRankingKey = (key: unknown) =>
  typeof key === "string" && key.startsWith("/api/rankings/breeders") && /[?&]follow=1(&|$)/.test(key);
