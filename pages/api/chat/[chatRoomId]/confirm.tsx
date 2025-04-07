import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { ChatRoom, ChatRoomMember } from "@prisma/client";

interface ConfirmResponse {
  success: boolean;
  error?: string;
  chatRoom?: {
    id: number;
    buyerConfirmed: boolean;
    sellerConfirmed: boolean;
    isCompleted: boolean;
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfirmResponse>
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
      body: { isBuyer },
    } = req;

    if (!user?.id) {
      return res.json({ success: false, error: "로그인이 필요합니다." });
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
      include: {
        chatRoomMembers: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!chatRoom) {
      return res.json({ success: false, error: "채팅방을 찾을 수 없습니다." });
    }

    // Check if the user is actually the buyer or seller
    const isUserBuyer = chatRoom.chatRoomMembers.some(
      (member) => member.userId === user.id && member.isBuyer
    );

    if (isBuyer !== isUserBuyer) {
      return res.json({ success: false, error: "권한이 없습니다." });
    }

    // Update confirmation status
    const updatedChatRoom = await client.chatRoom.update({
      where: {
        id: +chatRoomId!,
      },
      data: {
        buyerConfirmed: isBuyer ? true : chatRoom.buyerConfirmed,
        sellerConfirmed: !isBuyer ? true : chatRoom.sellerConfirmed,
        isCompleted: isBuyer
          ? chatRoom.sellerConfirmed
          : chatRoom.buyerConfirmed,
      },
    });

    // If transaction is completed, create Purchase and Sale records
    if (updatedChatRoom.isCompleted && updatedChatRoom.productId) {
      const buyer = chatRoom.chatRoomMembers.find((member) => member.isBuyer);
      const seller = chatRoom.chatRoomMembers.find((member) => !member.isBuyer);

      if (buyer && seller) {
        await client.$transaction([
          client.purchase.create({
            data: {
              userId: buyer.userId,
              productId: updatedChatRoom.productId,
              status: "completed",
            },
          }),
          client.sale.create({
            data: {
              userId: seller.userId,
              productId: updatedChatRoom.productId,
              status: "completed",
            },
          }),
        ]);
      }
    }

    return res.json({
      success: true,
      chatRoom: {
        id: updatedChatRoom.id,
        buyerConfirmed: updatedChatRoom.buyerConfirmed,
        sellerConfirmed: updatedChatRoom.sellerConfirmed,
        isCompleted: updatedChatRoom.isCompleted,
      },
    });
  } catch (error) {
    console.error("Error in confirm handler:", error);
    return res.json({
      success: false,
      error: "거래 확정에 실패했습니다.",
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
