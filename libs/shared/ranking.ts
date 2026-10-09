import type { BreederKeyword } from "@libs/shared/breederKeywords";

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
  /** `highlights=N` 으로 요청했을 때 상위 N명에게만 온다(반려생활 TOP 브리더 사진 줄·키워드). */
  highlight?: BreederHighlight;
}

/** TOP 브리더 사진 줄에 보여 줄 최근 사진 수. */
export const BREEDER_HIGHLIGHT_PHOTOS = 4;
/** `highlights` 로 받을 수 있는 최대 인원. */
export const BREEDER_HIGHLIGHT_MAX = 10;

export interface BreederHighlight {
  /** 사진이 있는 최근 글(최신순, 최대 BREEDER_HIGHLIGHT_PHOTOS). 숨김·공지 글은 뺀다. */
  photos: { postId: number; image: string }[];
  /** 게시글에 올린 사진 장수. */
  photosCount: number;
  /** 게시글이 받은 좋아요 수. */
  likesReceivedCount: number;
  followersCount: number;
  /** 올린 상품(분양·판매) 수. 삭제·숨김 제외, 기간과 관계없이 전체. '분양왕' 칭호용. */
  productsCount: number;
}

/** 전체 랭킹(범위 없음) 브리더 점수 가중치. 반려생활 '점수 기준' 시트도 이 값을 보여 준다. */
export const BREEDER_SCORE_WEIGHTS: Readonly<
  Record<"post" | "comment" | "bid" | "auctionWin" | "sellerEndedAuction", number>
> = { post: 10, comment: 4, bid: 6, auctionWin: 15, sellerEndedAuction: 8 };

/**
 * 카테고리 범위 탑브리더 점수 가중치(PRD 5.5 초안: 게시글 수 + 상품 수 × 3).
 * 최종 가중치는 미정이라 설정값으로 떼어 둔다. 범위가 없는 전체 랭킹은 scoreBreeder 를 그대로 쓴다.
 * 경매·혈통은 구조만 잡아 두었다(2026-10-09): 경매·혈통 카드에 categoryId 를 쌓기 시작했고, 데이터가 모이면
 * 가중치를 올린다. 0 이면 서버가 그 수를 세지 않는다.
 */
export const SCOPED_BREEDER_SCORE_WEIGHTS: Readonly<
  Record<"post" | "product" | "auction" | "bloodline", number>
> = { post: 1, product: 3, auction: 0, bloodline: 0 };

export const scoreScopedBreeder = ({
  postsCount,
  productsCount,
  auctionsCount = 0,
  bloodlinesCount = 0,
}: {
  postsCount: number;
  productsCount: number;
  /** 범위 안 경매 수(가중치가 0 이면 세지 않아 0). */
  auctionsCount?: number;
  /** 범위 안 만든 혈통 수(가중치가 0 이면 세지 않아 0). */
  bloodlinesCount?: number;
}) =>
  postsCount * SCOPED_BREEDER_SCORE_WEIGHTS.post +
  productsCount * SCOPED_BREEDER_SCORE_WEIGHTS.product +
  auctionsCount * SCOPED_BREEDER_SCORE_WEIGHTS.auction +
  bloodlinesCount * SCOPED_BREEDER_SCORE_WEIGHTS.bloodline;

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
  /** 1위의 '○○왕' 칭호. 같은 기간 상위 10명끼리 비교한다(pickBreederKeywords). 구 서버엔 없다. */
  heroBreederKeyword?: BreederKeyword | null;
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
