import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { countRegionVisitors } from "@libs/server/regionVisit";

/**
 * GET /api/neighborhood/visitors — 최근 7일 내 동네 범위(50km)에서 홈을 본 사용자 수(로그인, 나 제외).
 * 응답 { success, count }(계약 NeighborhoodVisitors). 동네가 없으면 0. 앱 docs/prd/community-vibe.md §3.1.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
  }
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const count = await countRegionVisitors(userId);
  return res.json({ success: true, count });
}

export default withAuth(withHandler({ methods: ["GET"], handler, isPrivate: true }));
