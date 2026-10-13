import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { ListingsRankingItem, RankingPeriod } from "@libs/shared/ranking";
import { getListingsRanking } from "@libs/server/ranking";
import { readRankingQuery } from "@libs/server/rankingQuery";

export interface ListingsRankingResponse {
  success: boolean;
  items: ListingsRankingItem[];
  period?: RankingPeriod;
  error?: string;
}

/** GET /api/rankings/listings?period=weekly|monthly|all&species=&limit= — 분양 1등(지금은 분양글 수). */
async function handler(req: NextApiRequest, res: NextApiResponse<ListingsRankingResponse>) {
  try {
    const { limit, period, species } = readRankingQuery(req.query);
    const items = await getListingsRanking({ limit, period, species });
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.json({ success: true, items, period });
  } catch (error) {
    console.error("[rankings][listings]", error);
    return res.status(500).json({ success: false, items: [], error: "분양 랭킹을 불러오지 못했습니다." });
  }
}

export default withAuth(withHandler({ methods: ["GET"], handler, isPrivate: false }));
