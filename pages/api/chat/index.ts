import client from "@libs/server/client";
import withHandler from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";

export interface ChatRequestType {
  otherId: number;
  productId?: number;
  type?: "profile" | "product";
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
      body: { otherId, productId, type = "profile" },
    } = req;

    if (!user?.id) {
      return res.json({ success: false, error: "로그인이 필요합니다." });
    }

    if (!otherId) {
      return res.json({ success: false, error: "otherId가 없습니다." });
    }

    // 기존 채팅방 찾기
    const existingChatRoom = await client.chatRoom.findFirst({
      where: {
        AND: [
          {
            chatRoomMembers: {
              some: {
                userId: user.id,
              },
            },
          },
          {
            chatRoomMembers: {
              some: {
                userId: otherId,
              },
            },
          },
          type === "product" && productId
            ? {
                type: "product",
                productId: productId,
              }
            : {
                type: "profile",
              },
        ],
      },
      select: {
        id: true,
      },
    });

    // 기존 채팅방이 있으면 해당 채팅방 ID 반환
    if (existingChatRoom) {
      return res.json({ success: true, ChatRoomId: existingChatRoom.id });
    }

    // 새로운 채팅방 생성
    const newChatRoomId = await createChatRoomWithMembers(
      [user.id, otherId],
      type === "product" ? productId : undefined
    );

    return res.json({ success: true, ChatRoomId: newChatRoomId });
  } catch (error) {
    console.error("Error in chat handler:", error);
    return res.json({
      success: false,
      error: "채팅방 생성 중 오류가 발생했습니다.",
    });
  }
}

/** 유저가 있는 채팅방 찾기 1:1 */
const findChatRoomByUserIds = async (userIds: number[]) => {
  return await client.chatRoom.findFirst({
    where: {
      chatRoomMembers: {
        every: {
          AND: [{ userId: userIds[0] }, { userId: userIds[1] }],
        },
      },
    },
  });
};
/** ChatRoom을 생성합니다 */
const createChatRoomWithMembers = async (
  userIds: number[],
  productId?: number
) => {
  // If this is a product chat, determine who is the buyer and seller
  let buyerId: number | undefined;
  if (productId) {
    const product = await client.product.findUnique({
      where: { id: productId },
      select: { userId: true },
    });
    if (product) {
      // The product owner is the seller, the other user is the buyer
      buyerId = userIds.find((id) => id !== product.userId);
    }
  }

  const createdChatRoom = await client.chatRoom.create({
    data: {
      type: productId ? "product" : "profile",
      productId,
      chatRoomMembers: {
        createMany: {
          data: userIds.map((userId) => ({
            userId,
            isBuyer: productId ? userId === buyerId : false,
          })),
        },
      },
    },
  });

  return createdChatRoom.id;
};

/** 기존 채팅방의 isBuyer 필드를 업데이트합니다 */
const updateExistingChatRoomBuyers = async () => {
  const chatRooms = await client.chatRoom.findMany({
    where: {
      type: "product",
    },
    include: {
      product: {
        select: {
          userId: true,
        },
      },
      chatRoomMembers: true,
    },
  });

  for (const chatRoom of chatRooms) {
    if (!chatRoom.product) continue;

    const sellerId = chatRoom.product.userId;
    const buyerId = chatRoom.chatRoomMembers.find(
      (member) => member.userId !== sellerId
    )?.userId;

    if (buyerId) {
      await client.chatRoomMember.updateMany({
        where: {
          chatRoomId: chatRoom.id,
          userId: buyerId,
        },
        data: {
          isBuyer: true,
        },
      });
      await client.chatRoomMember.updateMany({
        where: {
          chatRoomId: chatRoom.id,
          userId: sellerId,
        },
        data: {
          isBuyer: false,
        },
      });
    }
  }
};

export default withApiSession(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
