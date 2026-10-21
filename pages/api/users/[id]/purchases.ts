import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { displayUserName } from "@libs/shared/deletedUser";
import { historyWhere, MySellHistoryResponseType, withTradeReviewRefs } from "./sales";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MySellHistoryResponseType>
) {
  const {
    query: { id },
  } = req;
  const profileId = Number(id);
  const found = await client.purchase.findMany({
    where: historyWhere(profileId, req.user?.id),
    include: {
      product: {
        include: {
          _count: {
            select: {
              favs: true,
            },
          },
          // 입양내역 카드 아래 '○○님에게 입양'(앱 docs/prd/trade-review.md S-10). 분양 상세에도 보이는 이름이라 공개.
          user: { select: { id: true, name: true } },
        },
      },
    },
  });
  // 탈퇴한 분양자는 '탈퇴한 사용자'로 보인다.
  const rows = found.map((row) => ({
    ...row,
    product: {
      ...row.product,
      user: row.product.user ? { ...row.product.user, name: displayUserName(row.product.user.name) } : null,
    },
  }));
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
