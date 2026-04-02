import { NextApiRequest, NextApiResponse } from "next";

import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { getHomeFeed } from "@libs/server/home";
import { HomeFeedResponse } from "@libs/shared/ranking";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HomeFeedResponse>
) {
  try {
    const isPublicScope = req.query.scope === "public";
    const userId = isPublicScope ? undefined : req.session.user?.id;

    const payload = await getHomeFeed({
      userId,
      includePersonalized: !isPublicScope,
    });

    res.setHeader(
      "Cache-Control",
      isPublicScope || !userId
        ? "public, s-maxage=60, stale-while-revalidate=120"
        : "private, no-store, max-age=0"
    );

    return res.json(payload);
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
      freeGiveawayProducts: [],
      hotDiscussions: [],
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
