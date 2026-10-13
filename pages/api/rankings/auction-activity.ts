import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { AuctionActivityRankingItem, RankingPeriod } from "@libs/shared/ranking";
import { getAuctionActivityRanking } from "@libs/server/ranking";
import { readRankingQuery } from "@libs/server/rankingQuery";

export interface AuctionActivityRankingResponse {
  success: boolean;
  items: AuctionActivityRankingItem[];
  period?: RankingPeriod;
  error?: string;
}

/** GET /api/rankings/auction-activity?period=weekly|monthly|all&species=&limit= — 경매 활동 1등(입찰·등록·낙찰). */
async function handler(req: NextApiRequest, res: NextApiResponse<AuctionActivityRankingResponse>) {
  try {
    const { limit, period, species } = readRankingQuery(req.query);
    const items = await getAuctionActivityRanking({ limit, period, species });
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.json({ success: true, items, period });
  } catch (error) {
    console.error("[rankings][auction-activity]", error);
    return res.status(500).json({ success: false, items: [], error: "경매 활동 랭킹을 불러오지 못했습니다." });
  }
}

export default withAuth(withHandler({ methods: ["GET"], handler, isPrivate: false }));
