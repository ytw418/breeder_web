import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";

interface MessageRequest {
  message: string;
}

interface MessageResponse {
  success: boolean;
  error?: string;
  message?: {
    id: number;
    message: string;
    createdAt: string;
    user: {
      id: number;
      name: string;
      avatar: string | null;
    };
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MessageResponse>
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      query: { chatRoomId },
      session: { user },
      body: { message },
    } = req;

    if (!user?.id) {
      return res.json({ success: false, error: "로그인이 필요합니다." });
    }

    if (!message || message.trim() === "") {
      return res.json({ success: false, error: "메시지를 입력해주세요." });
    }

    const chatRoom = await client.chatRoom.findFirst({
      where: {
        id: +chatRoomId!,
        chatRoomMembers: {
          some: {
            userId: user.id,
          },
        },
      },
    });

    if (!chatRoom) {
      return res.json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    const newMessage = await client.message.create({
      data: {
        message,
        user: {
          connect: {
            id: user.id,
          },
        },
        chatRoom: {
          connect: {
            id: +chatRoomId!,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      message: {
        id: newMessage.id,
        message: newMessage.message,
        createdAt: newMessage.createdAt.toISOString(),
        user: newMessage.user,
      },
    });
  } catch (error) {
    console.error("Error in message handler:", error);
    return res.json({
      success: false,
      error: "메시지 전송에 실패했습니다.",
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
