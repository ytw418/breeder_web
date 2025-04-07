import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import {
  ChatRoom as PrismaChatRoom,
  Message as PrismaMessage,
  User,
} from "@prisma/client";

export interface ChatRoomMember {
  id: number;
  userId: number;
  chatRoomId: number;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  isBuyer: boolean;
  lastReadAt: string | null;
}

export interface Message {
  id: number;
  message: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

interface Product {
  id: number;
  name: string;
  price: number;
  photos: string[];
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
}

export interface ChatRoom {
  id: number;
  type: "profile" | "product";
  productId: number | null;
  chatRoomMembers: ChatRoomMember[];
  messages: Message[];
  product?: Product;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  isCompleted: boolean;
}

export interface ChatRoomResponse {
  success: boolean;
  error?: string;
  chatRoom?: ChatRoom;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatRoomResponse>
) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      query: { chatRoomId },
      session: { user },
    } = req;

    if (!user?.id) {
      return res.json({ success: false, error: "로그인이 필요합니다." });
    }

    const chatRoom = await client.chatRoom.findUnique({
      where: {
        id: +chatRoomId!,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            photos: true,
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
          select: {
            id: true,
            message: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        chatRoomMembers: {
          select: {
            id: true,
            userId: true,
            chatRoomId: true,
            isBuyer: true,
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
      return res.json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    return res.json({
      success: true,
      chatRoom: {
        id: chatRoom.id,
        type: chatRoom.type as "profile" | "product",
        productId: chatRoom.productId,
        product: chatRoom.product || undefined,
        messages: chatRoom.messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        })),
        chatRoomMembers: chatRoom.chatRoomMembers.map((member) => ({
          ...member,
          lastReadAt: member.lastReadAt?.toISOString() || null,
        })),
        buyerConfirmed: chatRoom.buyerConfirmed,
        sellerConfirmed: chatRoom.sellerConfirmed,
        isCompleted: chatRoom.isCompleted,
      },
    });
  } catch (error) {
    console.error("Error in chat room handler:", error);
    return res.json({
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
