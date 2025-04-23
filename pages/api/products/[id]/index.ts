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

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id },
    session: { user },
    body: { action, data },
  } = req;

  const product = await client.product.findUnique({
    where: {
      id: Number(id),
    },
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
  });

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "상품을 찾을 수 없습니다.",
    });
  }

  if (req.method === "GET") {
    const isLiked = Boolean(
      await client.fav.findFirst({
        where: {
          productId: product.id,
          userId: user?.id,
        },
        select: {
          id: true,
        },
      })
    );

    const terms = product.name.split(" ").map((word) => ({
      name: {
        contains: word,
      },
    }));

    const relatedProducts = await client.product.findMany({
      where: {
        OR: terms,
        AND: {
          id: {
            not: product.id,
          },
        },
      },
    });

    return res.json({
      success: true,
      product,
      isLiked,
      relatedProducts,
    });
  }

  if (req.method === "POST") {
    if (product.user.id !== user?.id) {
      return res.status(403).json({
        success: false,
        message: "권한이 없습니다.",
      });
    }

    switch (action) {
      case "delete":
        await client.product.delete({
          where: {
            id: Number(id),
          },
        });
        return res.json({
          success: true,
        });

      case "update":
        const updatedProduct = await client.product.update({
          where: {
            id: Number(id),
          },
          data: {
            name: data.name,
            price: data.price,
            description: data.description,
            photos: data.photos,
          },
        });
        return res.json({
          success: true,
          product: updatedProduct,
        });

      default:
        return res.status(400).json({
          success: false,
          message: "잘못된 요청입니다.",
        });
    }
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: false,
  })
);
