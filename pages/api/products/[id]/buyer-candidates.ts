import type { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { canEditAnyContent } from "@libs/server/adminAccess";
import { extractProductId } from "@libs/product-route";
import { getBuyerCandidates } from "@libs/server/tradeCandidates";
import type { BuyerCandidatesResponse } from "@libs/shared/tradeReview";

/**
 * GET /api/products/:id/buyer-candidates — '누구에게 분양했나요?' 시트의 입양자 후보(앱 docs/prd/trade-review.md §3.4).
 * 분양자·운영자 이메일 계정만. 분양완료 처리 전(판매중·예약중)에도 연다. 비로그인 401(앱 web-prereqs 가 이 응답으로 배포를 확인한다).
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = req.user!;
  const productId = Number(extractProductId(req.query.id));
  const product = Number.isSafeInteger(productId)
    ? await client.product.findUnique({
        where: { id: productId },
        select: { id: true, userId: true, isDeleted: true },
      })
    : null;
  if (!product || product.isDeleted) {
    return res.status(404).json({ success: false, message: "분양글을 찾을 수 없습니다.", errorCode: "PRODUCT_NOT_FOUND" });
  }
  if (product.userId !== user.id && !canEditAnyContent(user)) {
    return res.status(403).json({ success: false, message: "권한이 없습니다.", errorCode: "FORBIDDEN" });
  }
  const candidates = await getBuyerCandidates(product.id, product.userId);
  res.setHeader("Cache-Control", "private, no-store");
  const body: BuyerCandidatesResponse = { success: true, ...candidates };
  return res.json(body);
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
