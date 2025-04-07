import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) => {
  if (req.method === "POST") {
    const {
      body: { name, price, description, photos },
      session: { user },
    } = req;

    if (!user?.id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const product = await client.product.create({
      data: {
        name,
        price: +price,
        description,
        photos: photos || [], // photos가 없을 경우 빈 배열 사용
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    return res.json({
      success: true,
      product,
    });
  }

  if (req.method === "GET") {
    const products = await client.product.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            favs: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      products,
    });
  }
};

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
