import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { BloodlineRankingItem, RankingPeriod } from "@libs/shared/ranking";
import { getBloodlineRanking } from "@libs/server/ranking";

const isRankingPeriod = (value: string): value is RankingPeriod =>
  value === "weekly" || value === "all";

export interface BloodlinesRankingResponse {
  success: boolean;
  items: BloodlineRankingItem[];
  error?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlinesRankingResponse>
) {
  try {
    const parsedLimit = Number(req.query.limit || "");
    const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 50);
    const speciesType =
      typeof req.query.speciesType === "string" ? req.query.speciesType : undefined;
    const period = isRankingPeriod(String(req.query.period || "weekly"))
      ? (req.query.period as RankingPeriod)
      : "weekly";
    const items = await getBloodlineRanking({ limit, speciesType, period });

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error("[rankings][bloodlines]", error);
    return res.status(500).json({
      success: false,
      items: [],
      error: "인기 혈통 랭킹을 불러오지 못했습니다.",
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
