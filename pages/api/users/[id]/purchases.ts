import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { historyWhere, MySellHistoryResponseType, withTradeReviewRefs } from "./sales";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MySellHistoryResponseType>
) {
  const {
    query: { id },
  } = req;
  const profileId = Number(id);
  const rows = await client.purchase.findMany({
    where: historyWhere(profileId, req.user?.id),
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
  // 본인에게만 내가 쓴 거래 후기 요약을 붙인다('거래 후기 쓰기' pill, 앱 docs/prd/trade-review.md).
  const mySellHistoryData =
    req.user?.id === profileId ? await withTradeReviewRefs(rows, { createdById: profileId }) : rows;
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
