import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";

interface ChatListResponse {
  success: boolean;
  error?: string;
  chatRooms: {
    id: number;
    updatedAt: Date;
    chatRoomMembers: {
      user: {
        id: number;
        name: string;
        avatar: string | null;
      };
      lastReadAt: Date | null;
    }[];
    messages: {
      id: number;
      message: string;
      createdAt: Date;
      userId: number;
    }[];
    product?: {
      id: number;
      name: string;
      price: number;
      photos: string[];
    };
    unreadCount: number;
  }[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatListResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      chatRooms: [],
    });
  }

  try {
    const chatRooms = await client.chatRoom.findMany({
      where: {
        chatRoomMembers: {
          some: {
            userId: req.session.user?.id,
          },
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
          orderBy: {
            createdAt: "desc",
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            photos: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const formattedChatRooms = chatRooms.map((chatRoom) => {
      const member = chatRoom.chatRoomMembers.find(
        (member) => member.userId === req.session.user?.id
      );
      const lastReadAt = member?.lastReadAt;
      const unreadCount = chatRoom.messages.filter(
        (message) =>
          message.userId !== req.session.user?.id &&
          (!lastReadAt || message.createdAt > lastReadAt)
      ).length;

      return {
        id: chatRoom.id,
        updatedAt: chatRoom.updatedAt,
        chatRoomMembers: chatRoom.chatRoomMembers,
        messages: [chatRoom.messages[0]],
        product: chatRoom.product || undefined,
        unreadCount,
      };
    });

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
