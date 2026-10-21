import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { BREEDER_HIGHLIGHT_MAX, BreederRankingItem, RankingPeriod } from "@libs/shared/ranking";
import { attachBreederHighlights, computeRankingMe, getBreederRanking } from "@libs/server/ranking";
import type { RankingMe } from "@libs/shared/communityVibe";
import { viewerFollowingSet } from "@libs/server/viewerFollow";

/** me=1 로 내 순위 목표를 계산할 때 읽는 인원(getMyRankingSummary 와 같다). */
const ME_RANKING_SCAN = 100;

const isRankingPeriod = (value: string): value is RankingPeriod =>
  value === "weekly" || value === "monthly" || value === "all";

export interface BreedersRankingResponse {
  success: boolean;
  items: BreederRankingItem[];
  /** me=1 일 때만. 비로그인은 null(앱 docs/prd/community-vibe.md §3.2). */
  me?: RankingMe | null;
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
    // 랭킹 화면 종 필터(대·소분류 이름). 있으면 categoryPath 대신 쓴다.
    const species =
      typeof req.query.species === "string" && req.query.species.trim() ? req.query.species.trim() : undefined;
    // 반려생활 TOP 브리더: 상위 N명에게 최근 사진·받은 좋아요·팔로워를 붙인다(highlights=N, 최대 10).
    const parsedHighlights = Number(req.query.highlights || 0);
    const highlights = Number.isFinite(parsedHighlights)
      ? Math.min(Math.max(Math.floor(parsedHighlights), 0), BREEDER_HIGHLIGHT_MAX)
      : 0;
    // me=1: 같은 기간·범위 랭킹에서 내 순위 목표. 사람마다 달라 공유 캐시에 두지 않는다.
    const wantsMe = req.query.me === "1";
    const viewerId = req.user?.id;
    const scan = wantsMe && viewerId ? Math.max(limit, ME_RANKING_SCAN) : limit;
    const ranking = await getBreederRanking({ limit: scan, period, categoryPath, species });
    const top = ranking.slice(0, limit);
    const withHighlights = highlights > 0 ? await attachBreederHighlights(top, highlights) : top;
    // follow=1(랭킹 화면 행 팔로우 버튼): viewer 가 팔로우하는 사람을 한 번에 표시한다. 사람마다 달라 공유 캐시에 두지 않는다.
    const wantsFollow = req.query.follow === "1" && Boolean(viewerId);
    const followingIds = wantsFollow
      ? await viewerFollowingSet(viewerId, withHighlights.map((item) => item.user.id))
      : null;
    const items = followingIds
      ? withHighlights.map((item) => ({ ...item, isFollowing: followingIds.has(item.user.id) }))
      : withHighlights;

    if (wantsMe || wantsFollow) {
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({
        success: true,
        items,
        ...(wantsMe ? { me: viewerId ? computeRankingMe(ranking, viewerId) : null } : {}),
      });
    }
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
