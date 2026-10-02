import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { getBlockedUserIds, setViewerCacheHeader } from "@libs/server/blocks";
import { parsePositiveIntId } from "@libs/shared/normalize";
import type { BlocksResponse } from "./index";

/** DELETE /api/blocks/[userId] — 차단 해제(멱등). 차단하지 않은 사용자여도 200. */
async function handler(req: NextApiRequest, res: NextApiResponse<BlocksResponse>) {
  const viewerId = req.user?.id;
  if (!viewerId) {
    return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
  }
  setViewerCacheHeader(res, viewerId);

  const rawUserId = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
  const targetId = parsePositiveIntId(rawUserId);
  if (targetId === null) {
    return res.status(400).json({
      success: false,
      error: "차단 해제할 사용자 정보가 올바르지 않습니다.",
      errorCode: "BLOCK_INVALID_USER_ID",
    });
  }

  await client.userBlock.deleteMany({
    where: { blockerId: viewerId, blockedId: targetId },
  });

  return res.json({
    success: true,
    blocked: false,
    blockedUserIds: await getBlockedUserIds(viewerId),
  });
}

export default withAuth(
  withHandler({
    methods: ["DELETE"],
    handler,
    isPrivate: true,
  })
);
