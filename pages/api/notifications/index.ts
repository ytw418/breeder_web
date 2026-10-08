import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { NotificationType } from "@prisma/client";

/** 운영 알림(MODERATION)의 보낸 사람 자리. 실제 운영자 계정 대신 이 값을 준다. */
const MODERATION_SENDER = { id: 0, name: "브리디 운영팀", avatar: null };

export interface NotificationItem {
  id: number;
  type: NotificationType;
  message: string;
  isRead: boolean;
  targetId: number | null;
  targetType: string | null;
  /** 게시글 댓글 알림이면 그 댓글 id(누르면 /posts/:id?commentId= 로 그 댓글까지 스크롤) */
  commentId: number | null;
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
    const userId = req.user?.id;

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
            commentId: true,
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
          // 운영 알림의 senderId 는 조치한 운영자다. 대상자·신고자에게 운영자 계정을 드러내지 않는다
          // (앱 docs/prd/admin-moderation.md AC-15). 화면은 '브리디 운영팀'으로 그린다.
          sender: n.type === "MODERATION" ? MODERATION_SENDER : n.sender,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      });
    }

    // POST: 읽음 처리. body.id 가 있으면 그 알림 하나, 없으면 모두.
    if (req.method === "POST") {
      const rawId = req.body?.id;
      const targetId = typeof rawId === "number" ? rawId : Number.NaN;
      if (rawId !== undefined && rawId !== null) {
        if (!Number.isInteger(targetId) || targetId <= 0) {
          return res.status(400).json({
            success: false,
            error: "잘못된 알림입니다.",
            notifications: [],
            unreadCount: 0,
          });
        }
        await client.notification.updateMany({
          where: { id: targetId, userId, isRead: false },
          data: { isRead: true },
        });
        const unreadCount = await client.notification.count({
          where: { userId, isRead: false },
        });
        return res.json({ success: true, notifications: [], unreadCount });
      }

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

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
