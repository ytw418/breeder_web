import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import {
  BLOCK_LIMIT,
  BLOCK_SYNC_MAX,
  getBlockedUserIds,
  setViewerCacheHeader,
} from "@libs/server/blocks";
import { parsePositiveIntId } from "@libs/shared/normalize";

export interface BlockSyncResponse extends ResponseType {
  imported?: number;
  blockedUserIds?: number[];
  error?: string;
  errorCode?: string;
}

/**
 * POST /api/blocks/sync — { userIds: number[] }
 * 앱이 기기에 저장해 두던 차단 목록을 로그인한 계정으로 옮긴다.
 * 잘못된 값·중복·본인·없는 사용자는 조용히 버리고, 이미 있는 차단은 건너뛴다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<BlockSyncResponse>) {
  const viewerId = req.user?.id;
  if (!viewerId) {
    return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
  }
  setViewerCacheHeader(res, viewerId);

  const rawUserIds: unknown = req.body?.userIds;
  if (!Array.isArray(rawUserIds)) {
    return res.status(400).json({
      success: false,
      error: "차단 목록 형식이 올바르지 않습니다.",
      errorCode: "BLOCK_SYNC_INVALID_BODY",
    });
  }

  const candidateIds: number[] = [];
  const seen = new Set<number>();
  for (const raw of rawUserIds) {
    const id = parsePositiveIntId(raw);
    if (id === null || id === viewerId || seen.has(id)) continue;
    seen.add(id);
    candidateIds.push(id);
    if (candidateIds.length >= BLOCK_SYNC_MAX) break;
  }

  let imported = 0;
  if (candidateIds.length > 0) {
    const existingUsers = await client.user.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingUsers.map((user) => user.id));
    const currentBlockCount = await client.userBlock.count({
      where: { blockerId: viewerId },
    });
    const room = Math.max(0, BLOCK_LIMIT - currentBlockCount);
    const toBlock = candidateIds.filter((id) => existingIds.has(id)).slice(0, room);

    if (toBlock.length > 0) {
      // POST /api/blocks 와 같이 차단 상대와의 양방향 팔로우도 함께 지운다
      // (남겨 두면 notifyFollowers 가 차단한 사람의 새 글·상품 알림을 계속 보낸다).
      const [result] = await client.$transaction([
        client.userBlock.createMany({
          data: toBlock.map((blockedId) => ({ blockerId: viewerId, blockedId })),
          skipDuplicates: true,
        }),
        client.follow.deleteMany({
          where: {
            OR: [
              { followerId: viewerId, followingId: { in: toBlock } },
              { followerId: { in: toBlock }, followingId: viewerId },
            ],
          },
        }),
      ]);
      imported = result.count;
    }
  }

  return res.json({
    success: true,
    imported,
    blockedUserIds: await getBlockedUserIds(viewerId),
  });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
