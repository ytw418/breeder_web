/**
 * 팔로우 상태를 SWR 캐시에 반영하는 순수 함수(앱 useFollowMutation 의 applyFollowState).
 * - 상대 프로필: isFollowing, 팔로워 수 + delta
 * - 내 프로필: 팔로잉 수 + delta
 * - 팔로워·팔로잉 목록 페이지: 그 사람 행의 isFollowing
 * - 동네 브리더(홈 카드, /api/users/nearby): 그 사람 카드의 isFollowing
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

/** SWR 캐시 키 판별. 프로필은 `/api/users/:id`, 팔로우 목록은 무한 목록 키(`$inf$/api/users/:id/followers?...`). */
export const isProfileKey = (key: unknown, userId: number) => key === `/api/users/${userId}`;
export const isFollowListKey = (key: unknown) =>
  typeof key === "string" && /^\$inf\$\/api\/users\/\d+\/(followers|following)\b/.test(key);

/** 반려생활 '팔로잉' 목록(useSWRInfinite) 키. 팔로우·언팔로우 뒤 다시 받는다(앱 ["posts","팔로잉"] 무효화). */
export const isFollowingFeedKey = (key: unknown) =>
  typeof key === "string" && key.includes("/api/posts?") && /[?&]following=1(&|$)/.test(key);

/** 동네 브리더 목록(`/api/users/nearby?limit=…`) 키. 홈 카드의 팔로우 버튼 상태를 맞춘다. */
export const isNearbyKey = (key: unknown) => typeof key === "string" && key.startsWith("/api/users/nearby");
