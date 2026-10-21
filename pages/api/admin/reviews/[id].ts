import type { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { withDetailRevalidation } from "@libs/server/pageRevalidation";
import { tradeReviewTargets } from "@libs/server/tradeReview";
import { parsePositiveIntId } from "@libs/shared/normalize";

/**
 * PATCH /api/admin/reviews/:id {isHidden} — 운영자 거래 후기 숨김·해제(web-only, 앱 docs/prd/trade-review.md §3.6).
 * 웹 후기 블록 ⋯ 운영자 메뉴에서 부른다. 숨긴 후기는 '후기 N'·키워드 집계·받은 후기 목록에서 빠지고,
 * 작성자·분양자·운영자에게만 '숨겨진 후기' 자리표시로 보인다. 분양글 상세·분양자 프로필·받은 후기 목록을 다시 만든다.
 */

const reviewIdOf = (req: NextApiRequest) => parsePositiveIntId(req.query.id);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isModeratorUser(req.user)) {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다.", errorCode: "FORBIDDEN" });
  }
  const id = reviewIdOf(req);
  const isHidden = req.body?.isHidden;
  if (!id || typeof isHidden !== "boolean") {
    return res.status(400).json({ success: false, error: "잘못된 요청입니다.", errorCode: "INVALID_REQUEST" });
  }
  const updated = await client.review.updateMany({ where: { id }, data: { isHidden } });
  if (updated.count === 0) {
    return res.status(404).json({ success: false, error: "후기를 찾을 수 없어요.", errorCode: "REVIEW_NOT_FOUND" });
  }
  return res.json({ success: true, isHidden });
}

export default withAuth(
  withHandler({
    methods: ["PATCH"],
    handler: withDetailRevalidation(handler, async (req) => {
      const id = reviewIdOf(req);
      if (!id) return [];
      const review = await client.review.findUnique({ where: { id }, select: { productId: true } });
      return tradeReviewTargets(review?.productId);
    }),
    isPrivate: true,
  })
);
