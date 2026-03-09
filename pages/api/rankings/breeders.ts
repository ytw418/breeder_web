import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { BreederRankingItem } from "@libs/shared/ranking";
import { getBreederRanking } from "@libs/server/ranking";

export interface BreedersRankingResponse {
  success: boolean;
  items: BreederRankingItem[];
  error?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BreedersRankingResponse>
) {
  try {
    const parsedLimit = Number(req.query.limit || "");
    const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 50);
    const items = await getBreederRanking({ limit });

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error("[rankings][breeders]", error);
    return res.status(500).json({
      success: false,
      items: [],
      error: "브리더 랭킹을 불러오지 못했습니다.",
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
