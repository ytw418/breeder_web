import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";

interface ReadResponse {
  success: boolean;
  error?: string;
  unreadCount?: number;
  lastReadAt?: Date;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReadResponse>
) {
  try {
    const {
      query: { chatRoomId },
      session: { user },
    } = req;

    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다." });
    }

    // 현재 시간으로 lastReadAt 업데이트
    const now = new Date();
    await client.chatRoomMember.updateMany({
      where: {
        chatRoomId: +chatRoomId!,
        userId: user.id,
      },
      data: {
        lastReadAt: now,
      },
    });

    // 채팅방의 모든 메시지와 멤버 정보 가져오기
    const chatRoom = await client.chatRoom.findUnique({
      where: {
        id: +chatRoomId!,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "desc",
          },
        },
        chatRoomMembers: {
          where: {
            userId: user.id,
          },
          select: {
            lastReadAt: true,
          },
        },
      },
    });

    if (!chatRoom) {
      return res
        .status(404)
        .json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    // 읽지 않은 메시지 수 계산
    const member = chatRoom.chatRoomMembers[0];
    const lastReadAt = member?.lastReadAt;
    const unreadCount = chatRoom.messages.filter(
      (message) =>
        message.userId !== user.id &&
        (!lastReadAt || message.createdAt > lastReadAt)
    ).length;

    return res.json({
      success: true,
      unreadCount,
      lastReadAt: now,
    });
  } catch (error) {
    console.error("Error in read handler:", error);
    return res.status(500).json({
      success: false,
      error: "서버 오류가 발생했습니다.",
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
