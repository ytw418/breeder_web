import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { MessageType } from "@prisma/client";

export interface ChatListResponse {
  success: boolean;
  error?: string;
  chatRooms: {
    id: number;
    updatedAt: string;
    chatRoomMembers: {
      user: {
        id: number;
        name: string;
        avatar: string | null;
      };
    }[];
    lastMessage: {
      id: number;
      type: MessageType;
      message: string;
      image: string | null;
      createdAt: string;
      userId: number;
    } | null;
    unreadCount: number;
  }[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatListResponse>
) {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다.", chatRooms: [] });
    }

    // 채팅방 목록 조회 (마지막 메시지 1개만 가져옴)
    const chatRooms = await client.chatRoom.findMany({
      where: {
        chatRoomMembers: {
          some: { userId },
        },
      },
      include: {
        chatRoomMembers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // 마지막 메시지 1개만 조회 (성능 개선)
          select: {
            id: true,
            type: true,
            message: true,
            image: true,
            createdAt: true,
            userId: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 각 채팅방의 읽지 않은 메시지 수를 DB 레벨에서 계산
    const formattedChatRooms = await Promise.all(
      chatRooms.map(async (chatRoom) => {
        const member = chatRoom.chatRoomMembers.find(
          (m) => m.userId === userId
        );
        const lastReadAt = member?.lastReadAt;

        // DB 레벨에서 안 읽은 메시지 수 카운트
        const unreadCount = await client.message.count({
          where: {
            chatRoomId: chatRoom.id,
            userId: { not: userId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });

        const lastMessage = chatRoom.messages[0] || null;

        return {
          id: chatRoom.id,
          updatedAt: chatRoom.updatedAt.toISOString(),
          chatRoomMembers: chatRoom.chatRoomMembers,
          lastMessage: lastMessage
            ? {
                ...lastMessage,
                createdAt: lastMessage.createdAt.toISOString(),
              }
            : null,
          unreadCount,
        };
      })
    );

    return res.json({
      success: true,
      chatRooms: formattedChatRooms,
    });
  } catch (error) {
    console.error("Error fetching chat rooms:", error);
    return res.status(500).json({
      success: false,
      error: "채팅방 목록을 불러오는데 실패했습니다.",
      chatRooms: [],
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
