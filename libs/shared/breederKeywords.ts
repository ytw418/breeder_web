import {
  BREEDER_SCORE_WEIGHTS,
  SCOPED_BREEDER_SCORE_WEIGHTS,
  type BloodlineRankingItem,
  type BreederRankingItem,
} from "@libs/shared/ranking";
import type { LockedTitle, LockedTitleRemainingKind } from "@libs/shared/communityVibe";

/**
 * TOP 브리더 칭호(앱 src/lib/breederKeywords.ts). 반려생활 TOP 브리더 행과 홈 '이번 주 TOP 브리더' 카드가 쓴다.
 * 하는 활동은 '○○왕', 쌓이는 것은 '○○ 부자', 사진만 '사진 맛집'으로 부른다(2026-10-09 사용자 "다 왕으로 하지 말고 센스 있게").
 */

/** 활동 지표. 요약·칭호 근거 문구가 같은 이름을 쓴다(그래야 요약에 이미 있는 근거를 다시 붙이지 않는다). */
const STATS = {
  postsCount: { name: "게시글", unit: "개" },
  productsCount: { name: "분양글", unit: "개" },
  commentsCount: { name: "댓글", unit: "개" },
  bidsCount: { name: "입찰", unit: "회" },
  auctionWinsCount: { name: "낙찰", unit: "건" },
  sellerEndedAuctionsCount: { name: "경매 성사", unit: "건" },
  bloodlines: { name: "혈통", unit: "개" },
  photosCount: { name: "사진", unit: "장" },
  likesReceivedCount: { name: "받은 좋아요", unit: "개" },
  followersCount: { name: "팔로워", unit: "명" },
} as const;

type StatKey = keyof typeof STATS;

/**
 * 칭호 묶음. 값은 묶음 안 지표의 합이다. 비율이 같으면 앞에 있는 칭호를 먼저 고른다
 * (게시글은 가장 흔한 활동이라 맨 뒤).
 */
const TITLES = [
  { key: "auction", label: "경매왕", stats: ["auctionWinsCount", "sellerEndedAuctionsCount", "bidsCount"] },
  { key: "listing", label: "분양왕", stats: ["productsCount"] },
  { key: "bloodline", label: "혈통 부자", stats: ["bloodlines"] },
  { key: "talk", label: "소통왕", stats: ["commentsCount"] },
  { key: "follower", label: "팔로워 부자", stats: ["followersCount"] },
  { key: "like", label: "좋아요 부자", stats: ["likesReceivedCount"] },
  { key: "photo", label: "사진 맛집", stats: ["photosCount"] },
  { key: "post", label: "기록왕", stats: ["postsCount"] },
] as const satisfies readonly { key: string; label: string; stats: readonly StatKey[] }[];

type TitleEntry = (typeof TITLES)[number];
export type BreederTitleKey = TitleEntry["key"];
/** 칭호마다 stats 튜플 타입이 달라 그대로는 reduce·flatMap 을 부를 수 없어 넓힌다. */
const statsOf = (title: TitleEntry): readonly StatKey[] => title.stats;

/** 활동 요약 순서(점수 기준 시트 순서와 같다). 점수에 들어가는 활동만. */
const SUMMARY_ORDER = [
  "postsCount",
  "productsCount",
  "commentsCount",
  "bidsCount",
  "auctionWinsCount",
  "sellerEndedAuctionsCount",
] as const satisfies readonly StatKey[];
const SUMMARY_MAX_PARTS = 3;
/** 칭호를 붙일 최소 값. 이보다 작은 값은 3 이상인 칭호가 하나도 없을 때만 고른다('팔로워 1명 부자' 방지). */
const KEYWORD_MIN_VALUE = 3;

export interface BreederKeyword {
  key: BreederTitleKey;
  /** 예: "경매왕", "팔로워 부자". 운영 UI 에 이모지를 쓰지 않는다(2026-10-12, 앱 community-vibe §3.7). */
  label: string;
  /** 칭호 근거. 예: "낙찰 1건 · 입찰 1회" */
  detail: string;
  /** detail 을 이루는 조각. 활동 요약이 이미 보여 주는 조각은 다시 붙이지 않는다. */
  parts: string[];
}

const formatStat = (stat: StatKey, value: number) => `${STATS[stat].name} ${value.toLocaleString()}${STATS[stat].unit}`;

/**
 * 혈통 외 지표 값. 분양글은 관심 카테고리 범위 랭킹이면 범위 안 상품 수(점수), 아니면 서버 highlight 의 전체 상품 수.
 * 사진·받은 좋아요·팔로워는 서버가 `highlight` 를 붙인 사람만 값이 있다.
 */
const statValue = (item: BreederRankingItem, stat: Exclude<StatKey, "bloodlines">): number => {
  if (stat === "productsCount") return item.productsCount ?? item.highlight?.productsCount ?? 0;
  if (stat === "photosCount" || stat === "likesReceivedCount" || stat === "followersCount") {
    return item.highlight?.[stat] ?? 0;
  }
  return item[stat] ?? 0;
};

/**
 * 상위 `count` 명에게 칭호를 하나씩 붙인다.
 * 각 칭호 값(묶음 안 지표의 합)을 목록 전체의 최댓값으로 나눈 비율이 가장 큰 칭호를 고르고, 앞 순위가 가져간 칭호는
 * 되도록 다시 쓰지 않는다(세 명이 모두 '소통왕'이 되지 않게). 고르는 순서: ① 안 가져간 칭호 중 값 3 이상
 * ② 가져간 칭호 포함 3 이상 ③ 0보다 큰 아무 칭호. 그래서 활동이 있으면 빈칸이 생기지 않는다.
 * 혈통 수는 혈통 랭킹(상위 50)에서 그 사람이 만든 혈통 개수다.
 */
export function pickBreederKeywords(
  breeders: BreederRankingItem[],
  bloodlines: BloodlineRankingItem[],
  count: number,
): (BreederKeyword | null)[] {
  const bloodlineCount = new Map<number, number>();
  for (const b of bloodlines) {
    bloodlineCount.set(b.creator.id, (bloodlineCount.get(b.creator.id) ?? 0) + 1);
  }
  const valueOf = (item: BreederRankingItem, stat: StatKey) =>
    stat === "bloodlines" ? bloodlineCount.get(item.user.id) ?? 0 : statValue(item, stat);
  const titleValue = (item: BreederRankingItem, title: TitleEntry) =>
    statsOf(title).reduce((sum, stat) => sum + valueOf(item, stat), 0);

  const max = new Map<BreederTitleKey, number>(
    TITLES.map((title) => [title.key, Math.max(0, ...breeders.map((item) => titleValue(item, title)))]),
  );

  const pick = (item: BreederRankingItem, skip: Set<BreederTitleKey>, minValue: number) => {
    let best: TitleEntry | null = null;
    let bestRatio = 0;
    for (const title of TITLES) {
      if (skip.has(title.key)) continue;
      const top = max.get(title.key) ?? 0;
      const value = titleValue(item, title);
      if (top <= 0 || value <= 0 || value < minValue) continue;
      const ratio = value / top;
      if (ratio > bestRatio) {
        best = title;
        bestRatio = ratio;
      }
    }
    return best;
  };

  const taken = new Set<BreederTitleKey>();
  return breeders.slice(0, count).map((item) => {
    const title =
      pick(item, taken, KEYWORD_MIN_VALUE) ?? pick(item, new Set(), KEYWORD_MIN_VALUE) ?? pick(item, new Set(), 0);
    if (!title) return null;
    taken.add(title.key);
    const parts = statsOf(title).flatMap((stat) => {
      const value = valueOf(item, stat);
      return value > 0 ? [formatStat(stat, value)] : [];
    });
    return { key: title.key, label: title.label, detail: parts.join(" · "), parts };
  });
}

/**
 * 이름 아래 활동 요약. 예: "게시글 16개 · 입찰 2회 · 낙찰 1건".
 * 점수에 들어간 활동 중 0이 아닌 것을 순서대로 보여 주고, 칭호 근거 중 요약에 없는 조각(팔로워·사진 등)을 끝에 붙인다.
 * 최대 세 개. 분양글은 관심 카테고리 범위 랭킹(서버가 productsCount 를 채움)에서만 점수 활동이다.
 */
export function summarizeBreederActivity(item: BreederRankingItem, keyword: BreederKeyword | null): string {
  const parts = SUMMARY_ORDER.flatMap((stat) => {
    const value = stat === "productsCount" ? item.productsCount ?? 0 : statValue(item, stat);
    return value > 0 ? [formatStat(stat, value)] : [];
  });
  const missing = keyword ? keyword.parts.filter((part) => !parts.includes(part)) : [];
  if (missing.length > 0) {
    return [...parts.slice(0, Math.max(SUMMARY_MAX_PARTS - missing.length, 0)), ...missing]
      .slice(0, SUMMARY_MAX_PARTS)
      .join(" · ");
  }
  return parts.slice(0, SUMMARY_MAX_PARTS).join(" · ");
}

export interface BreederScoreRule {
  label: string;
  /** 보조 설명. 예: "내가 이긴 경매" */
  hint?: string;
  points: number;
}

/**
 * '점수 기준' 시트 행. 서버 점수식(scoreBreeder·scoreScopedBreeder)과 같은 가중치를 쓴다.
 * 관심 카테고리 범위 랭킹이면 범위 안 게시글·분양글(가중치가 0 이 아닌 경매·혈통 포함)만 센다.
 */
export function getBreederScoreRules(scoped: boolean): BreederScoreRule[] {
  if (scoped) {
    const w = SCOPED_BREEDER_SCORE_WEIGHTS;
    return [
      { label: "게시글 1개", points: w.post },
      { label: "분양글 1개", hint: "유료·무료 분양 포함", points: w.product },
      { label: "경매 1건", points: w.auction },
      { label: "혈통 1개", hint: "내가 만든 혈통", points: w.bloodline },
    ].filter((rule) => rule.points > 0);
  }
  const w = BREEDER_SCORE_WEIGHTS;
  return [
    { label: "게시글 1개", points: w.post },
    { label: "댓글 1개", points: w.comment },
    { label: "경매 입찰 1회", points: w.bid },
    { label: "경매 낙찰 1건", hint: "내가 이긴 경매", points: w.auctionWin },
    { label: "경매 거래 성사 1건", hint: "내가 연 경매", points: w.sellerEndedAuction },
  ];
}

/**
 * 칭호 잠금 pill 임계값(앱 docs/prd/community-vibe.md §8). 본인 프로필의 '아직 못 단 칭호'에 쓴다.
 * 값은 전체 기간 누적: 경매왕 = 입찰 + 연 경매, 분양왕 = 분양글, 혈통 부자 = 만든 혈통, 소통왕 = 댓글,
 * 팔로워 부자 = 팔로워, 좋아요 부자 = 받은 좋아요, 사진 맛집 = 게시글 사진, 기록왕 = 게시글.
 */
export const TITLE_THRESHOLDS: Readonly<Record<BreederTitleKey, { kind: LockedTitleRemainingKind; count: number }>> = {
  auction: { kind: "auction", count: 3 },
  listing: { kind: "listing", count: 3 },
  bloodline: { kind: "bloodline", count: 3 },
  talk: { kind: "comment", count: 5 },
  follower: { kind: "follower", count: 10 },
  like: { kind: "like", count: 10 },
  photo: { kind: "photo", count: 5 },
  post: { kind: "post", count: 3 },
};

export interface LockedTitleStats {
  postsCount: number;
  productsCount: number;
  commentsCount: number;
  /** 입찰 수 */
  bidsCount: number;
  /** 연 경매 수 */
  auctionsCount: number;
  bloodlinesCount: number;
  followersCount: number;
  likesReceivedCount: number;
  photosCount: number;
}

const LOCKED_VALUE: Record<BreederTitleKey, (s: LockedTitleStats) => number> = {
  auction: (s) => s.bidsCount + s.auctionsCount,
  listing: (s) => s.productsCount,
  bloodline: (s) => s.bloodlinesCount,
  talk: (s) => s.commentsCount,
  follower: (s) => s.followersCount,
  like: (s) => s.likesReceivedCount,
  photo: (s) => s.photosCount,
  post: (s) => s.postsCount,
};

/** 단 칭호(임계값 이상)의 key 목록. TITLES 순서. */
export function unlockedTitleKeys(stats: LockedTitleStats): BreederTitleKey[] {
  return TITLES.filter((title) => LOCKED_VALUE[title.key](stats) >= TITLE_THRESHOLDS[title.key].count).map(
    (title) => title.key,
  );
}

/**
 * 아직 못 단 칭호 중 남은 양이 적은 순 limit 개(같으면 TITLES 순서). "소통왕까지 댓글 2" 의 재료.
 */
export function pickLockedTitles(stats: LockedTitleStats, limit = 3): LockedTitle[] {
  return TITLES.flatMap((title, order) => {
    const threshold = TITLE_THRESHOLDS[title.key];
    const remaining = threshold.count - Math.max(0, LOCKED_VALUE[title.key](stats));
    return remaining > 0 ? [{ title, order, remaining, kind: threshold.kind }] : [];
  })
    .sort((a, b) => a.remaining - b.remaining || a.order - b.order)
    .slice(0, limit)
    .map(({ title, remaining, kind }) => ({
      key: title.key,
      label: title.label,
      remaining: { kind, count: remaining },
    }));
}

const REMAINING_LABEL: Record<LockedTitleRemainingKind, string> = {
  post: "글",
  comment: "댓글",
  photo: "사진",
  listing: "분양글",
  auction: "입찰·경매",
  bloodline: "혈통",
  follower: "팔로워",
  like: "좋아요",
};

/** 잠금 pill 문구. "소통왕까지 댓글 2" */
export function lockedTitleLabel(title: Pick<LockedTitle, "label" | "remaining">): string {
  return `${title.label}까지 ${REMAINING_LABEL[title.remaining.kind]} ${title.remaining.count}`;
}

const TITLE_LABEL = new Map<string, string>(TITLES.map((title) => [title.key, title.label]));

/** DB 문자열(User.titleKey)이 지금 있는 칭호 key 인지. */
export function isBreederTitleKey(value: unknown): value is BreederTitleKey {
  return typeof value === "string" && TITLE_LABEL.has(value);
}

/** 칭호 key → 이름("talk" → "소통왕"). 모르는 값·null 이면 null(없어진 key 가 DB 에 남아도 pill 을 그리지 않는다). */
export function titleLabelOf(key: string | null | undefined): string | null {
  return key ? TITLE_LABEL.get(key) ?? null : null;
}

/** 칭호 조건 시트 문구의 활동 부분(TITLE_THRESHOLDS 값을 넣는다). */
const CONDITION_LABEL: Record<LockedTitleRemainingKind, (n: number) => string> = {
  post: (n) => `게시글 ${n}개`,
  comment: (n) => `댓글 ${n}개`,
  photo: (n) => `게시글 사진 ${n}장`,
  listing: (n) => `분양글 ${n}개`,
  auction: (n) => `입찰과 연 경매를 합쳐 ${n}번`,
  bloodline: (n) => `내가 만든 혈통 ${n}개`,
  follower: (n) => `팔로워 ${n}명`,
  like: (n) => `받은 좋아요 ${n}개`,
};

/** 딴 칭호 pill 을 누르면 뜨는 조건 시트 문구. "댓글 5개 이상이면 달려요" */
export function titleConditionText(key: BreederTitleKey): string {
  const threshold = TITLE_THRESHOLDS[key];
  return `${CONDITION_LABEL[threshold.kind](threshold.count)} 이상이면 달려요`;
}

/**
 * 대표 칭호(User.titleKey, 작성자 줄 pill). 각 사람이 단 칭호(unlockedTitleKeys) 중에서
 * pickBreederKeywords 의 1순위 규칙대로 고른다 — 칭호 값을 목록 전체 최댓값으로 나눈 비율이 가장 큰 것, 같으면 TITLES 순서.
 * statsList 는 랭킹 대상 전체(서버 libs/server/breederTitles.ts). 단 칭호가 없으면 null.
 */
export function pickRepresentativeTitleKeys(statsList: readonly LockedTitleStats[]): (BreederTitleKey | null)[] {
  const max = new Map<BreederTitleKey, number>(
    TITLES.map((title) => [
      title.key,
      statsList.reduce((top, stats) => Math.max(top, LOCKED_VALUE[title.key](stats)), 0),
    ]),
  );
  return statsList.map((stats) => {
    let best: BreederTitleKey | null = null;
    let bestRatio = 0;
    for (const key of unlockedTitleKeys(stats)) {
      const top = max.get(key) ?? 0;
      if (top <= 0) continue;
      const ratio = LOCKED_VALUE[key](stats) / top;
      if (ratio > bestRatio) {
        best = key;
        bestRatio = ratio;
      }
    }
    return best;
  });
}
