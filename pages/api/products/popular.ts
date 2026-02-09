import { NextApiRequest, NextApiResponse } from "next";
import { Product } from "@prisma/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";

export interface PopularProduct extends Product {
  _count: { favs: number };
}

export interface PopularProductsResponse {
  success: boolean;
  products: PopularProduct[];
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) => {
  const products = await client.product.findMany({
    include: {
      _count: {
        select: {
          favs: true,
        },
      },
    },
    orderBy: [{ favs: { _count: "desc" } }, { createdAt: "desc" }],
    take: 10,
  });

  return res.json({
    success: true,
    products,
  });
};

export default withApiSession(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
);
