import { unstable_cache } from "next/cache";

import client from "@libs/server/client";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import { excludedAuthorIds } from "@libs/server/blocks";
import { getCategoryFilterValues } from "@libs/categoryTaxonomy";
import { categoryScopeWhere } from "@libs/server/categories";
import { HomeBanner, ProductsResponse } from "@libs/shared/home";
import { HomeFeedResponse } from "@libs/shared/ranking";
import { pickBreederKeywords } from "@libs/shared/breederKeywords";
import {
  attachBreederHighlights,
  getAuctionRanking,
  getBloodlineRanking,
  getBreederRanking,
  getFreeGiveawayProducts,
  getHotDiscussions,
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

const SAMPLE_PRODUCTS_RESPONSE: ProductsResponse = {
  success: true,
  products: [],
  pages: 0,
  total: 0,
};

const SAMPLE_HOME_FEED: HomeFeedResponse = {
  success: true,
  heroBreeder: null,
  heroBreederMode: "weekly",
  topAuctionsByCategory: [],
  topAuctionsMode: "week",
  topBloodlines: [],
  topBloodlinesMode: "weekly",
  trendingPosts: [],
  trendingPostsMode: "24h",
  myRanking: null,
  myMissionSummary: [],
  currentSeasonId: null,
  freeGiveawayProducts: [],
  hotDiscussions: [],
};

type HomeFeedOptions = {
  userId?: number;
  includePersonalized?: boolean;
  /** 관심 카테고리 고정 범위(path 쉼표 목록). 있으면 공개 캐시를 거치지 않는다. */
  categoryPath?: string;
};

type ProductQueryOptions = {
  page?: number;
  size?: number;
  category?: string;
  /** 관심 카테고리 고정 범위(path 쉼표 목록). category(이름 필터)와 함께 쓸 수 있다. */
  categoryPath?: string;
  productType?: string;
  status?: string;
  /** 정확한 가격(원). 0 이면 무료나눔 목록. 0 이상의 정수만 쓴다. */
  price?: number;
  /** 가격 범위(원). 0 이상의 정수만 쓴다. price 가 있으면 무시한다. */
  minPrice?: number;
  maxPrice?: number;
  /** 정렬. 없거나 모르는 값이면 최신순. */
  sort?: string;
  /** 연결한 뿌리 혈통 id(혈통 상세 "이 혈통 분양글"). 양의 정수만 쓴다. */
  bloodlineRootId?: number;
  /**
   * 로그인한 viewer. 있으면 viewer 가 차단한 판매자의 상품을 뺀다.
   * unstable_cache 경로(getCachedDefaultProducts)에는 넣지 않는다(공개 캐시).
   */
  viewerId?: number;
};

const getCachedHomeBanners = unstable_cache(
  async () => {
    if (!process.env.DATABASE_URL) {
      return SAMPLE_BANNERS;
    }

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
  categoryPath,
}: HomeFeedOptions = {}): Promise<HomeFeedResponse> => {
  if (!process.env.DATABASE_URL) {
    return SAMPLE_HOME_FEED;
  }

  const resolvedUserId = includePersonalized ? userId : undefined;
  const season = await ensureCurrentWeeklySeason();

  const [
    weeklyBreeders,
    weeklyAuctions,
    weeklyBloodlines,
    recentTrendingPosts,
    myRanking,
    myMissionSummary,
    freeGiveawayProducts,
    hotDiscussions,
  ] = await Promise.all([
    getBreederRanking({ limit: 10, period: "weekly", userId: resolvedUserId, categoryPath }),
    getAuctionRanking({ periodScope: "week", limit: 20 }),
    getBloodlineRanking({ limit: 10, period: "weekly" }),
    getTrendingCommunityPosts({ limit: 6, window: "24h", categoryPath }),
    resolvedUserId ? getMyRankingSummary(resolvedUserId) : Promise.resolve(null),
    resolvedUserId ? getUserMissionSummary(resolvedUserId) : Promise.resolve([]),
    getFreeGiveawayProducts({ limit: 6, categoryPath }),
    getHotDiscussions({ limit: 5, categoryPath }),
  ]);

  const [
    fallbackBreeders,
    fallbackAuctions,
    fallbackBloodlines,
    fallbackTrendingPosts,
  ] = await Promise.all([
    weeklyBreeders.length > 0
      ? Promise.resolve(weeklyBreeders)
      : getBreederRanking({ limit: 10, period: "all", userId: resolvedUserId, categoryPath }),
    weeklyAuctions.length > 0
      ? Promise.resolve(weeklyAuctions)
      : getAuctionRanking({ periodScope: "all", limit: 20 }),
    weeklyBloodlines.length > 0
      ? Promise.resolve(weeklyBloodlines)
      : getBloodlineRanking({ limit: 10, period: "all" }),
    recentTrendingPosts.length > 0
      ? Promise.resolve(recentTrendingPosts)
      : getTrendingCommunityPosts({ limit: 6, window: "all", categoryPath }),
  ]);

  const heroBreederMode = weeklyBreeders.length > 0 ? "weekly" : "all";
  // 1위의 칭호(왜 1위인지): 같은 기간 상위 10명끼리 비교한다. 분양글·팔로워 등은 highlight 로 붙인다.
  const heroPeers = await attachBreederHighlights(fallbackBreeders, fallbackBreeders.length);
  const heroBreederKeyword = pickBreederKeywords(heroPeers, fallbackBloodlines, 1)[0] ?? null;
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
    heroBreeder: heroPeers[0] ?? null,
    heroBreederKeyword,
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
    freeGiveawayProducts,
    hotDiscussions,
  };
};

const getCachedPublicHomeFeed = unstable_cache(
  async () => buildHomeFeed({ includePersonalized: false }),
  ["home-feed-public"],
  {
    revalidate: 60 * 60, // 1시간
  }
);

export const PRODUCT_SORTS = ["latest", "popular", "priceAsc", "priceDesc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

const isProductSort = (value: unknown): value is ProductSort =>
  typeof value === "string" && (PRODUCT_SORTS as readonly string[]).includes(value);

// 같은 순위끼리는 최신순 → id 순으로 이어 붙여 페이지가 넘어가도 순서가 흔들리지 않게 한다.
// 최신순(기본)은 기존 쿼리 그대로 둔다.
const productOrderBy = (sort: ProductSort) => {
  const tieBreak = [{ createdAt: "desc" as const }, { id: "desc" as const }];
  switch (sort) {
    case "popular":
      return [{ favs: { _count: "desc" as const } }, ...tieBreak];
    case "priceAsc":
      return [{ price: { sort: "asc" as const, nulls: "last" as const } }, ...tieBreak];
    case "priceDesc":
      return [{ price: { sort: "desc" as const, nulls: "last" as const } }, ...tieBreak];
    default:
      return { createdAt: "desc" as const };
  }
};

/** price 컬럼(INT4) 최대값. 이보다 큰 가격 조건은 Prisma 오류(500)가 나므로 이 값으로 자른다. */
export const PRICE_FILTER_MAX = 2_147_483_647;

const clampPrice = (v: number) => Math.min(v, PRICE_FILTER_MAX);

const priceRangeFilter = (minPrice?: number, maxPrice?: number) => {
  const valid = (v?: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 ? clampPrice(v) : undefined;
  let min = valid(minPrice);
  let max = valid(maxPrice);
  if (min === undefined && max === undefined) return undefined;
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  return {
    ...(min !== undefined ? { gte: min } : {}),
    ...(max !== undefined ? { lte: max } : {}),
  };
};

const buildProductsResponse = async ({
  page = 1,
  size = 10,
  category,
  categoryPath,
  productType,
  status,
  price,
  minPrice,
  maxPrice,
  sort,
  bloodlineRootId,
  viewerId,
}: ProductQueryOptions = {}): Promise<ProductsResponse> => {
  const pageNumber = Number(page);
  const sizeNumber = Number(size);
  const normalizedPage =
    Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const normalizedSize =
    Number.isInteger(sizeNumber) && sizeNumber > 0
      ? Math.min(sizeNumber, 50)
      : 10;

  // 숨김(관리자 조치·탈퇴)·삭제 상품은 목록에 노출하지 않는다.
  const where: Record<string, unknown> = { isHidden: false, isDeleted: false };
  if (category && category !== "전체") {
    where.category = { in: getCategoryFilterValues(String(category)) };
  }
  // 관심 카테고리 고정 범위. 없으면 숨긴 카테고리 상품만 뺀다.
  const scope = await categoryScopeWhere(categoryPath);
  if (Object.keys(scope).length) {
    where.AND = [scope];
  }
  if (productType && productType !== "전체") {
    where.productType = productType;
  }
  if (status && status !== "전체") {
    where.status = status;
  }
  if (typeof bloodlineRootId === "number" && Number.isInteger(bloodlineRootId) && bloodlineRootId > 0) {
    where.bloodlineRootId = bloodlineRootId;
  }
  if (typeof price === "number") {
    where.price = clampPrice(price);
  } else {
    const range = priceRangeFilter(minPrice, maxPrice);
    if (range) where.price = range;
  }
  const excluded = await excludedAuthorIds(viewerId);
  if (excluded.length) {
    where.userId = { notIn: excluded };
  }

  const [products, productCount] = await Promise.all([
    client.product.findMany({
      where,
      include: {
        // 목록 카드의 판매자 표시(아바타·닉네임·브리더 프로그램 프레임).
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            breederPrograms: {
              where: { status: "ACTIVE" as const },
              select: breederProgramSummarySelect,
            },
          },
        },
        _count: {
          select: {
            favs: true,
          },
        },
      },
      orderBy: productOrderBy(isProductSort(sort) ? sort : "latest"),
      take: normalizedSize,
      skip: (normalizedPage - 1) * normalizedSize,
    }),
    client.product.count({ where }),
  ]);

  return {
    success: true,
    products: products.map((product) => ({
      ...product,
      user: {
        ...product.user,
        breederPrograms: getSortedActiveBreederProgramSummaries(product.user.breederPrograms),
      },
    })),
    pages: Math.ceil(productCount / normalizedSize),
    total: productCount,
  };
};

const getCachedDefaultProducts = unstable_cache(
  async () => {
    if (!process.env.DATABASE_URL) {
      return SAMPLE_PRODUCTS_RESPONSE;
    }

    return buildProductsResponse({ page: 1, size: 10 });
  },
  ["home-products-default"],
  {
    revalidate: 60 * 60, // 1시간
  }
);

/*
 * 캐시 경계
 * - get* : unstable_cache 사용. App Router(서버 컴포넌트/ISR) 렌더링 전용이다.
 * - fetch* : 캐시 없음. Pages Router API(pages/api/**) 전용이다.
 *   unstable_cache 는 App Router 요청 컨텍스트(workStore.incrementalCache)가 있어야 동작하고,
 *   pages/api 에는 그 컨텍스트가 없어 "Invariant: incrementalCache missing" 으로 500 이 난다.
 *   API 응답 캐시는 각 라우트의 Cache-Control(s-maxage) 로 CDN 에서 처리한다.
 */

export async function getHomeBanners() {
  return getCachedHomeBanners();
}

export async function fetchHomeBanners(): Promise<HomeBanner[]> {
  if (!process.env.DATABASE_URL) {
    return SAMPLE_BANNERS;
  }

  const banners = await client.adminBanner.findMany({
    orderBy: { order: "asc" },
  });

  return banners.length > 0 ? banners : SAMPLE_BANNERS;
}

export async function getHomeFeed(options: HomeFeedOptions = {}) {
  if (!options.includePersonalized || !options.userId) {
    return options.categoryPath
      ? buildHomeFeed({ includePersonalized: false, categoryPath: options.categoryPath })
      : getCachedPublicHomeFeed();
  }

  return buildHomeFeed(options);
}

export async function getProductsResponse(options: ProductQueryOptions = {}) {
  const isDefaultFirstPage =
    !options.viewerId &&
    !options.categoryPath &&
    (!options.category || options.category === "전체") &&
    !options.productType &&
    !options.status &&
    options.price === undefined &&
    options.minPrice === undefined &&
    options.maxPrice === undefined &&
    (!options.sort || options.sort === "latest") &&
    options.bloodlineRootId === undefined &&
    Number(options.page ?? 1) === 1 &&
    Number(options.size ?? 10) === 10;

  if (isDefaultFirstPage) {
    return getCachedDefaultProducts();
  }

  if (!process.env.DATABASE_URL) {
    return SAMPLE_PRODUCTS_RESPONSE;
  }

  return buildProductsResponse(options);
}

export async function fetchHomeFeed(options: HomeFeedOptions = {}) {
  if (!options.includePersonalized || !options.userId) {
    return buildHomeFeed({
      includePersonalized: false,
      categoryPath: options.categoryPath,
    });
  }

  return buildHomeFeed(options);
}

export async function fetchProductsResponse(
  options: ProductQueryOptions = {}
) {
  if (!process.env.DATABASE_URL) {
    return SAMPLE_PRODUCTS_RESPONSE;
  }

  return buildProductsResponse(options);
}
