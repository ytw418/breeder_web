import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { historyWhere, MySellHistoryResponseType } from "./sales";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MySellHistoryResponseType | ResponseType>
) {
  const {
    query: { id },
  } = req;
  // 구매내역은 본인만 본다(비로그인은 withHandler 가 401 로 막는다).
  if (req.user?.id !== Number(id)) {
    return res.status(403).json({
      success: false,
      message: "본인의 구매내역만 볼 수 있습니다.",
    });
  }
  const mySellHistoryData = await client.purchase.findMany({
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
    isPrivate: true,
  })
);
