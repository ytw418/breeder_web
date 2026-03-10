import { unstable_cache } from "next/cache";

import client from "@libs/server/client";
import { getCategoryFilterValues } from "@libs/categoryTaxonomy";
import { HomeBanner, ProductsResponse } from "@libs/shared/home";
import { HomeFeedResponse } from "@libs/shared/ranking";
import {
  getAuctionRanking,
  getBloodlineRanking,
  getBreederRanking,
  getMyRankingSummary,
  getTrendingCommunityPosts,
} from "@libs/server/ranking";
import {
  ensureAlertSubscription,
  ensureCurrentWeeklySeason,
  getUserMissionSummary,
} from "@libs/server/growth";

const SAMPLE_BANNERS: HomeBanner[] = [
  {
    id: 10001,
    title: "브리디 봄 시즌 이벤트",
    description: "인기 품목 특가와 무료 배송 쿠폰을 확인해보세요.",
    href: "/search",
    bgClass: "from-emerald-500 to-teal-500",
    order: 1,
  },
  {
    id: 10002,
    title: "신규 경매 기능 안내",
    description: "실시간 알림과 빠른 입찰 기능이 추가되었습니다.",
    href: "/auctions",
    bgClass: "from-sky-500 to-cyan-500",
    order: 2,
  },
  {
    id: 10003,
    title: "랭킹 리워드 업데이트",
    description: "이번 달 TOP 브리디 보상을 확인해보세요.",
    href: "/ranking",
    bgClass: "from-orange-500 to-amber-500",
    order: 3,
  },
];

type HomeFeedOptions = {
  userId?: number;
  includePersonalized?: boolean;
};

type ProductQueryOptions = {
  page?: number;
  size?: number;
  category?: string;
  productType?: string;
  status?: string;
};

const getCachedHomeBanners = unstable_cache(
  async () => {
    const banners = await client.adminBanner.findMany({
      orderBy: { order: "asc" },
    });

    return banners.length > 0 ? banners : SAMPLE_BANNERS;
  },
  ["home-banners"],
  {
    revalidate: 60 * 60,
  }
);

const buildHomeFeed = async ({
  userId,
  includePersonalized = true,
}: HomeFeedOptions = {}): Promise<HomeFeedResponse> => {
  const resolvedUserId = includePersonalized ? userId : undefined;
  const season = await ensureCurrentWeeklySeason();

  const [
    weeklyBreeders,
    weeklyAuctions,
    weeklyBloodlines,
    recentTrendingPosts,
    myRanking,
    myMissionSummary,
  ] = await Promise.all([
    getBreederRanking({ limit: 10, period: "weekly", userId: resolvedUserId }),
    getAuctionRanking({ periodScope: "week", limit: 20 }),
    getBloodlineRanking({ limit: 10, period: "weekly" }),
    getTrendingCommunityPosts({ limit: 6, window: "24h" }),
    resolvedUserId ? getMyRankingSummary(resolvedUserId) : Promise.resolve(null),
    resolvedUserId ? getUserMissionSummary(resolvedUserId) : Promise.resolve([]),
  ]);

  const [
    fallbackBreeders,
    fallbackAuctions,
    fallbackBloodlines,
    fallbackTrendingPosts,
  ] = await Promise.all([
    weeklyBreeders.length > 0
      ? Promise.resolve(weeklyBreeders)
      : getBreederRanking({ limit: 10, period: "all", userId: resolvedUserId }),
    weeklyAuctions.length > 0
      ? Promise.resolve(weeklyAuctions)
      : getAuctionRanking({ periodScope: "all", limit: 20 }),
    weeklyBloodlines.length > 0
      ? Promise.resolve(weeklyBloodlines)
      : getBloodlineRanking({ limit: 10, period: "all" }),
    recentTrendingPosts.length > 0
      ? Promise.resolve(recentTrendingPosts)
      : getTrendingCommunityPosts({ limit: 6, window: "all" }),
  ]);

  const heroBreederMode = weeklyBreeders.length > 0 ? "weekly" : "all";
  const topAuctionsMode = weeklyAuctions.length > 0 ? "week" : "all";
  const topBloodlinesMode = weeklyBloodlines.length > 0 ? "weekly" : "all";
  const trendingPostsMode = recentTrendingPosts.length > 0 ? "24h" : "all";
  const topBloodlines = fallbackBloodlines;
  const topAuctionsByCategory = fallbackAuctions;

  if (resolvedUserId) {
    const ownedBloodline = topBloodlines.find(
      (item) => item.creator.id === resolvedUserId
    );
    if (ownedBloodline) {
      await ensureAlertSubscription({
        userId: resolvedUserId,
        alertType: "BLOODLINE_OVERTAKEN",
        entityType: "BLOODLINE",
        entityId: ownedBloodline.bloodlineRootId,
      });
    }

    const ownedAuction = topAuctionsByCategory.find(
      (item) => item.seller.id === resolvedUserId
    );
    if (ownedAuction) {
      await ensureAlertSubscription({
        userId: resolvedUserId,
        alertType: "AUCTION_RECORD_BROKEN",
        entityType: "AUCTION",
        entityId: ownedAuction.auctionId,
      });
    }
  }

  return {
    success: true,
    heroBreeder: fallbackBreeders[0] ?? null,
    heroBreederMode,
    topAuctionsByCategory: topAuctionsByCategory.slice(0, 6),
    topAuctionsMode,
    topBloodlines: topBloodlines.slice(0, 6),
    topBloodlinesMode,
    trendingPosts: fallbackTrendingPosts.slice(0, 5),
    trendingPostsMode,
    myRanking,
    myMissionSummary,
    currentSeasonId: season.id,
  };
};

const getCachedPublicHomeFeed = unstable_cache(
  async () => buildHomeFeed({ includePersonalized: false }),
  ["home-feed-public"],
  {
    revalidate: 60 * 60, // 1시간
  }
);

const buildProductsResponse = async ({
  page = 1,
  size = 10,
  category,
  productType,
  status,
}: ProductQueryOptions = {}): Promise<ProductsResponse> => {
  const pageNumber = Number(page);
  const sizeNumber = Number(size);
  const normalizedPage =
    Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const normalizedSize =
    Number.isInteger(sizeNumber) && sizeNumber > 0
      ? Math.min(sizeNumber, 50)
      : 10;

  const where: Record<string, unknown> = {};
  if (category && category !== "전체") {
    where.category = { in: getCategoryFilterValues(String(category)) };
  }
  if (productType && productType !== "전체") {
    where.productType = productType;
  }
  if (status && status !== "전체") {
    where.status = status;
  }

  const [products, productCount] = await Promise.all([
    client.product.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            favs: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: normalizedSize,
      skip: (normalizedPage - 1) * normalizedSize,
    }),
    client.product.count({ where }),
  ]);

  return {
    success: true,
    products,
    pages: Math.ceil(productCount / normalizedSize),
  };
};

const getCachedDefaultProducts = unstable_cache(
  async () => buildProductsResponse({ page: 1, size: 10 }),
  ["home-products-default"],
  {
    revalidate: 60 * 60, // 1시간
  }
);

export async function getHomeBanners() {
  return getCachedHomeBanners();
}

export async function getHomeFeed(options: HomeFeedOptions = {}) {
  if (!options.includePersonalized || !options.userId) {
    return getCachedPublicHomeFeed();
  }

  return buildHomeFeed(options);
}

export async function getProductsResponse(options: ProductQueryOptions = {}) {
  const isDefaultFirstPage =
    (!options.category || options.category === "전체") &&
    !options.productType &&
    !options.status &&
    Number(options.page ?? 1) === 1 &&
    Number(options.size ?? 10) === 10;

  if (isDefaultFirstPage) {
    return getCachedDefaultProducts();
  }

  return buildProductsResponse(options);
}
