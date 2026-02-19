import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { notifyFollowers } from "@libs/server/notification";
import { getCategoryFilterValues } from "@libs/categoryTaxonomy";

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) => {
  if (req.method === "POST") {
    const {
      body: { name, price, description, photos, category, productType },
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
        photos: photos || [],
        category: category || null,
        productType: productType || null,
        mainImage: photos?.[0] || null,
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    // 팔로워들에게 새 상품 등록 알림
    const seller = await client.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });

    if (seller) {
      notifyFollowers({
        senderId: user.id,
        type: "NEW_PRODUCT",
        message: `${seller.name}님이 새 상품을 등록했습니다: ${name}`,
        targetId: product.id,
        targetType: "product",
      });
    }

    return res.json({
      success: true,
      product,
    });
  }

  if (req.method === "GET") {
    const {
      query: { page = 1, size = 10, category, productType, status },
    } = req;

    const pageNumber = Number(page);
    const sizeNumber = Number(size);
    const normalizedPage = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const normalizedSize = Number.isInteger(sizeNumber) && sizeNumber > 0
      ? Math.min(sizeNumber, 50)
      : 10;

    // 카테고리/타입/상태 필터 조건
    const where: any = {};
    if (category && category !== "전체") {
      where.category = { in: getCategoryFilterValues(String(category)) };
    }
    if (productType && productType !== "전체") {
      where.productType = productType as string;
    }
    if (status && status !== "전체") {
      where.status = status as string;
    }

    const [products, productCount] = await Promise.all([
      client.product.findMany({
        where,
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
        take: normalizedSize,
        skip: (normalizedPage - 1) * normalizedSize,
      }),
      client.product.count({ where }),
    ]);

    return res.json({
      success: true,
      products,
      pages: Math.ceil(productCount / normalizedSize),
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
