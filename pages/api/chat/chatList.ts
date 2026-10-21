import { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@libs/server/auth";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { MessageType } from "@prisma/client";
import { getBlockedUserIds } from "@libs/server/blocks";
import { unreadSince } from "@libs/server/chatRoom";

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
    /** 내가 이 방 알림을 껐는지. 상대의 설정은 내려주지 않는다. */
    muted: boolean;
  }[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatListResponse>
) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다.", chatRooms: [] });
    }

    // 내가 차단한 사람이 있는 방은 내 목록에서 숨긴다(상대 목록에는 그대로 보인다).
    const blockedIds = await getBlockedUserIds(userId);

    // 채팅방 목록 조회 (마지막 메시지 1개만 가져옴).
    // '채팅하기'만 누르고 아무도 말하지 않은 방은 양쪽 목록에서 뺀다(2026-10-21 감사 9번).
    const chatRooms = await client.chatRoom.findMany({
      where: {
        chatRoomMembers: {
          some: { userId },
          ...(blockedIds.length ? { none: { userId: { in: blockedIds } } } : {}),
        },
        messages: { some: {} },
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
        const lastMessage = chatRoom.messages[0] || null;

        // 나간 방은 나간 뒤 새 메시지가 올 때까지 목록에서 뺀다(상대가 다시 보내면 다시 나타난다).
        const leftAt = member?.leftAt ?? null;
        if (leftAt && (!lastMessage || lastMessage.createdAt <= leftAt)) {
          return null;
        }

        // DB 레벨에서 안 읽은 메시지 수 카운트(나간 방은 나간 뒤 메시지만)
        const since = member ? unreadSince(member) : null;
        const unreadCount = await client.message.count({
          where: {
            chatRoomId: chatRoom.id,
            userId: { not: userId },
            ...(since ? { createdAt: { gt: since } } : {}),
          },
        });

        return {
          id: chatRoom.id,
          updatedAt: chatRoom.updatedAt.toISOString(),
          // 멤버의 읽음·나가기·알림 상태는 내려주지 않는다(상대 설정 노출 방지).
          chatRoomMembers: chatRoom.chatRoomMembers.map((m) => ({ user: m.user })),
          lastMessage: lastMessage
            ? {
                ...lastMessage,
                createdAt: lastMessage.createdAt.toISOString(),
              }
            : null,
          unreadCount,
          muted: Boolean(member?.mutedAt),
        };
      })
    ).then((rooms) =>
      rooms.filter((room): room is NonNullable<typeof room> => room !== null)
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

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
