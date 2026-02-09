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

export interface ChatPagination {
  limit: number;
  hasMore: boolean;
  nextCursor: number | null;
}

// API 응답 인터페이스
export interface ChatRoomResponse {
  success: boolean;
  error?: string;
  chatRoom?: ChatRoom;
  pagination?: ChatPagination;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatRoomResponse>
) {
  try {
    const {
      query: { chatRoomId, limit = "20", beforeId },
      session: { user },
    } = req;

    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다." });
    }

    const roomId = Number(chatRoomId);
    if (Number.isNaN(roomId)) {
      return res
        .status(400)
        .json({ success: false, error: "유효하지 않은 채팅방 ID입니다." });
    }

    const parsedLimit = Number(limit);
    const pageSize = Number.isNaN(parsedLimit)
      ? 20
      : Math.min(Math.max(parsedLimit, 1), 50);
    const parsedBeforeId =
      beforeId === undefined ? null : Number(beforeId);
    const hasBeforeCursor =
      parsedBeforeId !== null && !Number.isNaN(parsedBeforeId);

    // 채팅방 조회 + 멤버 권한 체크
    const chatRoom = await client.chatRoom.findFirst({
      where: {
        id: roomId,
        chatRoomMembers: {
          some: { userId: user.id },
        },
      },
      include: {
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

    const messageWhere: {
      chatRoomId: number;
      id?: { lt: number };
    } = { chatRoomId: roomId };
    if (hasBeforeCursor && parsedBeforeId !== null) {
      messageWhere.id = { lt: parsedBeforeId };
    }

    // 최신순으로 pageSize만 가져온 뒤, UI 표시용으로 다시 오름차순 정렬
    const latestChunk = await client.message.findMany({
      where: messageWhere,
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
      orderBy: { id: "desc" },
      take: pageSize,
    });

    const orderedMessages = [...latestChunk].reverse();
    const oldestMessageId = orderedMessages[0]?.id;

    const olderMessage = oldestMessageId
      ? await client.message.findFirst({
          where: {
            chatRoomId: roomId,
            id: { lt: oldestMessageId },
          },
          select: { id: true },
          orderBy: { id: "desc" },
        })
      : null;

    const hasMore = Boolean(olderMessage);
    const nextCursor = hasMore ? oldestMessageId ?? null : null;

    return res.json({
      success: true,
      chatRoom: {
        id: chatRoom.id,
        messages: orderedMessages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        })),
        chatRoomMembers: chatRoom.chatRoomMembers.map((member) => ({
          ...member,
          lastReadAt: member.lastReadAt?.toISOString() || null,
        })),
      },
      pagination: {
        limit: pageSize,
        hasMore,
        nextCursor,
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
