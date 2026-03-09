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
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  badges: SeasonBadgeItem[];
}

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
}
