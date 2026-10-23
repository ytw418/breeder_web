import type { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { extractProductId } from "@libs/product-route";
import { captureServerEvent } from "@libs/server/analytics";
import { createNotification } from "@libs/server/notification";
import {
  TradeError,
  canRequestBuyerFor,
  readTradeSnapshot,
  sendTradeError,
  tradeErrors,
  tradeStateOf,
  tradeUserName,
  withTradeLock,
} from "@libs/server/trade";

/**
 * POST /api/products/:id/buyer-request — 미지정 분양글의 '제가 입양했어요 — 입양자 지정 요청'(앱 docs/prd/trade-review.md §1.2).
 * 분양자에게 ADOPTER_REQUESTED 를 보낸다(글·사람당 한 번). Sale 은 바꾸지 않는다 — 지정은 분양자가 한다.
 * 자격(trade.canRequestBuyer)이 없으면 403 REQUEST_NOT_ALLOWED.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = req.user!;
  const productId = Number(extractProductId(req.query.id));
  const product = Number.isSafeInteger(productId)
    ? await client.product.findUnique({
        where: { id: productId },
        // dealType: 임보 글은 지정 요청이 없다(tradeStateOf → noTrade).
        select: { id: true, userId: true, status: true, isDeleted: true, isHidden: true, dealType: true },
      })
    : null;
  if (!product || product.isDeleted || product.isHidden) {
    return res.status(404).json({ success: false, message: "분양글을 찾을 수 없습니다.", errorCode: "PRODUCT_NOT_FOUND" });
  }

  try {
    await withTradeLock(product.id, async (tx) => {
      const snapshot = await readTradeSnapshot(tx, product.id);
      const allowed = await canRequestBuyerFor(user, tradeStateOf(product, snapshot, user.id), snapshot, tx);
      if (!allowed) throw tradeErrors.requestNotAllowed();
    });
  } catch (error) {
    if (error instanceof TradeError) return sendTradeError(res, error);
    throw error;
  }

  await createNotification({
    type: "ADOPTER_REQUESTED",
    userId: product.userId,
    senderId: user.id,
    message: `${await tradeUserName(user.id, user.name)}님이 입양자 지정을 요청했어요. 맞다면 입양자로 지정해 주세요.`,
    targetId: product.id,
    targetType: "product",
    dedupe: true,
  });
  await captureServerEvent(user.id, "adopter_requested", { product_id: product.id });
  return res.json({ success: true });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
