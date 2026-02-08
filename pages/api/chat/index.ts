import client from "@libs/server/client";
import withHandler from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";

export interface ChatRequestType {
  otherId: number;
}

export interface ChatResponseType {
  success: boolean;
  error?: string;
  ChatRoomId?: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponseType>
) {
  try {
    const {
      session: { user },
      body: { otherId },
    } = req;

    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다." });
    }

    if (!otherId) {
      return res
        .status(400)
        .json({ success: false, error: "상대방 정보가 없습니다." });
    }

    // 자기 자신과 채팅 방지
    if (user.id === +otherId) {
      return res
        .status(400)
        .json({ success: false, error: "자기 자신과는 채팅할 수 없습니다." });
    }

    // 기존 1:1 채팅방 찾기
    const existingChatRoom = await client.chatRoom.findFirst({
      where: {
        AND: [
          {
            chatRoomMembers: {
              some: { userId: user.id },
            },
          },
          {
            chatRoomMembers: {
              some: { userId: +otherId },
            },
          },
        ],
      },
      select: { id: true },
    });

    // 기존 채팅방이 있으면 해당 채팅방 ID 반환
    if (existingChatRoom) {
      return res.json({ success: true, ChatRoomId: existingChatRoom.id });
    }

    // 새로운 채팅방 생성
    const newChatRoom = await client.chatRoom.create({
      data: {
        chatRoomMembers: {
          createMany: {
            data: [{ userId: user.id }, { userId: +otherId }],
          },
        },
      },
    });

    return res.json({ success: true, ChatRoomId: newChatRoom.id });
  } catch (error) {
    console.error("Error in chat handler:", error);
    return res.status(500).json({
      success: false,
      error: "채팅방 생성 중 오류가 발생했습니다.",
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
