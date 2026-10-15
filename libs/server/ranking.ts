import client from "@libs/server/client";
import { RANKABLE_USER_WHERE } from "@libs/server/rankableUser";
import {
  AuctionPeriodScope,
  AuctionRankingItem,
  BloodlineRankingItem,
  BREEDER_HIGHLIGHT_PHOTOS,
  BREEDER_SCORE_WEIGHTS,
  BreederHighlight,
  BreederRankingItem,
  CommunityWindow,
  FreeProductItem,
  HotDiscussionItem,
  RankingMeSummary,
  RankingPeriod,
  SeasonBadgeItem,
  TrendingPostItem,
  SCOPED_BREEDER_SCORE_WEIGHTS,
  scoreScopedBreeder,
  FIRST_ANSWER_COMMENT_SCORE,
  AuctionActivityRankingItem,
  ListingsRankingItem,
  RankedUserItem,
} from "@libs/shared/ranking";
import { LISTING_METRIC, scoreAuctionActivity, type ListingMetric } from "@libs/shared/rankingTypes";
import type { RankingMe, RankingNextActionKind } from "@libs/shared/communityVibe";
import { categoryScopeWhere, resolveScopeCategoryIds, speciesCategoryIds } from "@libs/server/categories";
import {
  findCategoryBranch,
  getCategoryFilterValues,
  TOP_LEVEL_CATEGORIES,
} from "@libs/categoryTaxonomy";
import {
  getKstWeekWindow,
  getMonthWindow,
  getPreviousKstWeekWindow,
  getPreviousMonthWindow,
} from "@libs/server/season";
import { ensureAlertSubscription, ensureCurrentWeeklySeason } from "@libs/server/growth";

type CountRow = { key: number; count: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const toCountMap = (rows: CountRow[]) => new Map(rows.map((row) => [row.key, row.count]));

const badgeMapByUser = (rows: Array<{ userId: number; id: number; badgeType: SeasonBadgeItem["badgeType"]; rank: number; label: string; createdAt: Date }>) => {
  const map = new Map<number, SeasonBadgeItem[]>();
  for (const row of rows) {
    const current = map.get(row.userId) ?? [];
    if (current.length >= 3) continue;
    current.push({
      id: row.id,
      badgeType: row.badgeType,
      rank: row.rank,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
    });
    map.set(row.userId, current);
  }
  return map;
};

// 홈 피드와 개별 랭킹 API, 테스트가 같은 가중치를 공유하도록 점수식을 순수 함수로 뺐다.
// 질문 글의 첫 답변(firstAnswersCount)은 commentsCount 에도 들어 있으므로 차액만 더한다(댓글 4 → 8).
export const scoreBreeder = ({
  postsCount,
  commentsCount,
  bidsCount,
  auctionWinsCount,
  sellerEndedAuctionsCount,
  firstAnswersCount = 0,
}: {
  postsCount: number;
  commentsCount: number;
  bidsCount: number;
  auctionWinsCount: number;
  sellerEndedAuctionsCount: number;
  firstAnswersCount?: number;
}) =>
  postsCount * BREEDER_SCORE_WEIGHTS.post +
  commentsCount * BREEDER_SCORE_WEIGHTS.comment +
  Math.min(firstAnswersCount, commentsCount) * (FIRST_ANSWER_COMMENT_SCORE - BREEDER_SCORE_WEIGHTS.comment) +
  bidsCount * BREEDER_SCORE_WEIGHTS.bid +
  auctionWinsCount * BREEDER_SCORE_WEIGHTS.auctionWin +
  sellerEndedAuctionsCount * BREEDER_SCORE_WEIGHTS.sellerEndedAuction;


/**
 * 사용자별 '질문 첫 답변' 수. 질문 글(숨김 아님)의 보이는 루트 댓글 중 글쓴이 본인·운영 계정을 뺀 가장 이른 댓글이
 * 기간 안에 달렸으면 그 댓글 작성자에게 1을 센다. window 가 없으면 전체 기간.
 */
export const countFirstAnswers = async (
  window?: { startAt: Date; endAt: Date } | null
): Promise<CountRow[]> => {
  const eligible = {
    isHidden: false,
    deletedAt: null,
    parentId: null,
    post: { category: "질문", isHidden: false },
    user: RANKABLE_USER_WHERE,
  };
  const select = { id: true, postId: true, userId: true, createdAt: true, post: { select: { userId: true } } };
  const rows = await client.comment.findMany({
    where: { ...eligible, ...(window ? { createdAt: { gte: window.startAt, lte: window.endAt } } : {}) },
    select,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const firstByPost = new Map<number, number>();
  for (const row of rows) {
    if (row.userId === row.post.userId || firstByPost.has(row.postId)) continue;
    firstByPost.set(row.postId, row.userId);
  }
  if (window && firstByPost.size > 0) {
    // 기간 전에 이미 첫 답변이 달린 글은 뺀다.
    const earlier = await client.comment.findMany({
      where: { ...eligible, postId: { in: Array.from(firstByPost.keys()) }, createdAt: { lt: window.startAt } },
      select,
    });
    for (const row of earlier) {
      if (row.userId !== row.post.userId) firstByPost.delete(row.postId);
    }
  }
  const counts = new Map<number, number>();
  firstByPost.forEach((userId) => counts.set(userId, (counts.get(userId) ?? 0) + 1));
  return Array.from(counts, ([key, count]) => ({ key, count }));
};

/** 내 순위 줄 목표(홈 카드에 보이는 3위). */
const RANKING_GOAL_RANK = 3;
const NEXT_ACTION_WEIGHTS: ReadonlyArray<[RankingNextActionKind, number]> = [
  ["post", BREEDER_SCORE_WEIGHTS.post],
  ["comment", BREEDER_SCORE_WEIGHTS.comment],
  ["bid", BREEDER_SCORE_WEIGHTS.bid],
];

/** 필요한 점수를 채우는 활동 중 개수가 가장 적은 것(같으면 글 → 댓글 → 입찰). */
export const pickNextAction = (needed: number): RankingMe["nextAction"] => {
  if (needed <= 0) return null;
  let best: RankingMe["nextAction"] = null;
  for (const [kind, weight] of NEXT_ACTION_WEIGHTS) {
    const count = Math.ceil(needed / weight);
    if (!best || count < best.count) best = { kind, count };
  }
  return best;
};

/**
 * 내 순위 목표 계산(앱 docs/prd/community-vibe.md §3.2, §8 RankingMe).
 * - 목표 순위: 3위 밖(순위 없음 포함)이면 3위, 3위 안이면 바로 위(rank-1), 1위면 없음.
 * - 목표 점수(nextScore): 그 순위 사람 점수 + 1(동점은 이름순이라 넘어서야 확실히 오른다).
 *   그 순위에 아무도 없으면(랭킹 인원이 적음) 1점만 있어도 오른다.
 * - nextAction: (nextScore - score) 를 가중치로 나눠 개수가 가장 적은 활동.
 * - gapToSecond: 1위일 때 2위와 점수 차(2위가 없으면 내 점수).
 */
export const computeRankingMe = (
  ranking: ReadonlyArray<Pick<BreederRankingItem, "rank" | "score" | "previousRank" | "rankDelta"> & { user: { id: number } }>,
  userId: number
): RankingMe => {
  const me = ranking.find((item) => item.user.id === userId) ?? null;
  const rank = me?.rank ?? null;
  const score = me?.score ?? 0;
  const delta = me && me.previousRank !== null ? me.rankDelta : null;
  if (rank === 1) {
    const second = ranking.find((item) => item.user.id !== userId);
    return { rank, score, delta, nextRank: null, nextScore: null, nextAction: null, gapToSecond: score - (second?.score ?? 0) };
  }
  const others = ranking.filter((item) => item.user.id !== userId);
  const goal = rank === null || rank > RANKING_GOAL_RANK ? RANKING_GOAL_RANK : rank - 1;
  const holder = others[goal - 1];
  const nextRank = holder ? goal : Math.min(goal, others.length + 1);
  const nextScore = holder ? holder.score + 1 : Math.max(1, score);
  return {
    rank,
    score,
    delta,
    nextRank,
    nextScore,
    nextAction: pickNextAction(nextScore - score),
    gapToSecond: null,
  };
};

export const scoreBloodline = ({
  followCount,
  tradeCount,
  avgClosingPrice,
  growthRate7d,
}: {
  followCount: number;
  tradeCount: number;
  avgClosingPrice: number;
  growthRate7d: number;
}) => {
  const growthScore = clamp(growthRate7d * 20, -20, 20);
  return followCount * 4 + tradeCount * 10 + Math.min(avgClosingPrice / 10000, 40) + growthScore;
};

export const scoreTrendingPost = ({
  likes24h,
  comments24h,
}: {
  likes24h: number;
  comments24h: number;
}) => likes24h * 3 + comments24h * 5;

const fetchUserBadges = async (userIds: number[]) => {
  if (userIds.length === 0) return new Map<number, SeasonBadgeItem[]>();
  const rows = await client.userBadge.findMany({
    where: { userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      badgeType: true,
      rank: true,
      label: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { rank: "asc" }],
  });
  return badgeMapByUser(rows);
};

const countByGroup = async (
  model:
    | "post"
    | "product"
    | "comment"
    | "bid"
    | "auctionByWinner"
    | "auctionBySeller"
    | "bloodlineByCreator"
    | "bloodlineFollow"
    | "likeByPost"
    | "commentByPost",
  where: Record<string, unknown>
): Promise<CountRow[]> => {
  if (model === "post") {
    const rows = await client.post.groupBy({ by: ["userId"], where, _count: { _all: true } });
    return rows.map((row) => ({ key: row.userId, count: row._count._all }));
  }
  if (model === "product") {
    const rows = await client.product.groupBy({ by: ["userId"], where, _count: { _all: true } });
    return rows.map((row) => ({ key: row.userId, count: row._count._all }));
  }
  if (model === "comment") {
    const rows = await client.comment.groupBy({ by: ["userId"], where, _count: { _all: true } });
    return rows.map((row) => ({ key: row.userId, count: row._count._all }));
  }
  if (model === "bid") {
    // 경매를 다시 시작하면 지난 회차 입찰(archivedAt)은 초기화된 것으로 보고 점수·입찰 수에서 뺀다.
    const rows = await client.bid.groupBy({
      by: ["userId"],
      where: { ...where, archivedAt: null },
      _count: { _all: true },
    });
    return rows.map((row) => ({ key: row.userId, count: row._count._all }));
  }
  if (model === "auctionByWinner") {
    const rows = await client.auction.groupBy({ by: ["winnerId"], where, _count: { _all: true } });
    return rows
      .filter((row) => row.winnerId !== null)
      .map((row) => ({ key: row.winnerId as number, count: row._count._all }));
  }
  if (model === "auctionBySeller") {
    const rows = await client.auction.groupBy({ by: ["userId"], where, _count: { _all: true } });
    return rows.map((row) => ({ key: row.userId, count: row._count._all }));
  }
  if (model === "bloodlineByCreator") {
    const rows = await client.bloodlineCard.groupBy({ by: ["creatorId"], where, _count: { _all: true } });
    return rows.map((row) => ({ key: row.creatorId, count: row._count._all }));
  }
  if (model === "bloodlineFollow") {
    const rows = await client.bloodlineFollow.groupBy({
      by: ["bloodlineRootId"],
      where,
      _count: { _all: true },
    });
    return rows.map((row) => ({ key: row.bloodlineRootId, count: row._count._all }));
  }
  if (model === "likeByPost") {
    const rows = await client.like.groupBy({ by: ["postId"], where, _count: { _all: true } });
    return rows.map((row) => ({ key: row.postId, count: row._count._all }));
  }
  const rows = await client.comment.groupBy({ by: ["postId"], where, _count: { _all: true } });
  return rows.map((row) => ({ key: row.postId, count: row._count._all }));
};

const getRankMap = <T extends { key: number; score: number }>(items: T[]) =>
  new Map(items.map((item, index) => [item.key, { rank: index + 1, score: item.score }]));

type RankingWindow = { startAt: Date; endAt: Date };

/** 기간 → 이번 기간·지난 기간(KST). 역대는 둘 다 null(전체, 순위 변동 없음). */
export const resolveRankingWindows = (
  period: RankingPeriod,
  baseDate?: Date
): { current: RankingWindow | null; previous: RankingWindow | null } => {
  if (period === "weekly") {
    return { current: getKstWeekWindow(baseDate), previous: getPreviousKstWeekWindow(baseDate) };
  }
  if (period === "monthly") {
    return { current: getMonthWindow(baseDate), previous: getPreviousMonthWindow(baseDate) };
  }
  return { current: null, previous: null };
};

const createdIn = (window: RankingWindow | null) =>
  window ? { createdAt: { gte: window.startAt, lte: window.endAt } } : {};
const endedIn = (window: RankingWindow | null) =>
  window ? { endAt: { gte: window.startAt, lte: window.endAt } } : {};

/**
 * 카테고리 범위(고정) 탑브리더. 범위 안 게시글·상품만 세고 scoreScopedBreeder 로 점수를 매긴다.
 * 전체 랭킹(scoreBreeder)과 점수식이 달라 섞어 비교하지 않는다.
 */
const getScopedBreederRanking = async ({
  limit,
  period,
  baseDate,
  categoryIds,
}: {
  limit: number;
  period: RankingPeriod;
  baseDate?: Date;
  categoryIds: number[];
}): Promise<BreederRankingItem[]> => {
  if (categoryIds.length === 0) return [];
  const { current, previous } = resolveRankingWindows(period, baseDate);
  const scopeFilter = { categoryId: { in: categoryIds } };
  const postBase = { ...scopeFilter, isHidden: false, category: { not: "공지" } };
  const productBase = { ...scopeFilter, isHidden: false, isDeleted: false };
  // 경매·혈통은 가중치가 0 이면 세지 않는다(구조만, SCOPED_BREEDER_SCORE_WEIGHTS).
  const auctionBase = { ...scopeFilter, isHidden: false };
  const bloodlineBase = { ...scopeFilter, cardType: "BLOODLINE" as const, status: "ACTIVE" as const };
  const countAuctions = SCOPED_BREEDER_SCORE_WEIGHTS.auction > 0;
  const countBloodlines = SCOPED_BREEDER_SCORE_WEIGHTS.bloodline > 0;
  const windowOf = createdIn;
  const optionalCount = (
    enabled: boolean,
    model: "auctionBySeller" | "bloodlineByCreator",
    where: Record<string, unknown>
  ) => (enabled ? countByGroup(model, where) : Promise.resolve([] as CountRow[]));

  const [users, currentPosts, currentProducts, currentAuctions, currentBloodlines] = await Promise.all([
    client.user.findMany({
      where: RANKABLE_USER_WHERE,
      select: { id: true, name: true, avatar: true },
    }),
    countByGroup("post", {
      ...postBase,
      ...windowOf(current),
    }),
    countByGroup("product", {
      ...productBase,
      ...windowOf(current),
    }),
    optionalCount(countAuctions, "auctionBySeller", {
      ...auctionBase,
      ...windowOf(current),
    }),
    optionalCount(countBloodlines, "bloodlineByCreator", {
      ...bloodlineBase,
      ...windowOf(current),
    }),
  ]);
  const [previousPosts, previousProducts, previousAuctions, previousBloodlines] =
    previous
      ? await Promise.all([
          countByGroup("post", { ...postBase, ...windowOf(previous) }),
          countByGroup("product", { ...productBase, ...windowOf(previous) }),
          optionalCount(countAuctions, "auctionBySeller", { ...auctionBase, ...windowOf(previous) }),
          optionalCount(countBloodlines, "bloodlineByCreator", { ...bloodlineBase, ...windowOf(previous) }),
        ])
      : [[], [], [], []];

  const maps = {
    currentPosts: toCountMap(currentPosts),
    currentProducts: toCountMap(currentProducts),
    currentAuctions: toCountMap(currentAuctions),
    currentBloodlines: toCountMap(currentBloodlines),
    previousPosts: toCountMap(previousPosts),
    previousProducts: toCountMap(previousProducts),
    previousAuctions: toCountMap(previousAuctions),
    previousBloodlines: toCountMap(previousBloodlines),
  };

  const currentScored = users
    .map((user) => {
      const counts = {
        postsCount: maps.currentPosts.get(user.id) ?? 0,
        productsCount: maps.currentProducts.get(user.id) ?? 0,
        auctionsCount: maps.currentAuctions.get(user.id) ?? 0,
        bloodlinesCount: maps.currentBloodlines.get(user.id) ?? 0,
      };
      return { key: user.id, user, ...counts, score: scoreScopedBreeder(counts) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.user.name.localeCompare(b.user.name, "ko"));

  const previousScored = users
    .map((user) => ({
      key: user.id,
      score: scoreScopedBreeder({
        postsCount: maps.previousPosts.get(user.id) ?? 0,
        productsCount: maps.previousProducts.get(user.id) ?? 0,
        auctionsCount: maps.previousAuctions.get(user.id) ?? 0,
        bloodlinesCount: maps.previousBloodlines.get(user.id) ?? 0,
      }),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.key - b.key);

  const previousRankMap = getRankMap(previousScored);
  const top = currentScored.slice(0, limit);
  const badgeMap = await fetchUserBadges(top.map((item) => item.key));

  return top.map((item, index) => {
    const previousMeta = previousRankMap.get(item.key);
    return {
      rank: index + 1,
      previousRank: previousMeta?.rank ?? null,
      rankDelta: previousMeta ? previousMeta.rank - (index + 1) : 0,
      score: item.score,
      scoreDelta: item.score - (previousMeta?.score ?? 0),
      postsCount: item.postsCount,
      commentsCount: 0,
      bidsCount: 0,
      auctionWinsCount: 0,
      sellerEndedAuctionsCount: 0,
      productsCount: item.productsCount,
      user: item.user,
      badges: badgeMap.get(item.key) ?? [],
    };
  });
};

export const getBreederRanking = async ({
  limit = 20,
  period = "weekly",
  userId,
  baseDate,
  categoryPath,
  species,
}: {
  limit?: number;
  period?: RankingPeriod;
  userId?: number;
  baseDate?: Date;
  /** 관심 카테고리 고정 범위(path 쉼표 목록). 있으면 범위 안 게시글·상품만 집계한다. */
  categoryPath?: string;
  /** 랭킹 화면 종 필터(대·소분류 이름). 있으면 categoryPath 대신 그 종과 하위만 센다(상위는 넣지 않는다). */
  species?: string;
} = {}): Promise<BreederRankingItem[]> => {
  const scopedIds = species ? await speciesCategoryIds(species) : await resolveScopeCategoryIds(categoryPath);
  if (scopedIds) {
    return getScopedBreederRanking({ limit, period, baseDate, categoryIds: scopedIds });
  }

  // KST 현재 기간/직전 기간을 같은 기준으로 잘라야 rankDelta와 scoreDelta가 흔들리지 않는다.
  const { current, previous } = resolveRankingWindows(period, baseDate);

  const currentWindowFilter = createdIn(current);
  const currentAuctionWindowFilter = endedIn(current);

  const [users, currentPosts, currentComments, currentBids, currentWins, currentSellerEnds, currentFirstAnswers] =
    await Promise.all([
      client.user.findMany({
        where: RANKABLE_USER_WHERE,
        select: { id: true, name: true, avatar: true },
      }),
      countByGroup("post", {
        ...currentWindowFilter,
        category: { not: "공지" },
      }),
      countByGroup("comment", {
        ...currentWindowFilter,
      }),
      countByGroup("bid", {
        ...currentWindowFilter,
      }),
      countByGroup("auctionByWinner", {
        status: "종료",
        winnerId: { not: null },
        ...currentAuctionWindowFilter,
      }),
      countByGroup("auctionBySeller", {
        status: "종료",
        winnerId: { not: null },
        ...currentAuctionWindowFilter,
      }),
      countFirstAnswers(current),
    ]);

  const [previousPosts, previousComments, previousBids, previousWins, previousSellerEnds, previousFirstAnswers] =
    previous
      ? await Promise.all([
          countByGroup("post", {
            createdAt: { gte: previous.startAt, lte: previous.endAt },
            category: { not: "공지" },
          }),
          countByGroup("comment", {
            createdAt: { gte: previous.startAt, lte: previous.endAt },
          }),
          countByGroup("bid", {
            createdAt: { gte: previous.startAt, lte: previous.endAt },
          }),
          countByGroup("auctionByWinner", {
            status: "종료",
            winnerId: { not: null },
            endAt: { gte: previous.startAt, lte: previous.endAt },
          }),
          countByGroup("auctionBySeller", {
            status: "종료",
            winnerId: { not: null },
            endAt: { gte: previous.startAt, lte: previous.endAt },
          }),
          countFirstAnswers(previous),
        ])
      : [[], [], [], [], [], []];

  const userMap = new Map(users.map((row) => [row.id, row]));
  const maps = {
    currentPosts: toCountMap(currentPosts),
    currentComments: toCountMap(currentComments),
    currentBids: toCountMap(currentBids),
    currentWins: toCountMap(currentWins),
    currentSellerEnds: toCountMap(currentSellerEnds),
    previousPosts: toCountMap(previousPosts),
    previousComments: toCountMap(previousComments),
    previousBids: toCountMap(previousBids),
    previousWins: toCountMap(previousWins),
    previousSellerEnds: toCountMap(previousSellerEnds),
    currentFirstAnswers: toCountMap(currentFirstAnswers),
    previousFirstAnswers: toCountMap(previousFirstAnswers),
  };

  const currentScored = users
    .map((user) => {
      const counts = {
        postsCount: maps.currentPosts.get(user.id) ?? 0,
        commentsCount: maps.currentComments.get(user.id) ?? 0,
        bidsCount: maps.currentBids.get(user.id) ?? 0,
        auctionWinsCount: maps.currentWins.get(user.id) ?? 0,
        sellerEndedAuctionsCount: maps.currentSellerEnds.get(user.id) ?? 0,
        firstAnswersCount: maps.currentFirstAnswers.get(user.id) ?? 0,
      };
      return {
        key: user.id,
        user,
        ...counts,
        score: scoreBreeder(counts),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.user.name.localeCompare(b.user.name, "ko"));

  const previousScored = users
    .map((user) => {
      const counts = {
        postsCount: maps.previousPosts.get(user.id) ?? 0,
        commentsCount: maps.previousComments.get(user.id) ?? 0,
        bidsCount: maps.previousBids.get(user.id) ?? 0,
        auctionWinsCount: maps.previousWins.get(user.id) ?? 0,
        sellerEndedAuctionsCount: maps.previousSellerEnds.get(user.id) ?? 0,
        firstAnswersCount: maps.previousFirstAnswers.get(user.id) ?? 0,
      };
      return {
        key: user.id,
        score: scoreBreeder(counts),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.key - b.key);

  const previousRankMap = getRankMap(previousScored);
  const targetUserIds = currentScored.slice(0, Math.max(limit, userId ? 50 : limit)).map((item) => item.key);
  const badgeMap = await fetchUserBadges(targetUserIds);

  return currentScored.slice(0, limit).map((item, index) => {
    const previousMeta = previousRankMap.get(item.key);
    return {
      rank: index + 1,
      previousRank: previousMeta?.rank ?? null,
      rankDelta: previousMeta ? previousMeta.rank - (index + 1) : 0,
      score: item.score,
      scoreDelta: item.score - (previousMeta?.score ?? 0),
      postsCount: item.postsCount,
      commentsCount: item.commentsCount,
      bidsCount: item.bidsCount,
      auctionWinsCount: item.auctionWinsCount,
      sellerEndedAuctionsCount: item.sellerEndedAuctionsCount,
      firstAnswersCount: item.firstAnswersCount,
      user: item.user,
      badges: badgeMap.get(item.key) ?? [],
    };
  });
};

type HighlightPostRow = {
  id: number;
  userId: number;
  image: string;
  images: string[];
  _count: { Likes: number };
};

/** 최신순 게시글 행·팔로워 수·상품 수로 사람별 TOP 브리더 사진 줄·칭호 정보를 만든다(테스트용으로 뺀 순수 함수). */
export const buildBreederHighlights = (
  userIds: number[],
  posts: HighlightPostRow[],
  followers: CountRow[],
  products: CountRow[]
): Map<number, BreederHighlight> => {
  const followerMap = toCountMap(followers);
  const productMap = toCountMap(products);
  const highlights = new Map<number, BreederHighlight>(
    userIds.map((id) => [
      id,
      {
        photos: [],
        photosCount: 0,
        likesReceivedCount: 0,
        followersCount: followerMap.get(id) ?? 0,
        productsCount: productMap.get(id) ?? 0,
      },
    ])
  );
  for (const post of posts) {
    const highlight = highlights.get(post.userId);
    if (!highlight) continue;
    const images = post.images.length > 0 ? post.images : post.image ? [post.image] : [];
    highlight.photosCount += images.length;
    highlight.likesReceivedCount += post._count.Likes;
    if (images.length > 0 && highlight.photos.length < BREEDER_HIGHLIGHT_PHOTOS) {
      highlight.photos.push({ postId: post.id, image: images[0] });
    }
  }
  return highlights;
};

/**
 * 상위 `count` 명에게 TOP 브리더 사진 줄·칭호용 정보(최근 사진·사진 장수·받은 좋아요·팔로워·상품 수)를 붙인다.
 * 숨김·공지 글, 삭제·숨김 상품은 세지 않는다. 랭킹 점수에는 영향이 없다.
 */
export const attachBreederHighlights = async (
  items: BreederRankingItem[],
  count: number
): Promise<BreederRankingItem[]> => {
  const userIds = items.slice(0, count).map((item) => item.user.id);
  if (userIds.length === 0) return items;
  const [posts, followers, products] = await Promise.all([
    client.post.findMany({
      where: {
        userId: { in: userIds },
        isHidden: false,
        OR: [{ category: null }, { category: { not: "공지" } }],
      },
      select: { id: true, userId: true, image: true, images: true, _count: { select: { Likes: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    client.follow.groupBy({
      by: ["followingId"],
      where: { followingId: { in: userIds } },
      _count: { _all: true },
    }),
    countByGroup("product", { userId: { in: userIds }, isDeleted: false, isHidden: false }),
  ]);
  const highlights = buildBreederHighlights(
    userIds,
    posts,
    followers.map((row) => ({ key: row.followingId, count: row._count._all })),
    products
  );
  return items.map((item) => {
    const highlight = highlights.get(item.user.id);
    return highlight ? { ...item, highlight } : item;
  });
};

export const getTrendingCommunityPosts = async ({
  limit = 10,
  window = "24h",
  categoryPath,
}: {
  limit?: number;
  window?: CommunityWindow;
  categoryPath?: string;
} = {}): Promise<TrendingPostItem[]> => {
  const now = new Date();
  const recentBoundary = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const scope = await categoryScopeWhere(categoryPath);

  const [likeRows, commentRows, posts] = await Promise.all([
    countByGroup(
      "likeByPost",
      window === "24h" ? { createdAt: { gte: windowStart, lte: now } } : {}
    ),
    countByGroup(
      "commentByPost",
      window === "24h" ? { createdAt: { gte: windowStart, lte: now } } : {}
    ),
    client.post.findMany({
      where: {
        ...(window === "24h" ? { createdAt: { gte: recentBoundary, lte: now } } : {}),
        NOT: { category: "공지" },
        isHidden: false,
        user: RANKABLE_USER_WHERE,
        AND: [scope],
      },
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        category: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    }),
  ]);

  const likeMap = toCountMap(likeRows);
  const commentMap = toCountMap(commentRows);

  return posts
    .map((post) => {
      const likes24h = likeMap.get(post.id) ?? 0;
      const comments24h = commentMap.get(post.id) ?? 0;
      return {
        post,
        likes24h,
        comments24h,
        score: scoreTrendingPost({ likes24h, comments24h }),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.post.createdAt.getTime() - a.post.createdAt.getTime())
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      score: item.score,
      likes24h: item.likes24h,
      comments24h: item.comments24h,
      post: {
        ...item.post,
        createdAt: item.post.createdAt.toISOString(),
      },
    }));
};

export const getAuctionRanking = async ({
  category,
  limit = 20,
  periodScope = "week",
  baseDate,
  categoryPath,
}: {
  category?: string;
  limit?: number;
  periodScope?: AuctionPeriodScope;
  baseDate?: Date;
  /** 관심 카테고리 범위(구조만 — 앱·웹은 CATEGORY_SCOPE_SURFACES.auctions 가 켜지면 보낸다). */
  categoryPath?: string;
} = {}): Promise<AuctionRankingItem[]> => {
  // 홈은 "카테고리별 대표 1건"이 필요해서 전체 조회 후 top-level category별 최고가만 다시 추린다.
  const now = baseDate ?? new Date();
  const where: Record<string, unknown> = {
    status: "종료",
    winnerId: { not: null },
    isHidden: false,
    user: RANKABLE_USER_WHERE,
  };

  if (periodScope === "week") {
    const week = getKstWeekWindow(now);
    where.endAt = { gte: week.startAt, lte: week.endAt };
  } else if (periodScope === "month") {
    const month = getMonthWindow(now);
    where.endAt = { gte: month.startAt, lte: month.endAt };
  }

  if (category && category !== "전체") {
    where.category = { in: getCategoryFilterValues(category) };
  }
  const scopeIds = await resolveScopeCategoryIds(categoryPath);
  if (scopeIds) where.categoryId = { in: scopeIds };

  const auctions = await client.auction.findMany({
    where,
    select: {
      id: true,
      title: true,
      photos: true,
      category: true,
      currentPrice: true,
      endAt: true,
      bloodlineRootId: true,
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
    orderBy: [{ currentPrice: "desc" }, { endAt: "desc" }],
    take: category ? limit : 200,
  });

  const selected = category
    ? auctions.slice(0, limit)
    : TOP_LEVEL_CATEGORIES.map((topCategory) => {
        return auctions.find((auction) => findCategoryBranch(auction.category).parent === topCategory.id);
      }).filter((item): item is NonNullable<(typeof auctions)[number]> => Boolean(item));

  return selected.map((auction, index) => ({
    rank: index + 1,
    auctionId: auction.id,
    title: auction.title,
    category: auction.category,
    topLevelCategory: findCategoryBranch(auction.category).parent || auction.category || "기타",
    photo: auction.photos[0] ?? null,
    currentPrice: auction.currentPrice,
    endAt: auction.endAt.toISOString(),
    bloodlineRootId: auction.bloodlineRootId,
    seller: auction.user,
  }));
};

export const getBloodlineRanking = async ({
  limit = 20,
  period = "all",
  baseDate,
  speciesType,
  categoryPath,
  species,
}: {
  limit?: number;
  period?: RankingPeriod;
  speciesType?: string;
  baseDate?: Date;
  /** 관심 카테고리 범위(구조만 — 앱·웹은 CATEGORY_SCOPE_SURFACES.bloodlines 가 켜지면 보낸다). */
  categoryPath?: string;
  /** 랭킹 화면 종 필터(대·소분류 이름, 하위 포함·상위 제외). 있으면 categoryPath 를 쓰지 않는다. */
  species?: string;
} = {}): Promise<BloodlineRankingItem[]> => {
  // 혈통 랭킹은 root별 "실제 보유자 수" 중심으로 집계한다. 이번 주·이번 달은 그 기간에 새로 발급된 카드만 센다
  // (새 보유자 수 → 발급 수 순). 역대는 지금 있는 카드 전부.
  const rootWhere: Record<string, unknown> = {
    cardType: "BLOODLINE",
    status: "ACTIVE",
    creator: RANKABLE_USER_WHERE,
  };
  if (speciesType && speciesType !== "전체") {
    rootWhere.speciesType = speciesType;
  }
  const scopeIds = species ? await speciesCategoryIds(species) : await resolveScopeCategoryIds(categoryPath);
  if (scopeIds) rootWhere.categoryId = { in: scopeIds };

  const roots = await client.bloodlineCard.findMany({
    where: rootWhere,
    select: {
      id: true,
      name: true,
      speciesType: true,
      image: true,
      createdAt: true,
      creator: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (roots.length === 0) return [];
  const rootIds = roots.map((root) => root.id);

  const lineageCards = await client.bloodlineCard.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { id: { in: rootIds } },
        { bloodlineReferenceId: { in: rootIds } },
      ],
      currentOwner: RANKABLE_USER_WHERE,
    },
    select: {
      id: true,
      bloodlineReferenceId: true,
      currentOwnerId: true,
      createdAt: true,
    },
  });

  const { current, previous } = resolveRankingWindows(period, baseDate);
  const inWindow = (window: RankingWindow | null, at: Date) =>
    !window || (at.getTime() >= window.startAt.getTime() && at.getTime() <= window.endAt.getTime());

  const tally = (window: RankingWindow | null) => {
    const owners = new Map<number, Set<number>>();
    const issued = new Map<number, number>();
    for (const card of lineageCards) {
      if (!inWindow(window, card.createdAt)) continue;
      const rootId = card.bloodlineReferenceId ?? card.id;
      const set = owners.get(rootId) ?? new Set<number>();
      set.add(card.currentOwnerId);
      owners.set(rootId, set);
      issued.set(rootId, (issued.get(rootId) ?? 0) + 1);
    }
    return roots
      .map((root) => {
        // 역대는 예전처럼 카드가 안 읽혀도 root 자신을 1로 본다. 기간 랭킹은 그 기간 발급이 없으면 뺀다.
        const ownerCount = owners.get(root.id)?.size ?? (window ? 0 : 1);
        const issuedCount = issued.get(root.id) ?? (window ? 0 : 1);
        return { key: root.id, root, ownerCount, issuedCount, score: ownerCount * 1000 + issuedCount };
      })
      .filter((item) => item.ownerCount > 0)
      .sort(
        (a, b) =>
          b.ownerCount - a.ownerCount ||
          b.issuedCount - a.issuedCount ||
          b.root.createdAt.getTime() - a.root.createdAt.getTime()
      );
  };

  const scored = tally(current);
  const previousRankMap = previous ? getRankMap(tally(previous)) : new Map<number, { rank: number; score: number }>();

  return scored.slice(0, limit).map((item, index) => {
    const previousMeta = previousRankMap.get(item.key);
    return {
      rank: index + 1,
      previousRank: previousMeta?.rank ?? null,
      rankDelta: previousMeta ? previousMeta.rank - (index + 1) : 0,
      score: item.score,
      scoreDelta: previous ? item.score - (previousMeta?.score ?? 0) : 0,
      bloodlineRootId: item.root.id,
      name: item.root.name,
      speciesType: item.root.speciesType,
      image: item.root.image,
      creator: item.root.creator,
      ownerCount: item.ownerCount,
      issuedCount: item.issuedCount,
    };
  });
};

type ScoredUser<C> = { key: number; counts: C; score: number };

/** 사람별 점수 → 순위 행(이전 기간 순위·점수 차이 포함). 동점은 id 오름차순. */
const toRankedUserItems = async <C>(
  current: ScoredUser<C>[],
  previous: ScoredUser<unknown>[] | null,
  limit: number
): Promise<Array<RankedUserItem & { counts: C }>> => {
  const sortScored = <T extends { key: number; score: number }>(rows: T[]) =>
    rows.filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.key - b.key);
  const ranked = sortScored(current);
  const previousRankMap = previous ? getRankMap(sortScored(previous)) : new Map<number, { rank: number; score: number }>();
  const users = await client.user.findMany({
    where: { id: { in: ranked.map((row) => row.key) }, ...RANKABLE_USER_WHERE },
    select: { id: true, name: true, avatar: true },
  });
  const userMap = new Map(users.map((user) => [user.id, user]));
  return ranked
    .filter((row) => userMap.has(row.key))
    .slice(0, limit)
    .map((row, index) => {
      const previousMeta = previousRankMap.get(row.key);
      return {
        rank: index + 1,
        previousRank: previousMeta?.rank ?? null,
        rankDelta: previousMeta ? previousMeta.rank - (index + 1) : 0,
        score: row.score,
        scoreDelta: previous ? row.score - (previousMeta?.score ?? 0) : 0,
        user: userMap.get(row.key)!,
        counts: row.counts,
      };
    });
};

const speciesIdsOrNull = async (species?: string) => (species ? speciesCategoryIds(species) : null);

/** 경매 활동 랭킹(사람): 기간 안 입찰 수·경매 등록 수·낙찰 수. 종 필터는 경매의 categoryId(하위 포함). */
export const getAuctionActivityRanking = async ({
  limit = 50,
  period = "weekly",
  species,
  baseDate,
}: {
  limit?: number;
  period?: RankingPeriod;
  species?: string;
  baseDate?: Date;
} = {}): Promise<AuctionActivityRankingItem[]> => {
  const ids = await speciesIdsOrNull(species);
  if (ids && ids.length === 0) return [];
  const categoryFilter = ids ? { categoryId: { in: ids } } : {};
  const { current, previous } = resolveRankingWindows(period, baseDate);

  const tally = async (window: RankingWindow | null) => {
    const [bids, listed, wins] = await Promise.all([
      countByGroup("bid", { ...createdIn(window), auction: { isHidden: false, ...categoryFilter } }),
      countByGroup("auctionBySeller", {
        ...createdIn(window),
        ...categoryFilter,
        isHidden: false,
        status: { not: "취소" },
      }),
      countByGroup("auctionByWinner", {
        ...endedIn(window),
        ...categoryFilter,
        isHidden: false,
        status: "종료",
        winnerId: { not: null },
      }),
    ]);
    const maps = { bids: toCountMap(bids), listed: toCountMap(listed), wins: toCountMap(wins) };
    const keys = Array.from(
      new Set([bids, listed, wins].flatMap((rows) => rows.map((row) => row.key)))
    );
    return keys.map((key) => {
      const counts = {
        bidsCount: maps.bids.get(key) ?? 0,
        listedCount: maps.listed.get(key) ?? 0,
        winsCount: maps.wins.get(key) ?? 0,
      };
      return { key, counts, score: scoreAuctionActivity(counts) };
    });
  };

  const [currentRows, previousRows] = await Promise.all([tally(current), previous ? tally(previous) : null]);
  const items = await toRankedUserItems(currentRows, previousRows, limit);
  return items.map(({ counts, ...item }) => ({ ...item, ...counts }));
};

/** 분양 랭킹이 세는 분양글 조건. LISTING_METRIC 을 바꾸면 여기 조건만 따라 바뀐다. */
export const listingMetricWhere = (metric: ListingMetric, window: RankingWindow | null) =>
  metric === "completed"
    ? { status: "판매완료", ...(window ? { updatedAt: { gte: window.startAt, lte: window.endAt } } : {}) }
    : createdIn(window);

/** 분양 랭킹(사람): 기간 안 분양글 수(숨김·삭제 제외). 종 필터는 분양글 categoryId(하위 포함). */
export const getListingsRanking = async ({
  limit = 50,
  period = "weekly",
  species,
  baseDate,
  metric = LISTING_METRIC,
}: {
  limit?: number;
  period?: RankingPeriod;
  species?: string;
  baseDate?: Date;
  metric?: ListingMetric;
} = {}): Promise<ListingsRankingItem[]> => {
  const ids = await speciesIdsOrNull(species);
  if (ids && ids.length === 0) return [];
  const base = { isHidden: false, isDeleted: false, ...(ids ? { categoryId: { in: ids } } : {}) };
  const { current, previous } = resolveRankingWindows(period, baseDate);
  const tally = async (window: RankingWindow | null) =>
    (await countByGroup("product", { ...base, ...listingMetricWhere(metric, window) })).map((row) => ({
      key: row.key,
      counts: { listingsCount: row.count },
      score: row.count,
    }));
  const [currentRows, previousRows] = await Promise.all([tally(current), previous ? tally(previous) : null]);
  const items = await toRankedUserItems(currentRows, previousRows, limit);
  return items.map(({ counts, ...item }) => ({ ...item, ...counts, metric }));
};

export const getMyRankingSummary = async (
  userId: number
): Promise<(RankingMeSummary & RankingMe) | null> => {
  const [season, ranking] = await Promise.all([
    ensureCurrentWeeklySeason(),
    getBreederRanking({ limit: 100 }),
  ]);

  const goal = computeRankingMe(ranking, userId);
  const me = ranking.find((item) => item.user.id === userId);
  if (!me) {
    return {
      ...goal,
      currentSeasonId: season.id,
      currentRank: null,
      previousRank: null,
      rankDelta: 0,
      score: 0,
      scoreDelta: 0,
      badges: [],
    };
  }

  if (me.rank <= 20) {
    await ensureAlertSubscription({
      userId,
      alertType: "BREEDER_RANK_DROP",
      entityType: "USER",
      entityId: userId,
    });
    await ensureAlertSubscription({
      userId,
      alertType: "BREEDER_OVERTAKEN",
      entityType: "USER",
      entityId: userId,
    });
  }
  return {
    ...goal,
    currentSeasonId: season.id,
    currentRank: me.rank,
    previousRank: me.previousRank,
    rankDelta: me.rankDelta,
    score: me.score,
    scoreDelta: me.scoreDelta,
    badges: me.badges,
  };
};

export const getFreeGiveawayProducts = async ({
  limit = 6,
  categoryPath,
}: { limit?: number; categoryPath?: string } = {}): Promise<FreeProductItem[]> => {
  const scope = await categoryScopeWhere(categoryPath);
  const products = await client.product.findMany({
    where: {
      price: 0,
      status: "판매중",
      isDeleted: false,
      isHidden: false,
      AND: [scope],
    },
    select: {
      id: true,
      name: true,
      photos: true,
      category: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, avatar: true },
      },
      _count: {
        select: { favs: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return products.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }));
};

/** HOT 토론 후보 기간(일). null 은 전체 기간. 앞 기간에서 모자라면 다음 기간으로 넓혀 채운다. */
const HOT_DISCUSSION_WINDOW_DAYS = [7, 30, null] as const;
/** 이 개수 미만이면 다음(더 넓은) 기간 글로 남은 자리를 채운다. */
const HOT_DISCUSSION_MIN_RESULTS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export const getHotDiscussions = async ({
  limit = 5,
  categoryPath,
}: { limit?: number; categoryPath?: string } = {}): Promise<HotDiscussionItem[]> => {
  const scope = await categoryScopeWhere(categoryPath);
  const findRankedPosts = async (since: Date | null) => {
    const posts = await client.post.findMany({
      where: {
        category: { in: ["질문", "자유", "정보"] },
        isHidden: false,
        user: RANKABLE_USER_WHERE,
        AND: [scope],
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        category: true,
        createdAt: true,
        _count: {
          select: { comments: true, Likes: true },
        },
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: [{ comments: { _count: "desc" } }, { createdAt: "desc" }],
      take: limit * 3,
    });

    return posts
      .filter((p) => p._count.comments > 0 || p._count.Likes > 0)
      .sort(
        (a, b) =>
          b._count.comments * 2 +
          b._count.Likes -
          (a._count.comments * 2 + a._count.Likes)
      );
  };

  // 최근 7일 → 30일 → 전체 순으로, 앞 기간 글을 먼저 두고 모자란 자리만 넓은 기간 글로 채운다.
  // 역대 인기글이 최근 토론을 밀어내지 않게 하려는 것이다.
  const now = Date.now();
  const picked: Awaited<ReturnType<typeof findRankedPosts>> = [];
  for (const days of HOT_DISCUSSION_WINDOW_DAYS) {
    if (picked.length >= Math.min(limit, HOT_DISCUSSION_MIN_RESULTS)) break;
    const since = days === null ? null : new Date(now - days * DAY_MS);
    const pickedIds = new Set(picked.map((p) => p.id));
    const ranked = await findRankedPosts(since);
    picked.push(
      ...ranked.filter((p) => !pickedIds.has(p.id)).slice(0, limit - picked.length)
    );
  }

  return picked.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    image: p.image,
    category: p.category,
    createdAt: p.createdAt.toISOString(),
    commentsCount: p._count.comments,
    wonderCount: p._count.Likes,
    user: p.user,
  }));
};
