import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { recordRegionVisit } from "@libs/server/regionVisit";

/**
 * POST /api/neighborhood/visit — 홈 진입 때 하루 1회 방문 기록(로그인). 동네가 없으면 기록하지 않는다.
 * 응답 { success, recorded }. 앱 docs/prd/community-vibe.md §8.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
  }
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const recorded = await recordRegionVisit(userId);
  return res.json({ success: true, recorded });
}

export default withAuth(withHandler({ methods: ["POST"], handler, isPrivate: true }));
