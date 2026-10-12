import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { RankingMeSummary } from "@libs/shared/ranking";
import type { RankingMe } from "@libs/shared/communityVibe";
import { getMyRankingSummary } from "@libs/server/ranking";

/**
 * GET /api/rankings/me — 이번 주 내 브리더 순위.
 * `item` 은 옛 요약(RankingMeSummary)에 내 순위 목표(RankingMe: nextRank·nextScore·nextAction·gapToSecond)를 더한 것,
 * `me` 는 계약 RankingMe 만(앱 docs/prd/community-vibe.md §8).
 */
export interface RankingMeResponse {
  success: boolean;
  item: (RankingMeSummary & RankingMe) | null;
  me: RankingMe | null;
  error?: string;
}

const pickRankingMe = (item: RankingMe): RankingMe => ({
  rank: item.rank,
  score: item.score,
  delta: item.delta,
  nextRank: item.nextRank,
  nextScore: item.nextScore,
  nextAction: item.nextAction,
  gapToSecond: item.gapToSecond,
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RankingMeResponse>
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        item: null,
        me: null,
        error: "로그인이 필요합니다.",
      });
    }

    const item = await getMyRankingSummary(userId);
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({
      success: true,
      item,
      me: item ? pickRankingMe(item) : null,
    });
  } catch (error) {
    console.error("[rankings][me]", error);
    return res.status(500).json({
      success: false,
      item: null,
      me: null,
      error: "내 랭킹 정보를 불러오지 못했습니다.",
    });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
