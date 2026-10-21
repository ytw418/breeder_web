import type { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { extractProductId } from "@libs/product-route";
import { withDetailRevalidation } from "@libs/server/pageRevalidation";
import { captureServerEvent } from "@libs/server/analytics";
import { createNotification } from "@libs/server/notification";
import { TradeError, sendTradeError, tradeUserName, withTradeLock } from "@libs/server/trade";
import {
  findProductReviewRow,
  serializeTradeReview,
  tradeReviewSelect,
  tradeReviewTargets,
  type TradeReviewRow,
} from "@libs/server/tradeReview";
import { BLOCKED_WORD_MESSAGE, findBlockedWord } from "@libs/shared/contentFilter";
import { TRADE_REVIEW_REPLY_MAX } from "@libs/shared/tradeReview";

/**
 * POST /api/products/:id/review/reply {text} — 분양자 답글(한 번, 1~300자. 앱 docs/prd/trade-review.md §4 C).
 * 분양자만(403), 후기 없음 404, 답글 있음 409 REPLY_EXISTS, 금칙어 400 BLOCKED_WORD. 입양자에게 TRADE_REVIEW_REPLIED.
 * 지운 분양글·숨긴 후기에도 답글은 남길 수 있다(상세 trade.canReply 와 같은 기준).
 */

const replyErrors = {
  notFound: () => new TradeError(404, "REVIEW_NOT_FOUND", "후기를 찾을 수 없어요."),
  exists: () => new TradeError(409, "REPLY_EXISTS", "답글은 한 번만 남길 수 있어요."),
};

const sendError = (res: NextApiResponse, status: number, errorCode: string, message: string) =>
  res.status(status).json({ success: false, error: message, message, errorCode });

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = req.user!;
  const productId = Number(extractProductId(req.query.id));
  const product = Number.isSafeInteger(productId)
    ? await client.product.findUnique({ where: { id: productId }, select: { id: true, userId: true } })
    : null;
  if (!product) return sendError(res, 404, "PRODUCT_NOT_FOUND", "분양글을 찾을 수 없습니다.");
  if (product.userId !== user.id) return sendError(res, 403, "FORBIDDEN", "분양자만 답글을 남길 수 있어요.");

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > TRADE_REVIEW_REPLY_MAX) {
    return sendError(res, 400, "INVALID_REPLY", `답글은 1~${TRADE_REVIEW_REPLY_MAX}자로 써 주세요.`);
  }
  if (findBlockedWord(text)) return sendError(res, 400, "BLOCKED_WORD", BLOCKED_WORD_MESSAGE);

  let review: TradeReviewRow;
  try {
    review = await withTradeLock(product.id, async (tx) => {
      const row = await findProductReviewRow(tx, product.id);
      if (!row) throw replyErrors.notFound();
      if (row.reply) throw replyErrors.exists();
      // 읽은 뒤 다른 요청이 먼저 답글을 달았으면 0행 → 409.
      const updated = await tx.review.updateMany({
        where: { id: row.id, reply: null },
        data: { reply: text, repliedAt: new Date() },
      });
      if (updated.count === 0) throw replyErrors.exists();
      return (await tx.review.findUnique({ where: { id: row.id }, select: tradeReviewSelect })) ?? row;
    });
  } catch (error) {
    if (error instanceof TradeError) return sendTradeError(res, error);
    throw error;
  }

  await createNotification({
    type: "TRADE_REVIEW_REPLIED",
    userId: review.createdById,
    senderId: user.id,
    message: `${await tradeUserName(user.id, user.name)}님이 후기에 답글을 남겼어요.`,
    targetId: product.id,
    targetType: "product",
    dedupe: true,
  });
  await captureServerEvent(user.id, "trade_review_replied", { product_id: product.id });
  return res.json({ success: true, review: serializeTradeReview(review, user) });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler: withDetailRevalidation(handler, (req) => tradeReviewTargets(Number(extractProductId(req.query.id)))),
    isPrivate: true,
  })
);
