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

/**
 * GET /api/users/nearby 항목. 옛 앱(2026-10-09 홈 동네 섹션)이 `topSpecies: string[]`·`breederPrograms: 요약 객체[]`
 * 를 읽다가 모양이 바뀌면 죽으므로, 새 값은 `species`·`programTypes` 라는 새 이름으로 싣고 옛 이름은 옛 모양 그대로 둔다
 * (서버는 옛 필드 `user`·`region`·`postsCount`·`commentsCount`·`topSpecies`·`breederPrograms` 도 같이 보낸다).
 */
export type NearbyBreederItem = {
  id: number;
  name: string;
  image: string | null;
  /** 주력 종 하나(대표 라벨). 없으면 null. */
  species: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
  /** 시/군/구 중심 좌표 사이 거리(km, 정수). 같은 시/군/구면 0. */
  distanceKm: number;
  sameRegion: boolean;
  isFollowing: boolean;
  badges: string[];
  /** 활성 브리더 프로그램 타입(programType) 목록. */
  programTypes: string[];
  /** 내가 이미 손 흔들어 인사했는지(libs/shared/chatWave.ts). 옛 서버는 없다. */
  waved?: boolean;
};

export type NearbyBreedersResult = {
  /** 50km 안에 1명 이상이면 near. */
  scope: "near" | "none";
  /** "서울" | "수원시" | "보은군 근처" */
  regionLabel: string;
  total: number;
  /** 이번 주 범위 안 동네 주제 글 수. */
  greetingCount: number;
  /** 오늘(KST) 더 인사할 수 있는 수. 동네 미설정 응답엔 없다. */
  wavesLeftToday?: number;
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
