import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { canRunSensitiveAdminAction, hasAdminAccess } from "@libs/server/adminAccess";
import { getSanctionSummary } from "@libs/server/sanctions";

/**
 * 관리자 유저 상세(S-3): 상태·누적 제재·권장 조치·제재 이력·받은 신고·콘텐츠 조치·최근 글/상품.
 * 기획: 앱 docs/prd/admin-moderation.md
 */

const RECENT_LIMIT = 20;
const CONTENT_LIMIT = 10;

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const { user } = req;
  if (!(await hasAdminAccess(user?.id))) {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
  }

  const userId = Number(req.query.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, error: "잘못된 사용자 ID 입니다." });
  }

  const target = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      provider: true,
      role: true,
      status: true,
      suspendedUntil: true,
      deletedAt: true,
      createdAt: true,
    },
  });
  if (!target) {
    return res.status(404).json({ success: false, error: "사용자를 찾을 수 없어요." });
  }

  const [summary, sanctions, reportsReceived, reportsReceivedCount, contentActions, posts, products, me] =
    await Promise.all([
      getSanctionSummary(userId),
      client.userSanction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { actor: { select: { id: true, name: true } } },
      }),
      client.report.findMany({
        where: { reportedUserId: userId },
        orderBy: { createdAt: "desc" },
        take: RECENT_LIMIT,
        select: {
          id: true,
          targetType: true,
          targetId: true,
          reason: true,
          detail: true,
          status: true,
          contentAction: true,
          sanctionId: true,
          createdAt: true,
          reporter: { select: { id: true, name: true } },
        },
      }),
      client.report.count({ where: { reportedUserId: userId } }),
      client.moderationLog.findMany({
        where: { targetUserId: userId },
        orderBy: { createdAt: "desc" },
        take: RECENT_LIMIT,
        include: { actor: { select: { id: true, name: true } } },
      }),
      client.post.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: CONTENT_LIMIT,
        select: { id: true, title: true, isHidden: true, createdAt: true },
      }),
      client.product.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: CONTENT_LIMIT,
        select: { id: true, name: true, isHidden: true, isDeleted: true, createdAt: true },
      }),
      client.user.findUnique({ where: { id: user!.id }, select: { email: true } }),
    ]);

  return res.json({
    success: true,
    user: target,
    summary: { ...summary, reportsReceivedCount },
    sanctions,
    reportsReceived,
    contentActions,
    posts,
    products,
    // 역할 변경·계정 삭제 영역은 최고 관리자에게만 그린다.
    canRunSensitiveActions: canRunSensitiveAdminAction(me?.email),
  });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
);
