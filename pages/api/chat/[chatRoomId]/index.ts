import client from "@libs/server/client";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { NextApiRequest, NextApiResponse } from "next";
import { MessageType } from "@prisma/client";

// 채팅방 멤버 인터페이스
export interface ChatRoomMember {
  id: number;
  userId: number;
  chatRoomId: number;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  lastReadAt: string | null;
}

// 메시지 인터페이스
export interface Message {
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
}

// 채팅방 인터페이스
export interface ChatRoom {
  id: number;
  chatRoomMembers: ChatRoomMember[];
  messages: Message[];
}

// API 응답 인터페이스
export interface ChatRoomResponse {
  success: boolean;
  error?: string;
  chatRoom?: ChatRoom;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatRoomResponse>
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

    // 채팅방 조회 + 멤버 권한 체크 (findFirst로 멤버십 검증)
    const chatRoom = await client.chatRoom.findFirst({
      where: {
        id: +chatRoomId!,
        chatRoomMembers: {
          some: { userId: user.id },
        },
      },
      include: {
        messages: {
          select: {
            id: true,
            type: true,
            message: true,
            image: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        chatRoomMembers: {
          select: {
            id: true,
            userId: true,
            chatRoomId: true,
            lastReadAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!chatRoom) {
      return res
        .status(404)
        .json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    return res.json({
      success: true,
      chatRoom: {
        id: chatRoom.id,
        messages: chatRoom.messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        })),
        chatRoomMembers: chatRoom.chatRoomMembers.map((member) => ({
          ...member,
          lastReadAt: member.lastReadAt?.toISOString() || null,
        })),
      },
    });
  } catch (error) {
    console.error("Error in chat room handler:", error);
    return res.status(500).json({
      success: false,
      error: "채팅방 정보를 불러오는데 실패했습니다.",
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
