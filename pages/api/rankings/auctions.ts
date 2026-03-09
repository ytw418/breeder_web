import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { AuctionPeriodScope, AuctionRankingItem } from "@libs/shared/ranking";
import { getAuctionRanking } from "@libs/server/ranking";

const isAuctionPeriodScope = (value: string): value is AuctionPeriodScope =>
  value === "week" || value === "month" || value === "all";

export interface AuctionsRankingResponse {
  success: boolean;
  items: AuctionRankingItem[];
  error?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuctionsRankingResponse>
) {
  try {
    const parsedLimit = Number(req.query.limit || "");
    const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 50);
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const periodScope = isAuctionPeriodScope(String(req.query.periodScope || "week"))
      ? (req.query.periodScope as AuctionPeriodScope)
      : "week";
    const items = await getAuctionRanking({ category, periodScope, limit });

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error("[rankings][auctions]", error);
    return res.status(500).json({
      success: false,
      items: [],
      error: "최고가 경매 랭킹을 불러오지 못했습니다.",
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
