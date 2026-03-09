import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { TrendingPostItem } from "@libs/shared/ranking";
import { getTrendingCommunityPosts } from "@libs/server/ranking";

export interface CommunityRankingResponse {
  success: boolean;
  items: TrendingPostItem[];
  error?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CommunityRankingResponse>
) {
  try {
    const parsedLimit = Number(req.query.limit || "");
    const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(Math.max(parsedLimit, 1), 30);
    const items = await getTrendingCommunityPosts({ limit });

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error("[rankings][community]", error);
    return res.status(500).json({
      success: false,
      items: [],
      error: "급상승 커뮤니티를 불러오지 못했습니다.",
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
