import { NextApiRequest, NextApiResponse } from "next";

import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { fetchHomeFeed } from "@libs/server/home";
import { HomeFeedResponse } from "@libs/shared/ranking";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HomeFeedResponse>
) {
  try {
    const isPublicScope = req.query.scope === "public";
    const userId = isPublicScope ? undefined : req.user?.id;
    // 관심 카테고리 고정 범위. URL 이 달라 공유 캐시도 범위별로 나뉜다.
    const categoryPath =
      typeof req.query.categoryPath === "string" ? req.query.categoryPath : undefined;

    const payload = await fetchHomeFeed({
      userId,
      includePersonalized: !isPublicScope,
      categoryPath,
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

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
