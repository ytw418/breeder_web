export type RankingPeriod = "weekly" | "all";
export type AuctionPeriodScope = "week" | "month" | "all";
export type CommunityWindow = "24h" | "all";
export type RankingEntityType = "USER" | "BLOODLINE" | "AUCTION";

export interface SeasonBadgeItem {
  id: number;
  badgeType: "TOP_BREEDER" | "TOP_BLOODLINE" | "HIGHEST_AUCTION_SELLER";
  rank: number;
  label: string;
  createdAt: string;
}

export interface BreederRankingItem {
  rank: number;
  previousRank: number | null;
  rankDelta: number;
  score: number;
  scoreDelta: number;
  postsCount: number;
  commentsCount: number;
  bidsCount: number;
  auctionWinsCount: number;
  sellerEndedAuctionsCount: number;
  /** 카테고리 범위 랭킹(categoryPath)에서만 채운다: 범위 안 상품 수. */
  productsCount?: number;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  badges: SeasonBadgeItem[];
}

/**
 * 카테고리 범위 탑브리더 점수 가중치(PRD 5.5 초안: 게시글 수 + 상품 수 × 3).
 * 최종 가중치는 미정이라 설정값으로 떼어 둔다. 범위가 없는 전체 랭킹은 scoreBreeder 를 그대로 쓴다.
 */
export const SCOPED_BREEDER_SCORE_WEIGHTS = { post: 1, product: 3 } as const;

export const scoreScopedBreeder = ({
  postsCount,
  productsCount,
}: {
  postsCount: number;
  productsCount: number;
}) =>
  postsCount * SCOPED_BREEDER_SCORE_WEIGHTS.post +
  productsCount * SCOPED_BREEDER_SCORE_WEIGHTS.product;

export interface BloodlineRankingItem {
  rank: number;
  previousRank: number | null;
  rankDelta: number;
  score: number;
  scoreDelta: number;
  bloodlineRootId: number;
  name: string;
  speciesType: string | null;
  image: string | null;
  creator: {
    id: number;
    name: string;
  };
  ownerCount: number;
  issuedCount: number;
}

export interface AuctionRankingItem {
  rank: number;
  auctionId: number;
  title: string;
  category: string | null;
  topLevelCategory: string;
  photo: string | null;
  currentPrice: number;
  endAt: string;
  bloodlineRootId: number | null;
  seller: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

export interface TrendingPostItem {
  rank: number;
  score: number;
  likes24h: number;
  comments24h: number;
  post: {
    id: number;
    title: string;
    description: string;
    image: string;
    category: string | null;
    createdAt: string;
    user: {
      id: number;
      name: string;
      avatar: string | null;
    };
  };
}

export interface MissionProgressItem {
  key: string;
  title: string;
  rewardLabel: string | null;
  targetCount: number;
  progress: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface RankingMeSummary {
  currentSeasonId: number;
  currentRank: number | null;
  previousRank: number | null;
  rankDelta: number;
  score: number;
  scoreDelta: number;
  badges: SeasonBadgeItem[];
}

export interface FreeProductItem {
  id: number;
  name: string;
  photos: string[];
  category: string | null;
  createdAt: string;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  _count: { favs: number };
}

export interface HotDiscussionItem {
  id: number;
  title: string;
  description: string;
  image: string;
  category: string | null;
  createdAt: string;
  commentsCount: number;
  wonderCount: number;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

export interface HomeFeedResponse {
  success: boolean;
  heroBreeder: BreederRankingItem | null;
  heroBreederMode: RankingPeriod;
  topAuctionsByCategory: AuctionRankingItem[];
  topAuctionsMode: AuctionPeriodScope;
  topBloodlines: BloodlineRankingItem[];
  topBloodlinesMode: RankingPeriod;
  trendingPosts: TrendingPostItem[];
  trendingPostsMode: CommunityWindow;
  myRanking: RankingMeSummary | null;
  myMissionSummary: MissionProgressItem[];
  currentSeasonId: number | null;
  freeGiveawayProducts: FreeProductItem[];
  hotDiscussions: HotDiscussionItem[];
}

export type RankingTabId = "breeders" | "auctions" | "bloodlines" | "community";

/**
 * 랭킹 항목의 작성자(차단 필터 기준). 공개 캐시 응답(/api/rankings/*)은 서버가 차단 사용자를 거르지 않아
 * 클라이언트가 withoutBlocked 로 거른다: 브리더=user, 경매=seller, 혈통=creator, 커뮤니티=post.user.
 */
export function getRankingOwnerId(
  tab: RankingTabId,
  item: BreederRankingItem | AuctionRankingItem | BloodlineRankingItem | TrendingPostItem
): number | undefined {
  if (tab === "breeders") return (item as BreederRankingItem).user?.id;
  if (tab === "auctions") return (item as AuctionRankingItem).seller?.id;
  if (tab === "bloodlines") return (item as BloodlineRankingItem).creator?.id;
  return (item as TrendingPostItem).post?.user?.id;
}
