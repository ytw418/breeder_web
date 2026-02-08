import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";

export interface UnreadCountResponse {
  success: boolean;
  error?: string;
  unreadCount: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UnreadCountResponse>
) {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다.", unreadCount: 0 });
    }

    // 현재 유저가 속한 모든 채팅방 멤버 정보 조회
    const memberships = await client.chatRoomMember.findMany({
      where: { userId },
      select: {
        chatRoomId: true,
        lastReadAt: true,
      },
    });

    // 각 채팅방별 안 읽은 메시지 수를 DB 레벨에서 카운트
    let totalUnreadCount = 0;

    for (const membership of memberships) {
      const count = await client.message.count({
        where: {
          chatRoomId: membership.chatRoomId,
          userId: { not: userId },
          ...(membership.lastReadAt
            ? { createdAt: { gt: membership.lastReadAt } }
            : {}),
        },
      });
      totalUnreadCount += count;
    }

    return res.json({ success: true, unreadCount: totalUnreadCount });
  } catch (error) {
    console.error("Error in unread count handler:", error);
    return res.status(500).json({
      success: false,
      error: "읽지 않은 메시지 수를 불러오는데 실패했습니다.",
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
