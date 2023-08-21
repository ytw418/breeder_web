import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { Product, User } from "@prisma/client";

export interface ProductWithUser extends Product {
  user: User;
}

export interface ItemDetailResponse {
  success: boolean;
  error?: string;
  product?: ProductWithUser;
  relatedProducts?: Product[];
  isLiked?: boolean;
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType | ItemDetailResponse>
) => {
  const {
    query: { id = "" },
    session: { user },
  } = req;

  const product = await client.product.findUnique({
    where: {
      id: +id,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
  });

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "제품을 찾을 수 없습니다.",
    });
  }
  const terms = product?.name.split(" ").map((word) => ({
    name: {
      contains: word,
    },
  }));
  const relatedProducts = await client.product.findMany({
    where: {
      OR: terms,
      AND: {
        id: {
          not: product?.id,
        },
      },
    },
  });

  const isLiked = Boolean(
    await client.fav.findFirst({
      where: {
        productId: product?.id,
        userId: user?.id,
      },
      select: {
        id: true,
      },
    })
  );

  res.json({
    success: true,
    product,
    isLiked,
    relatedProducts,
  });
};

export default withApiSession(
  withHandler({ methods: ["GET"], handler, isPrivate: false })
);
