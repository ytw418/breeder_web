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

    const [breeders, topAuctionsByCategory, topBloodlines, trendingPosts, myRanking, myMissionSummary] =
      await Promise.all([
        getBreederRanking({ limit: 10, userId }),
        getAuctionRanking({ periodScope: "week", limit: 20 }),
        getBloodlineRanking({ limit: 10 }),
        getTrendingCommunityPosts({ limit: 6 }),
        userId ? getMyRankingSummary(userId) : Promise.resolve(null),
        userId ? getUserMissionSummary(userId) : Promise.resolve([]),
      ]);

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

    // 실시간 집계 기반이지만 홈 체감 속도를 위해 짧은 CDN 캐시를 둔다.
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.json({
      success: true,
      heroBreeder: breeders[0] ?? null,
      topAuctionsByCategory: topAuctionsByCategory.slice(0, 6),
      topBloodlines: topBloodlines.slice(0, 6),
      trendingPosts: trendingPosts.slice(0, 5),
      myRanking,
      myMissionSummary,
      currentSeasonId: season.id,
    });
  } catch (error) {
    console.error("[home][feed]", error);
    return res.status(500).json({
      success: false,
      heroBreeder: null,
      topAuctionsByCategory: [],
      topBloodlines: [],
      trendingPosts: [],
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
