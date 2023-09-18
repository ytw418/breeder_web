import client from "@libs/server/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { withApiSession } from "@libs/server/withSession";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    session: { user },
    query: { id, sellerId },
  } = req;

  const findTalkToSeller = await client.talkToSeller.findFirst({
    where: {
      productId: Number(id),
      createdSellerId: Number(sellerId),
    },
    select: {
      id: true,
    },
  });

  if (!findTalkToSeller) {
    const createTalkToSeller = await client.talkToSeller.create({
      data: {
        product: {
          connect: {
            id: Number(id),
          },
        },
        buyer: {
          connect: {
            id: user?.id,
          },
        },
        seller: {
          connect: {
            id: Number(sellerId),
          },
        },
      },
    });
    if (createTalkToSeller) {
      res.json({ success: true, createTalkToSeller });
    } else {
      res.json({ success: false });
    }
  } else if (findTalkToSeller) {
    const findTalkToSellerUniq = await client.talkToSeller.findUnique({
      where: {
        id: findTalkToSeller.id,
      },
      select: {
        id: true,
        createdBuyerId: true,
        createdSellerId: true,
        isbuy: true,
        issold: true,
        productId: true,
        isSell: true,
        product: {
          select: {
            id: true,
            image: true,
            price: true,
            description: true,
            name: true,
          },
        },
        messages: {
          select: {
            userId: true,
            message: true,
            talktosellerId: true,
            user: {
              select: {
                id: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
    res.json({ success: true, findTalkToSellerUniq });
  } else {
    res.json({ success: false });
  }
}

export default withApiSession(
  withHandler({ methods: ["GET"], handler, isPrivate: true })
);
