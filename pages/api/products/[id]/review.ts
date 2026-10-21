import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import withHandler from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { extractProductId } from "@libs/product-route";
import { withDetailRevalidation } from "@libs/server/pageRevalidation";
import { captureServerEvent } from "@libs/server/analytics";
import { createNotification } from "@libs/server/notification";
import { isCrewUser } from "@libs/server/crew";
import { setViewerCacheHeader } from "@libs/server/blocks";
import {
  TradeError,
  readTradeSnapshot,
  sendTradeError,
  tradeStateOf,
  tradeUserName,
  withTradeLock,
} from "@libs/server/trade";
import {
  readProductReview,
  reviewSentWithConfirm,
  serializeTradeReview,
  tradeReviewSelect,
  tradeReviewTargets,
  type TradeReviewRow,
} from "@libs/server/tradeReview";
import { normalizeReviewKeywords, tradeReviewSummary } from "@libs/shared/tradeReview";

/**
 * 거래 후기(앱 docs/prd/trade-review.md §4 C).
 * GET  /api/products/:id/review → {success, review}(공개, 숨긴 후기는 작성자·분양자·운영자에게만 자리표시)
 * POST /api/products/:id/review {keywords} → 201 {success, review}
 *   - 자격: 분양자가 지정한 입양자 · 입양 확정함(취소 제외). 그 뒤 글 삭제·숨김·차단으로는 막지 않는다
 *     (분양자가 차단·삭제로 후기를 막지 못하게). 알림만 차단이면 억제한다(createNotification).
 *   - 글당 1개(409 REVIEW_EXISTS), 크루 403, 키워드는 1~5개 · 용품 글엔 개체 키워드 불가(400 INVALID_KEYWORDS).
 *   - 거래 lock(withTradeLock) 안에서 다시 읽고 판정한다.
 */

const reviewErrors = {
  notAllowed: () => new TradeError(403, "REVIEW_NOT_ALLOWED", "입양 확정한 입양자만 후기를 남길 수 있어요."),
  exists: () => new TradeError(409, "REVIEW_EXISTS", "이 분양글에는 이미 후기가 있어요."),
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = req.user;
  const productId = Number(extractProductId(req.query.id));
  // 지운 분양글에도 후기는 남고 쓸 수 있다(isDeleted 를 거르지 않는다).
  const product = Number.isSafeInteger(productId)
    ? await client.product.findUnique({
        where: { id: productId },
        select: { id: true, userId: true, status: true, isDeleted: true, productType: true },
      })
    : null;
  if (!product) {
    return res.status(404).json({ success: false, message: "분양글을 찾을 수 없습니다.", errorCode: "PRODUCT_NOT_FOUND" });
  }

  if (req.method === "GET") {
    // 숨긴 후기 자리표시가 보는 사람마다 달라 로그인 응답은 공유 캐시에 두지 않는다.
    setViewerCacheHeader(res, user?.id);
    return res.json({ success: true, review: await readProductReview(product.id, user) });
  }

  if (!user) {
    return res.status(401).json({ success: false, message: "로그인이 필요합니다." });
  }
  if (isCrewUser(user)) {
    return res.status(403).json({
      success: false,
      error: "운영 계정은 거래 후기를 남길 수 없어요.",
      message: "운영 계정은 거래 후기를 남길 수 없어요.",
      errorCode: "CREW_NOT_ALLOWED",
    });
  }
  const keywords = normalizeReviewKeywords(req.body?.keywords, product.productType);
  if (!keywords) {
    return res.status(400).json({
      success: false,
      error: "후기 키워드를 1~5개 골라 주세요.",
      message: "후기 키워드를 1~5개 골라 주세요.",
      errorCode: "INVALID_KEYWORDS",
    });
  }

  let created: TradeReviewRow;
  try {
    created = await withTradeLock(product.id, async (tx) => {
      const snapshot = await readTradeSnapshot(tx, product.id);
      const state = tradeStateOf(product, snapshot, user.id);
      if (state.buyerId !== user.id || !snapshot.purchaserIds.includes(user.id)) throw reviewErrors.notAllowed();
      if (snapshot.review) throw reviewErrors.exists();
      return tx.review.create({
        data: {
          productId: product.id,
          createdById: user.id,
          createdForId: product.userId,
          review: "",
          keywords,
          score: 1,
        },
        select: tradeReviewSelect,
      });
    });
  } catch (error) {
    if (error instanceof TradeError) return sendTradeError(res, error);
    // lock 밖에서 같은 입양자가 겹쳐 보낸 경우(@@unique productId·createdById)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return sendTradeError(res, reviewErrors.exists());
    }
    throw error;
  }

  await createNotification({
    type: "TRADE_REVIEW_RECEIVED",
    userId: product.userId,
    senderId: user.id,
    message: `${await tradeUserName(user.id, user.name)}님이 거래 후기를 남겼어요 · ${tradeReviewSummary(keywords)}`,
    targetId: product.id,
    targetType: "product",
    dedupe: true,
  });
  await captureServerEvent(user.id, "trade_review_created", {
    product_id: product.id,
    keyword_count: keywords.length,
    with_confirm: await reviewSentWithConfirm(product.id, user.id),
  });

  return res.status(201).json({ success: true, review: serializeTradeReview(created, user) });
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    // 후기를 쓰면 분양글 상세(후기 블록)·분양자 프로필('후기 N')·받은 후기 목록을 다시 만든다.
    handler: withDetailRevalidation(handler, (req) => tradeReviewTargets(Number(extractProductId(req.query.id)))),
    isPrivate: false,
  })
);
