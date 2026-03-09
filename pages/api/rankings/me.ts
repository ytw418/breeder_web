import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { RankingMeSummary } from "@libs/shared/ranking";
import { getMyRankingSummary } from "@libs/server/ranking";

export interface RankingMeResponse {
  success: boolean;
  item: RankingMeSummary | null;
  error?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RankingMeResponse>
) {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        item: null,
        error: "로그인이 필요합니다.",
      });
    }

    const item = await getMyRankingSummary(userId);
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error("[rankings][me]", error);
    return res.status(500).json({
      success: false,
      item: null,
      error: "내 랭킹 정보를 불러오지 못했습니다.",
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
