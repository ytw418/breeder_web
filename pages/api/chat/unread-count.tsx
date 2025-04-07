import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";

interface UnreadCountResponse {
  success: boolean;
  error?: string;
  unreadCount: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UnreadCountResponse>
) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed", unreadCount: 0 });
  }

  try {
    const {
      session: { user },
    } = req;

    if (!user?.id) {
      return res.json({
        success: false,
        error: "로그인이 필요합니다.",
        unreadCount: 0,
      });
    }

    const chatRooms = await client.chatRoom.findMany({
      where: {
        chatRoomMembers: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        chatRoomMembers: true,
        messages: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    let totalUnreadCount = 0;

    for (const chatRoom of chatRooms) {
      const member = chatRoom.chatRoomMembers.find(
        (member) => member.userId === user.id
      );
      if (member) {
        const unreadCount = chatRoom.messages.filter(
          (message) =>
            message.userId !== user.id &&
            (!member.lastReadAt || message.createdAt > member.lastReadAt)
        ).length;
        totalUnreadCount += unreadCount;
      }
    }

    return res.json({ success: true, unreadCount: totalUnreadCount });
  } catch (error) {
    console.error("Error in unread count handler:", error);
    return res.json({
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
