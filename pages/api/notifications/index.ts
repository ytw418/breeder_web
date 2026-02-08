import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { NotificationType } from "@prisma/client";

export interface NotificationItem {
  id: number;
  type: NotificationType;
  message: string;
  isRead: boolean;
  targetId: number | null;
  targetType: string | null;
  createdAt: string;
  sender: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

export interface NotificationsResponse {
  success: boolean;
  error?: string;
  notifications: NotificationItem[];
  unreadCount: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NotificationsResponse>
) {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "로그인이 필요합니다.",
        notifications: [],
        unreadCount: 0,
      });
    }

    if (req.method === "GET") {
      const [notifications, unreadCount] = await Promise.all([
        client.notification.findMany({
          where: { userId },
          select: {
            id: true,
            type: true,
            message: true,
            isRead: true,
            targetId: true,
            targetType: true,
            createdAt: true,
            sender: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        client.notification.count({
          where: { userId, isRead: false },
        }),
      ]);

      return res.json({
        success: true,
        notifications: notifications.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      });
    }

    // POST: 모든 알림 읽음 처리
    if (req.method === "POST") {
      await client.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      return res.json({
        success: true,
        notifications: [],
        unreadCount: 0,
      });
    }
  } catch (error) {
    console.error("Error in notifications handler:", error);
    return res.status(500).json({
      success: false,
      error: "알림을 불러오는데 실패했습니다.",
      notifications: [],
      unreadCount: 0,
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
