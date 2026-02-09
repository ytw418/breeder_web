import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { MessageType } from "@prisma/client";
import { sendPushToUsers } from "@libs/server/push";

interface MessageRequest {
  type?: MessageType;
  message?: string;
  image?: string;
}

export interface MessageResponse {
  success: boolean;
  error?: string;
  message?: {
    id: number;
    type: MessageType;
    message: string;
    image: string | null;
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
  try {
    const {
      query: { chatRoomId },
      session: { user },
      body: { type = "TEXT", message, image },
    } = req;

    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다." });
    }

    // 메시지 유효성 검사
    if (type === "TEXT" && (!message || message.trim() === "")) {
      return res
        .status(400)
        .json({ success: false, error: "메시지를 입력해주세요." });
    }

    if (type === "IMAGE" && !image) {
      return res
        .status(400)
        .json({ success: false, error: "이미지가 없습니다." });
    }

    // 채팅방 멤버 확인
    const chatRoom = await client.chatRoom.findFirst({
      where: {
        id: +chatRoomId!,
        chatRoomMembers: {
          some: { userId: user.id },
        },
      },
    });

    if (!chatRoom) {
      return res
        .status(404)
        .json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    // 메시지 생성 + 채팅방 updatedAt 갱신을 트랜잭션으로 처리
    const [newMessage] = await client.$transaction([
      client.message.create({
        data: {
          type: type as MessageType,
          message: type === "IMAGE" ? "사진을 보냈습니다." : message!,
          image: type === "IMAGE" ? image : null,
          user: { connect: { id: user.id } },
          chatRoom: { connect: { id: +chatRoomId! } },
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
      }),
      // 채팅방 updatedAt 갱신 (채팅 목록 정렬에 반영)
      client.chatRoom.update({
        where: { id: +chatRoomId! },
        data: { updatedAt: new Date() },
      }),
    ]);

    const otherMembers = await client.chatRoomMember.findMany({
      where: {
        chatRoomId: +chatRoomId!,
        userId: { not: user.id },
      },
      select: { userId: true },
    });

    // 발신자를 제외한 채팅방 멤버에게만 알림을 보낸다.
    const pushRecipientIds = otherMembers.map((member) => member.userId);
    const pushBody =
      newMessage.type === "IMAGE"
        ? `${newMessage.user.name}님이 사진을 보냈습니다.`
        : `${newMessage.user.name}: ${newMessage.message}`;

    // 푸시 전송은 부가 기능이므로 응답 지연을 막기 위해 비동기로 분리한다.
    sendPushToUsers(pushRecipientIds, {
      title: "새 채팅 메시지",
      body: pushBody,
      url: `/chat/${chatRoomId}`,
      tag: `chat-${chatRoomId}`,
    }).catch((error) => console.error("Failed to send chat push:", error));

    return res.json({
      success: true,
      message: {
        id: newMessage.id,
        type: newMessage.type,
        message: newMessage.message,
        image: newMessage.image,
        createdAt: newMessage.createdAt.toISOString(),
        user: newMessage.user,
      },
    });
  } catch (error) {
    console.error("Error in message handler:", error);
    return res.status(500).json({
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
