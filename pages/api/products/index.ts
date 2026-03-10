import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { notifyFollowers } from "@libs/server/notification";
import { getProductsResponse } from "@libs/server/home";

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

    // 캐싱 전략: 필터 없는 기본 목록은 60초 캐시
    // 필터가 있는 경우 30초 캐시
    const hasFilters = (category && category !== "전체") || productType || status;
    const cacheTime = hasFilters ? 30 : 60;
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
    );

    const response = await getProductsResponse({
      page: Number(page),
      size: Number(size),
      category: typeof category === "string" ? category : undefined,
      productType: typeof productType === "string" ? productType : undefined,
      status: typeof status === "string" ? status : undefined,
    });

    return res.json(response);
  }
};

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
