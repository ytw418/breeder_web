import type { Product } from "@prisma/client";

export interface ProductWithCount extends Product {
  _count: { favs: number };
}

export interface ProductsResponse {
  success: boolean;
  products: ProductWithCount[];
  pages: number;
  /** 조건에 맞는 전체 상품 수(앱 상품 목록 "전체 N개") */
  total: number;
}

export interface HomeBanner {
  id: number;
  title: string;
  description: string;
  href: string;
  bgClass: string;
  order: number;
  image?: string | null;
}

/**
 * 공개 캐시 홈 피드(/api/home/feed?scope=public)에서 viewer 가 차단한 사용자의 항목을 뺀다
 * (앱 bredy_app src/lib/api/endpoints/home.ts getHomeFeed 와 같은 규칙).
 * 1위 브리더를 차단했으면 heroBreeder 를 null 로 두고, 화면이 같은 기간 랭킹에서 다음 브리더를 찾는다.
 */
export function filterHomeFeedForBlocked<
  T extends {
    heroBreeder: { user: { id: number } } | null;
    topAuctionsByCategory: { seller?: { id: number } | null }[];
    topBloodlines: { creator?: { id: number } | null }[];
    trendingPosts: { post: { user?: { id: number } | null } }[];
    freeGiveawayProducts: { user: { id: number } }[];
  },
>(feed: T, blocked: ReadonlySet<number>): T & { heroBlocked: boolean } {
  if (blocked.size === 0) return { ...feed, heroBlocked: false };
  const keep = (id: number | null | undefined) => id == null || !blocked.has(id);
  const heroBlocked = Boolean(feed.heroBreeder && !keep(feed.heroBreeder.user.id));
  return {
    ...feed,
    heroBlocked,
    heroBreeder: heroBlocked ? null : feed.heroBreeder,
    topAuctionsByCategory: feed.topAuctionsByCategory.filter((item) => keep(item.seller?.id)),
    topBloodlines: feed.topBloodlines.filter((item) => keep(item.creator?.id)),
    trendingPosts: feed.trendingPosts.filter((item) => keep(item.post.user?.id)),
    freeGiveawayProducts: feed.freeGiveawayProducts.filter((item) => keep(item.user.id)),
  };
}
