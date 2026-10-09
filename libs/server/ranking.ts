import client from "@libs/server/client";
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
} from "@libs/shared/ranking";
import { categoryScopeWhere, resolveScopeCategoryIds } from "@libs/server/categories";
import {
  findCategoryBranch,
  getCategoryFilterValues,
  TOP_LEVEL_CATEGORIES,
} from "@libs/categoryTaxonomy";
import { getKstWeekWindow, getMonthWindow, getPreviousKstWeekWindow } from "@libs/server/season";
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
export const scoreBreeder = ({
  postsCount,
  commentsCount,
  bidsCount,
  auctionWinsCount,
  sellerEndedAuctionsCount,
}: {
  postsCount: number;
  commentsCount: number;
  bidsCount: number;
  auctionWinsCount: number;
  sellerEndedAuctionsCount: number;
}) =>
  postsCount * BREEDER_SCORE_WEIGHTS.post +
  commentsCount * BREEDER_SCORE_WEIGHTS.comment +
  bidsCount * BREEDER_SCORE_WEIGHTS.bid +
  auctionWinsCount * BREEDER_SCORE_WEIGHTS.auctionWin +
  sellerEndedAuctionsCount * BREEDER_SCORE_WEIGHTS.sellerEndedAuction;

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
    const rows = await client.bid.groupBy({ by: ["userId"], where, _count: { _all: true } });
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
  const current = getKstWeekWindow(baseDate);
  const previous = getPreviousKstWeekWindow(baseDate);
  const scopeFilter = { categoryId: { in: categoryIds } };
  const postBase = { ...scopeFilter, isHidden: false, category: { not: "공지" } };
  const productBase = { ...scopeFilter, isHidden: false, isDeleted: false };
  // 경매·혈통은 가중치가 0 이면 세지 않는다(구조만, SCOPED_BREEDER_SCORE_WEIGHTS).
  const auctionBase = { ...scopeFilter, isHidden: false };
  const bloodlineBase = { ...scopeFilter, cardType: "BLOODLINE" as const, status: "ACTIVE" as const };
  const countAuctions = SCOPED_BREEDER_SCORE_WEIGHTS.auction > 0;
  const countBloodlines = SCOPED_BREEDER_SCORE_WEIGHTS.bloodline > 0;
  const windowOf = (window: { startAt: Date; endAt: Date }) => ({
    createdAt: { gte: window.startAt, lte: window.endAt },
  });
  const optionalCount = (
    enabled: boolean,
    model: "auctionBySeller" | "bloodlineByCreator",
    where: Record<string, unknown>
  ) => (enabled ? countByGroup(model, where) : Promise.resolve([] as CountRow[]));

  const [users, currentPosts, currentProducts, currentAuctions, currentBloodlines] = await Promise.all([
    client.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, avatar: true },
    }),
    countByGroup("post", {
      ...postBase,
      ...(period === "weekly" ? windowOf(current) : {}),
    }),
    countByGroup("product", {
      ...productBase,
      ...(period === "weekly" ? windowOf(current) : {}),
    }),
    optionalCount(countAuctions, "auctionBySeller", {
      ...auctionBase,
      ...(period === "weekly" ? windowOf(current) : {}),
    }),
    optionalCount(countBloodlines, "bloodlineByCreator", {
      ...bloodlineBase,
      ...(period === "weekly" ? windowOf(current) : {}),
    }),
  ]);
  const [previousPosts, previousProducts, previousAuctions, previousBloodlines] =
    period === "weekly"
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
}: {
  limit?: number;
  period?: RankingPeriod;
  userId?: number;
  baseDate?: Date;
  /** 관심 카테고리 고정 범위(path 쉼표 목록). 있으면 범위 안 게시글·상품만 집계한다. */
  categoryPath?: string;
} = {}): Promise<BreederRankingItem[]> => {
  const scopedIds = await resolveScopeCategoryIds(categoryPath);
  if (scopedIds) {
    return getScopedBreederRanking({ limit, period, baseDate, categoryIds: scopedIds });
  }

  // KST 현재 주/직전 주를 같은 기준으로 잘라야 rankDelta와 scoreDelta가 흔들리지 않는다.
  const current = getKstWeekWindow(baseDate);
  const previous = getPreviousKstWeekWindow(baseDate);

  const currentWindowFilter =
    period === "weekly"
      ? { createdAt: { gte: current.startAt, lte: current.endAt } }
      : {};
  const currentAuctionWindowFilter =
    period === "weekly"
      ? { endAt: { gte: current.startAt, lte: current.endAt } }
      : {};

  const [users, currentPosts, currentComments, currentBids, currentWins, currentSellerEnds] =
    await Promise.all([
      client.user.findMany({
        where: { status: "ACTIVE" },
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
    ]);

  const [previousPosts, previousComments, previousBids, previousWins, previousSellerEnds] =
    period === "weekly"
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
        ])
      : [[], [], [], [], []];

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
  };

  const currentScored = users
    .map((user) => {
      const counts = {
        postsCount: maps.currentPosts.get(user.id) ?? 0,
        commentsCount: maps.currentComments.get(user.id) ?? 0,
        bidsCount: maps.currentBids.get(user.id) ?? 0,
        auctionWinsCount: maps.currentWins.get(user.id) ?? 0,
        sellerEndedAuctionsCount: maps.currentSellerEnds.get(user.id) ?? 0,
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

/** 최신순 게시글 행·팔로워 수로 사람별 TOP 브리더 사진 줄·키워드 정보를 만든다(테스트용으로 뺀 순수 함수). */
export const buildBreederHighlights = (
  userIds: number[],
  posts: HighlightPostRow[],
  followers: CountRow[]
): Map<number, BreederHighlight> => {
  const followerMap = toCountMap(followers);
  const highlights = new Map<number, BreederHighlight>(
    userIds.map((id) => [
      id,
      { photos: [], photosCount: 0, likesReceivedCount: 0, followersCount: followerMap.get(id) ?? 0 },
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
 * 상위 `count` 명에게 반려생활 TOP 브리더 사진 줄·키워드용 정보(최근 사진·사진 장수·받은 좋아요·팔로워)를 붙인다.
 * 숨김·공지 글은 세지 않는다. 랭킹 점수에는 영향이 없다.
 */
export const attachBreederHighlights = async (
  items: BreederRankingItem[],
  count: number
): Promise<BreederRankingItem[]> => {
  const userIds = items.slice(0, count).map((item) => item.user.id);
  if (userIds.length === 0) return items;
  const [posts, followers] = await Promise.all([
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
  ]);
  const highlights = buildBreederHighlights(
    userIds,
    posts,
    followers.map((row) => ({ key: row.followingId, count: row._count._all }))
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
        user: { status: "ACTIVE" },
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
    user: { status: "ACTIVE" },
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
  baseDate: _baseDate,
  speciesType,
  categoryPath,
}: {
  limit?: number;
  period?: RankingPeriod;
  speciesType?: string;
  baseDate?: Date;
  /** 관심 카테고리 범위(구조만 — 앱·웹은 CATEGORY_SCOPE_SURFACES.bloodlines 가 켜지면 보낸다). */
  categoryPath?: string;
} = {}): Promise<BloodlineRankingItem[]> => {
  // 혈통 랭킹은 실사용 데이터를 우선해 root별 "실제 보유자 수" 중심으로 단순 집계한다.
  const rootWhere: Record<string, unknown> = {
    cardType: "BLOODLINE",
    status: "ACTIVE",
    creator: { status: "ACTIVE" },
  };
  if (speciesType && speciesType !== "전체") {
    rootWhere.speciesType = speciesType;
  }
  const scopeIds = await resolveScopeCategoryIds(categoryPath);
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
      currentOwner: { status: "ACTIVE" },
    },
    select: {
      id: true,
      bloodlineReferenceId: true,
      currentOwnerId: true,
    },
  });

  const ownerMap = new Map<number, Set<number>>();
  const issuedCountMap = new Map<number, number>();

  lineageCards.forEach((card) => {
    const rootId = card.bloodlineReferenceId ?? card.id;
    const ownerSet = ownerMap.get(rootId) ?? new Set<number>();
    ownerSet.add(card.currentOwnerId);
    ownerMap.set(rootId, ownerSet);
    issuedCountMap.set(rootId, (issuedCountMap.get(rootId) ?? 0) + 1);
  });

  const scored = roots
    .map((root) => {
      const ownerCount = ownerMap.get(root.id)?.size ?? 1;
      const issuedCount = issuedCountMap.get(root.id) ?? 1;
      return {
        root,
        ownerCount,
        issuedCount,
        score: ownerCount * 1000 + issuedCount,
      };
    })
    .sort(
      (a, b) =>
        b.ownerCount - a.ownerCount ||
        b.issuedCount - a.issuedCount ||
        b.root.createdAt.getTime() - a.root.createdAt.getTime()
    );

  return scored.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    previousRank: null,
    rankDelta: 0,
    score: item.score,
    scoreDelta: 0,
    bloodlineRootId: item.root.id,
    name: item.root.name,
    speciesType: item.root.speciesType,
    image: item.root.image,
    creator: item.root.creator,
    ownerCount: item.ownerCount,
    issuedCount: item.issuedCount,
  }));
};

export const getMyRankingSummary = async (userId: number): Promise<RankingMeSummary | null> => {
  const [season, ranking] = await Promise.all([
    ensureCurrentWeeklySeason(),
    getBreederRanking({ limit: 100 }),
  ]);

  const me = ranking.find((item) => item.user.id === userId);
  if (!me) {
    return {
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
        user: { status: "ACTIVE" },
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
