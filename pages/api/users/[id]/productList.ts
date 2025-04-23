import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";

export interface ProductListQuery {
  id?: string | string[];
  page?: string | string[];
  size?: string | string[];
  order?: string | string[];
}

export interface ProductListResponse {
  success: boolean;
  products: {
    id: number;
    name: string;
    price: number;
    description: string;
    photos: string[];
    createdAt: Date;
    _count: {
      favs: number;
    };
  }[];
  pages: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType | ProductListResponse>
) {
  if (req.method === "GET") {
    const {
      query: { id = "", page = 1, size = 999999, order = "desc" },
    } = req as { query: ProductListQuery };

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "사용자 ID가 필요합니다.",
      });
    }

    if (order !== "asc" && order !== "desc") {
      return res.status(400).json({
        success: false,
        message: "정렬 순서는 'asc' 또는 'desc'만 가능합니다.",
      });
    }

    const pageSize = Math.min(Math.max(1, +size), 50); // 최소 1, 최대 50개로 제한

    const products = await client.product.findMany({
      where: {
        userId: +id.toString(),
      },
      include: {
        _count: {
          select: {
            favs: true,
          },
        },
      },
      orderBy: {
        createdAt: order as "asc" | "desc",
      },
      take: pageSize,
      skip: (+page - 1) * pageSize,
    });

    const productCount = await client.product.count({
      where: {
        userId: +id.toString(),
      },
    });

    res.json({
      success: true,
      products,
      pages: Math.ceil(productCount / pageSize),
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
