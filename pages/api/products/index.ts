import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { notifyFollowers } from "@libs/server/notification";

const LEGACY_INSECT_CATEGORIES = [
  "곤충",
  "장수풍뎅이",
  "사슴벌레",
  "타란튤라",
  "전갈",
  "나비/나방",
  "개미",
  "기타곤충",
];

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

    // 카테고리/타입/상태 필터 조건
    const where: any = {};
    if (category && category !== "전체") {
      if (category === "곤충") {
        // 기존 데이터(사슴벌레/장수풍뎅이 등)와 신규 대분류(곤충)를 함께 조회
        where.category = { in: LEGACY_INSECT_CATEGORIES };
      } else {
        where.category = category as string;
      }
    }
    if (productType) {
      where.productType = productType as string;
    }
    if (status) {
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
        take: Number(size),
        skip: (Number(page) - 1) * Number(size),
      }),
      client.product.count({ where }),
    ]);

    return res.json({
      success: true,
      products,
      pages: Math.ceil(productCount / Number(size)),
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
