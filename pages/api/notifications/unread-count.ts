import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { visibleNotificationWhere } from "@libs/server/notificationGate";

interface UnreadNotificationCountResponse {
  success: boolean;
  error?: string;
  unreadCount: number;
  /** 가장 최근 안 읽은 알림 시각(헤더 벨 점 판정, libs/shared/notificationSeen). 없으면 null. */
  latestUnreadAt?: string | null;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UnreadNotificationCountResponse>
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "로그인이 필요합니다.",
        unreadCount: 0,
      });
    }

    // 내가 차단한 사람이 보낸 알림은 세지 않는다(목록 GET /api/notifications 와 같은 조건).
    const unreadWhere = { ...(await visibleNotificationWhere(userId)), isRead: false };
    const [unreadCount, latest] = await Promise.all([
      client.notification.count({ where: unreadWhere }),
      client.notification.findFirst({
        where: unreadWhere,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return res.json({
      success: true,
      unreadCount,
      latestUnreadAt: latest?.createdAt ? latest.createdAt.toISOString() : null,
    });
  } catch (error) {
    console.error("Error in notification unread-count handler:", error);
    return res.status(500).json({
      success: false,
      error: "알림 개수를 불러오지 못했습니다.",
      unreadCount: 0,
    });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);

