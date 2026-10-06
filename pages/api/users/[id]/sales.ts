import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";

interface Sale {
  id: number;
  userId: number;
  productId: number;
  createdAt: Date;
  product: {
    id: number;
    name: string;
    price: number | null;
    description: string;
    photos: string[];
    createdAt: Date;
    /** 판매자가 삭제했거나 관리자가 숨긴 상품. 기록 당사자(본인)에게만 내려간다. */
    isDeleted: boolean;
    isHidden: boolean;
    _count: {
      favs: number;
    };
  };
}

/**
 * 판매·구매내역 where. 본인에게는 삭제·숨김 상품도 기록으로 남기고,
 * 다른 사람(비로그인 포함)에게는 빼고 준다.
 */
export const historyWhere = (profileId: number, viewerId?: number) => ({
  userId: profileId,
  ...(viewerId === profileId ? {} : { product: { isDeleted: false, isHidden: false } }),
});

export interface MySellHistoryResponseType {
  success: boolean;
  mySellHistoryData: Sale[];
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MySellHistoryResponseType>
) {
  const {
    query: { id },
  } = req;

  const mySellHistoryData = await client.sale.findMany({
    where: historyWhere(Number(id), req.user?.id),
    include: {
      product: {
        include: {
          _count: {
            select: {
              favs: true,
            },
          },
        },
      },
    },
  });
  res.json({
    success: true,
    mySellHistoryData,
  });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
