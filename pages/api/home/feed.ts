import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
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

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HomeFeedResponse>
) {
  try {
    const userId = req.session.user?.id;
    // 홈 첫 화면은 이 응답 하나로 그리도록 묶었고, 시즌도 여기서 항상 활성 상태를 맞춘다.
    const season = await ensureCurrentWeeklySeason();

    const [weeklyBreeders, weeklyAuctions, weeklyBloodlines, recentTrendingPosts, myRanking, myMissionSummary] =
      await Promise.all([
        getBreederRanking({ limit: 10, period: "weekly", userId }),
        getAuctionRanking({ periodScope: "week", limit: 20 }),
        getBloodlineRanking({ limit: 10, period: "weekly" }),
        getTrendingCommunityPosts({ limit: 6, window: "24h" }),
        userId ? getMyRankingSummary(userId) : Promise.resolve(null),
        userId ? getUserMissionSummary(userId) : Promise.resolve([]),
      ]);

    const [fallbackBreeders, fallbackAuctions, fallbackBloodlines, fallbackTrendingPosts] =
      await Promise.all([
        weeklyBreeders.length > 0
          ? Promise.resolve<Awaited<ReturnType<typeof getBreederRanking>>>(weeklyBreeders)
          : getBreederRanking({ limit: 10, period: "all", userId }),
        weeklyAuctions.length > 0
          ? Promise.resolve<Awaited<ReturnType<typeof getAuctionRanking>>>(weeklyAuctions)
          : getAuctionRanking({ periodScope: "all", limit: 20 }),
        weeklyBloodlines.length > 0
          ? Promise.resolve<Awaited<ReturnType<typeof getBloodlineRanking>>>(weeklyBloodlines)
          : getBloodlineRanking({ limit: 10, period: "all" }),
        recentTrendingPosts.length > 0
          ? Promise.resolve<Awaited<ReturnType<typeof getTrendingCommunityPosts>>>(recentTrendingPosts)
          : getTrendingCommunityPosts({ limit: 6, window: "all" }),
      ]);

    const heroBreederMode = weeklyBreeders.length > 0 ? "weekly" : "all";
    const topAuctionsMode = weeklyAuctions.length > 0 ? "week" : "all";
    const topBloodlinesMode = weeklyBloodlines.length > 0 ? "weekly" : "all";
    const trendingPostsMode = recentTrendingPosts.length > 0 ? "24h" : "all";
    const breeders = fallbackBreeders;
    const topAuctionsByCategory = fallbackAuctions;
    const topBloodlines = fallbackBloodlines;
    const trendingPosts = fallbackTrendingPosts;

    if (userId) {
      // 홈에 노출된 내 자산은 진입 시점부터 추월/기록 경신 알림을 자동 구독시킨다.
      const ownedBloodline = topBloodlines.find((item) => item.creator.id === userId);
      if (ownedBloodline) {
        await ensureAlertSubscription({
          userId,
          alertType: "BLOODLINE_OVERTAKEN",
          entityType: "BLOODLINE",
          entityId: ownedBloodline.bloodlineRootId,
        });
      }

      const ownedAuction = topAuctionsByCategory.find((item) => item.seller.id === userId);
      if (ownedAuction) {
        await ensureAlertSubscription({
          userId,
          alertType: "AUCTION_RECORD_BROKEN",
          entityType: "AUCTION",
          entityId: ownedAuction.auctionId,
        });
      }
    }

    // 게스트 홈만 CDN 캐시하고, 로그인 사용자의 개인화 응답은 공유 캐시에 올리지 않는다.
    res.setHeader(
      "Cache-Control",
      userId
        ? "private, no-store, max-age=0"
        : "public, s-maxage=60, stale-while-revalidate=120"
    );
    return res.json({
      success: true,
      heroBreeder: breeders[0] ?? null,
      heroBreederMode,
      topAuctionsByCategory: topAuctionsByCategory.slice(0, 6),
      topAuctionsMode,
      topBloodlines: topBloodlines.slice(0, 6),
      topBloodlinesMode,
      trendingPosts: trendingPosts.slice(0, 5),
      trendingPostsMode,
      myRanking,
      myMissionSummary,
      currentSeasonId: season.id,
    });
  } catch (error) {
    console.error("[home][feed]", error);
    return res.status(500).json({
      success: false,
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
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
