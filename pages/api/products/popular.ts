import { NextApiRequest, NextApiResponse } from "next";
import { Product } from "@prisma/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { excludedAuthorIds, setViewerCacheHeader } from "@libs/server/blocks";

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
  // 캐싱 헤더 설정: 5분간 캐시, 10분간 stale-while-revalidate
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=600'
  );
  const viewerId = req.user?.id;
  setViewerCacheHeader(res, viewerId);

  // 숨김·삭제 상품은 항상 빼고, viewer 가 차단한 판매자의 상품도 뺀다.
  const excluded = await excludedAuthorIds(viewerId);
  const products = await client.product.findMany({
    where: {
      isHidden: false,
      isDeleted: false,
      ...(excluded.length ? { userId: { notIn: excluded } } : {}),
    },
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

export default withAuth(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
);
