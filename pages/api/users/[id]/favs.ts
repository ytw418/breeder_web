import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { MySellHistoryResponseType } from "./sales";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MySellHistoryResponseType | ResponseType>
) {
  const {
    query: { id },
  } = req;
  // 관심목록은 본인만 본다(비로그인은 withHandler 가 401 로 막는다).
  if (req.user?.id !== Number(id)) {
    return res.status(403).json({
      success: false,
      message: "본인의 관심목록만 볼 수 있습니다.",
    });
  }
  // 삭제·숨김 상품은 관심목록에서 뺀다(찜 기록은 남긴다).
  const mySellHistoryData = await client.fav.findMany({
    where: {
      userId: Number(id),
      product: { isDeleted: false, isHidden: false },
    },
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
