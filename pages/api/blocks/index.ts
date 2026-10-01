import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { BLOCK_LIMIT, getBlockedUserIds, setViewerCacheHeader } from "@libs/server/blocks";
import { parsePositiveIntId } from "@libs/shared/normalize";

export interface BlockedUserItem {
  id: number;
  user: { id: number; name: string; avatar: string | null };
  createdAt: Date | string;
}

export interface BlocksResponse extends ResponseType {
  blocks?: BlockedUserItem[];
  blocked?: boolean;
  blockedUserIds?: number[];
  error?: string;
  errorCode?: string;
}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "P2002";

/**
 * GET  /api/blocks — 내 차단 목록 + 차단한 사용자 id 목록
 * POST /api/blocks — { userId } 차단(멱등). 차단하면 양방향 팔로우를 지운다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<BlocksResponse>) {
  const viewerId = req.user?.id;
  if (!viewerId) {
    return res.status(401).json({ success: false, error: "로그인이 필요합니다." });
  }
  setViewerCacheHeader(res, viewerId);

  if (req.method === "GET") {
    const rows = await client.userBlock.findMany({
      where: { blockerId: viewerId },
      orderBy: { createdAt: "desc" },
      take: BLOCK_LIMIT,
      select: {
        id: true,
        createdAt: true,
        blockedId: true,
        blocked: { select: { id: true, name: true, avatar: true } },
      },
    });

    return res.json({
      success: true,
      blocks: rows.map((row) => ({ id: row.id, user: row.blocked, createdAt: row.createdAt })),
      blockedUserIds: rows.map((row) => row.blockedId),
    });
  }

  const targetId = parsePositiveIntId(req.body?.userId);
  if (targetId === null) {
    return res.status(400).json({
      success: false,
      error: "차단할 사용자 정보가 올바르지 않습니다.",
      errorCode: "BLOCK_INVALID_USER_ID",
    });
  }

  if (targetId === viewerId) {
    return res.status(400).json({
      success: false,
      error: "자기 자신은 차단할 수 없습니다.",
      errorCode: "BLOCK_SELF_NOT_ALLOWED",
    });
  }

  const target = await client.user.findUnique({
    where: { id: targetId },
    select: { id: true },
  });
  if (!target) {
    return res.status(404).json({
      success: false,
      error: "사용자를 찾을 수 없습니다.",
      errorCode: "BLOCK_USER_NOT_FOUND",
    });
  }

  // 이미 차단한 대상은 빼고 센다 — 같은 사용자를 다시 차단하는 요청은 한도와 무관하게 성공해야 한다.
  const otherBlockCount = await client.userBlock.count({
    where: { blockerId: viewerId, blockedId: { not: targetId } },
  });
  if (otherBlockCount >= BLOCK_LIMIT) {
    return res.status(400).json({
      success: false,
      error: `차단은 최대 ${BLOCK_LIMIT}명까지 할 수 있습니다.`,
      errorCode: "BLOCK_LIMIT_EXCEEDED",
    });
  }

  try {
    await client.$transaction([
      client.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: viewerId, blockedId: targetId } },
        create: { blockerId: viewerId, blockedId: targetId },
        update: {},
      }),
      client.follow.deleteMany({
        where: {
          OR: [
            { followerId: viewerId, followingId: targetId },
            { followerId: targetId, followingId: viewerId },
          ],
        },
      }),
    ]);
  } catch (error) {
    // 같은 차단 요청이 동시에 들어와 upsert 가 unique 에 걸리면 이미 차단된 상태다.
    if (!isUniqueViolation(error)) throw error;
  }

  return res.json({
    success: true,
    blocked: true,
    blockedUserIds: await getBlockedUserIds(viewerId),
  });
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
