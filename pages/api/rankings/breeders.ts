import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { BREEDER_HIGHLIGHT_MAX, BreederRankingItem, RankingPeriod } from "@libs/shared/ranking";
import { attachBreederHighlights, getBreederRanking } from "@libs/server/ranking";

const isRankingPeriod = (value: string): value is RankingPeriod =>
  value === "weekly" || value === "all";

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
    const period = isRankingPeriod(String(req.query.period || "weekly"))
      ? (req.query.period as RankingPeriod)
      : "weekly";
    // 관심 카테고리 고정 범위(path 쉼표 목록). 있으면 범위 안 게시글·상품만 집계한다.
    const categoryPath =
      typeof req.query.categoryPath === "string" ? req.query.categoryPath : undefined;
    // 반려생활 TOP 브리더: 상위 N명에게 최근 사진·받은 좋아요·팔로워를 붙인다(highlights=N, 최대 10).
    const parsedHighlights = Number(req.query.highlights || 0);
    const highlights = Number.isFinite(parsedHighlights)
      ? Math.min(Math.max(Math.floor(parsedHighlights), 0), BREEDER_HIGHLIGHT_MAX)
      : 0;
    const ranking = await getBreederRanking({ limit, period, categoryPath });
    const items = highlights > 0 ? await attachBreederHighlights(ranking, highlights) : ranking;

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

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
