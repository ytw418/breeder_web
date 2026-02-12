import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";

interface UnreadNotificationCountResponse {
  success: boolean;
  error?: string;
  unreadCount: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UnreadNotificationCountResponse>
) {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "로그인이 필요합니다.",
        unreadCount: 0,
      });
    }

    const unreadCount = await client.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return res.json({
      success: true,
      unreadCount,
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

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);

