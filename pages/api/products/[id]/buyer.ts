import type { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { canEditAnyContent } from "@libs/server/adminAccess";
import { extractProductId } from "@libs/product-route";
import { withDetailRevalidation } from "@libs/server/pageRevalidation";
import { captureServerEvent } from "@libs/server/analytics";
import { createNotification } from "@libs/server/notification";
import {
  CANCELLED_TRADE_STATUS,
  COMPLETED_TRADE_STATUS,
  TradeError,
  adopterAssignedMessage,
  buildProductTrade,
  isTradeLocked,
  readTradeSnapshot,
  sendTradeError,
  tradeErrors,
  tradeStateOf,
  tradeUserName,
  withTradeLock,
} from "@libs/server/trade";
import { parseBuyerChoice, validateBuyerCandidate, type BuyerChoice } from "@libs/server/tradeCandidates";
import { SOLD_PRODUCT_STATUS, type TradeBuyerSource } from "@libs/shared/tradeReview";

/**
 * POST /api/products/:id/buyer {buyerId?, buyerExternal?, clear?} — 분양완료한 글의 입양자 지정·바꾸기·해제
 * (앱 docs/prd/trade-review.md §4 B). 분양자·운영자 이메일 계정만. 지금 입양자의 입양 확정·후기가 있으면 400 TRADE_LOCKED.
 * 같은 선택을 다시 보내면 아무것도 바꾸지 않고 성공한다(알림도 다시 보내지 않는다).
 */

const sourceOf = (choice: Exclude<BuyerChoice, { kind: "empty" }>): TradeBuyerSource | null =>
  choice.kind === "bredy" ? "bredy" : choice.kind === "external" ? "external" : null;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = req.user!;
  const productId = Number(extractProductId(req.query.id));
  const product = Number.isSafeInteger(productId)
    ? await client.product.findUnique({
        where: { id: productId },
        include: { user: { select: { id: true, name: true } } },
      })
    : null;
  if (!product || product.isDeleted) {
    return res.status(404).json({ success: false, message: "분양글을 찾을 수 없습니다.", errorCode: "PRODUCT_NOT_FOUND" });
  }
  if (product.userId !== user.id && !canEditAnyContent(user)) {
    return res.status(403).json({ success: false, message: "권한이 없습니다.", errorCode: "FORBIDDEN" });
  }
  const choice = parseBuyerChoice(req.body);
  if (!choice || choice.kind === "empty") return sendTradeError(res, tradeErrors.invalidBuyer());
  if (product.status !== SOLD_PRODUCT_STATUS) return sendTradeError(res, tradeErrors.notSoldForBuyer());

  const buyerId = choice.kind === "bredy" ? choice.buyerId : null;
  const buyerSource = sourceOf(choice);
  let outcome: { changed: boolean; legacyPurchase: boolean };
  let rank: Awaited<ReturnType<typeof validateBuyerCandidate>> | null = null;
  try {
    rank = buyerId != null ? await validateBuyerCandidate(product.id, product.userId, buyerId) : null;
    outcome = await withTradeLock(product.id, async (tx) => {
      const fresh = await tx.product.findUnique({ where: { id: product.id }, select: { status: true } });
      if (fresh?.status !== SOLD_PRODUCT_STATUS) throw tradeErrors.notSoldForBuyer();
      const snapshot = await readTradeSnapshot(tx, product.id);
      if (!snapshot.sale) throw tradeErrors.noSale();
      const state = tradeStateOf(product, snapshot, null);
      if (state.buyerSource === buyerSource && state.buyerId === buyerId) {
        return { changed: false, legacyPurchase: false };
      }
      if (isTradeLocked(state)) throw tradeErrors.buyerLocked();
      // 읽은 입양자 칸 그대로일 때만 바꾼다(다른 경로가 먼저 바꿨으면 409).
      const updated = await tx.sale.updateMany({
        where: {
          id: snapshot.sale.id,
          status: COMPLETED_TRADE_STATUS,
          buyerId: snapshot.sale.buyerId,
          buyerSource: snapshot.sale.buyerSource,
        },
        data: { buyerId, buyerSource, buyerAssignedAt: buyerSource ? new Date() : null },
      });
      if (updated.count === 0) throw tradeErrors.conflict();
      if (buyerId == null) return { changed: true, legacyPurchase: false };
      const legacy = await tx.purchase.findFirst({
        where: { productId: product.id, userId: buyerId, status: { not: CANCELLED_TRADE_STATUS } },
        select: { id: true },
      });
      return { changed: true, legacyPurchase: Boolean(legacy) };
    });
  } catch (error) {
    if (error instanceof TradeError) return sendTradeError(res, error);
    throw error;
  }

  if (outcome.changed) {
    await captureServerEvent(user.id, "adopter_assigned", {
      product_id: product.id,
      source: buyerSource ?? "none",
      from: "buyer_api",
      candidate_rank: rank,
    });
    if (buyerId != null) {
      await createNotification({
        type: "ADOPTER_ASSIGNED",
        userId: buyerId,
        senderId: product.userId,
        message: adopterAssignedMessage(await tradeUserName(product.userId, product.user.name), outcome.legacyPurchase),
        targetId: product.id,
        targetType: "product",
        // 입양자를 바꿨다 되돌려도(A→B→A) 다시 알린다.
        dedupe: false,
      });
      if (outcome.legacyPurchase) {
        await captureServerEvent(buyerId, "adoption_confirmed", {
          product_id: product.id,
          legacy_purchase: true,
        });
      }
    }
  }
  return res.json({ success: true, trade: await buildProductTrade(product, user) });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler: withDetailRevalidation(handler, (req) => [
      { type: "PRODUCT", id: Number(extractProductId(req.query.id)) },
    ]),
    isPrivate: true,
  })
);
