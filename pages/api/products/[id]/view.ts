import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { extractBearerToken } from "@libs/server/jwt";

/**
 * 상품 조회수를 1 올린다. 상세 화면이 열릴 때 한 번 호출한다.
 * - 비로그인도 센다. 판매자 본인이 보는 것은 세지 않는다(200, counted:false).
 * - 삭제·숨김 상품은 404 로 막고 세지 않는다.
 * - 토큰을 보냈는데 user 가 없으면(만료·무효) 401 로 돌려 세지 않는다. 클라이언트가
 *   refresh 뒤 다시 보내면 새 토큰으로 판매자 본인 여부를 가린다.
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    user,
  } = req;

  // 만료 토큰을 비로그인으로 보고 세면 판매자 본인 조회가 섞인다.
  if (extractBearerToken(req.headers.authorization) && !user) {
    return res.status(401).json({ success: false, message: "인증이 만료되었습니다." });
  }

  const productId = Number(id.toString().split("-")[0]);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: "유효하지 않은 상품 ID입니다." });
  }

  const product = await client.product.findUnique({
    where: { id: productId },
    select: { id: true, userId: true, isDeleted: true, isHidden: true, viewCount: true },
  });

  if (!product || product.isDeleted || product.isHidden) {
    return res.status(404).json({
      success: false,
      message: "삭제되었거나 숨겨진 상품입니다.",
      errorCode: "PRODUCT_HIDDEN",
    });
  }

  if (user?.id === product.userId) {
    return res.json({ success: true, counted: false, viewCount: product.viewCount });
  }

  const updated = await client.product.update({
    where: { id: productId },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });

  return res.json({ success: true, counted: true, viewCount: updated.viewCount });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: false,
  })
);
