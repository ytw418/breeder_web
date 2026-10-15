import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { excludedAuthorIds } from "@libs/server/blocks";
import { pickHomeDebate } from "@libs/server/debate";

/**
 * GET /api/debates/home?categoryPath= — 홈 '실시간 TOP 토론' 맨 위 카드(앱 docs/prd/live-talk.md §3.2).
 * 진행 중 토론 중 내가 안 고른 것의 활동 1위(다 골랐으면 1위를 결과 상태로). 없으면 post: null.
 * 내 선택에 따라 달라서 공개 캐시에 두지 않는다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const viewerId = req.user?.id;
  const categoryPath = typeof req.query.categoryPath === "string" ? req.query.categoryPath : undefined;
  const post = await pickHomeDebate({
    viewerId,
    excludedIds: await excludedAuthorIds(viewerId),
    categoryPath,
  });
  return res.json({ success: true, post });
}

export default withAuth(withHandler({ methods: ["GET"], handler, isPrivate: false }));
