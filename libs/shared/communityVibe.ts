/**
 * 커뮤니티 참여 유도(docs/prd/community-vibe.md §8) 앱·웹 공통 API 계약 타입.
 * 앱 `src/lib/api/endpoints/communityVibe.ts` 가 같은 모양을 쓴다. 바꾸면 둘 다 고친다.
 */

export type RankingNextActionKind = "post" | "comment" | "bid";

export type RankingMe = {
  rank: number | null;
  score: number;
  delta: number | null;
  /** 목표 순위. 3위 밖이면 3, 3위 안이면 rank-1, 1위면 null. */
  nextRank: number | null;
  nextScore: number | null;
  /** 가중치 역산으로 개수가 가장 적은 활동 하나. */
  nextAction: { kind: RankingNextActionKind; count: number } | null;
  /** 1위일 때 2위와의 점수 차. */
  gapToSecond: number | null;
};

export type NearbyBreederItem = {
  id: number;
  name: string;
  image: string | null;
  topSpecies: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
  /** 시/군/구 중심 좌표 사이 거리(km, 정수). 같은 시/군/구면 0. */
  distanceKm: number;
  sameRegion: boolean;
  isFollowing: boolean;
  badges: string[];
  breederPrograms: string[];
};

export type NearbyBreedersResult = {
  /** 50km 안에 1명 이상이면 near. */
  scope: "near" | "none";
  /** "서울" | "수원시" | "보은군 근처" */
  regionLabel: string;
  total: number;
  /** 이번 주 범위 안 동네 주제 글 수. */
  greetingCount: number;
  items: NearbyBreederItem[];
};

export type NeighborhoodVisitors = { count: number };

export type HotActivityKind = "comment" | "like" | "post";

export type HotRealtimeMeta = {
  lastActivityAt: string;
  lastActivityKind: HotActivityKind;
  hotScore: number;
};

export type UnansweredSummary = { unansweredCount: number };

export type Celebrate = { ordinal: number; fact: string | null };

export type LockedTitleRemainingKind =
  | "post"
  | "comment"
  | "photo"
  | "listing"
  | "auction"
  | "bloodline"
  | "follower"
  | "like";

export type LockedTitle = {
  key: string;
  label: string;
  remaining: { kind: LockedTitleRemainingKind; count: number };
};

export type ProductRailFlags = { isNew: boolean; pinnedFirst: boolean };

export const NEIGHBOR_RADIUS_KM = 50;
export const FIRST_ANSWER_COMMENT_SCORE = 8;
export const PRODUCT_RAIL_NEW_HOURS = 24;
