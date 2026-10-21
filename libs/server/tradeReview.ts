import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { isModeratorUser } from "@libs/server/adminAccess";
import { displayUserName } from "@libs/shared/deletedUser";
import { CANCELLED_TRADE_STATUS } from "@libs/server/trade";
import type { DetailTarget } from "@libs/server/pageRevalidation";
import {
  TRADE_REVIEW_KEYWORDS,
  type ProductTradeReview,
  type TradeReviewPublic,
  type TradeReviewRef,
} from "@libs/shared/tradeReview";

/**
 * 거래 후기 서버 공용(앱 docs/prd/trade-review.md §3.5·§3.6·§4 C).
 * - 후기는 분양글당 1개(코드 규칙)라 분양글의 후기는 가장 먼저 쓴 1개를 읽는다.
 * - 운영자가 숨긴 후기는 작성자·분양자·운영자에게만 자리표시({id, hidden:true})로, 그 외에는 null 로 준다.
 */

type Db = Prisma.TransactionClient | typeof client;

/** 후기 응답을 만드는 데 필요한 칸. */
export const tradeReviewSelect = {
  id: true,
  keywords: true,
  reply: true,
  repliedAt: true,
  createdAt: true,
  isHidden: true,
  productId: true,
  createdById: true,
  createdForId: true,
  createdBy: { select: { id: true, name: true, avatar: true } },
} satisfies Prisma.ReviewSelect;

export type TradeReviewRow = Prisma.ReviewGetPayload<{ select: typeof tradeReviewSelect }>;

/** 보는 사람(req.user). 운영자 판정에 role·email 을 쓴다. */
export type ReviewViewer = (NonNullable<Parameters<typeof isModeratorUser>[0]> & { id: number }) | null | undefined;

/** 숨김과 관계없는 공개 모양. 탈퇴한 작성자는 '탈퇴한 사용자'. */
export function toPublicTradeReview(row: TradeReviewRow): TradeReviewPublic {
  return {
    id: row.id,
    keywords: row.keywords ?? [],
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.createdBy.id,
      name: displayUserName(row.createdBy.name),
      avatar: row.createdBy.avatar ?? null,
    },
    reply: row.reply ?? null,
    repliedAt: row.repliedAt ? row.repliedAt.toISOString() : null,
  };
}

/** 보는 사람 기준 후기 응답. 숨긴 후기는 작성자·분양자·운영자에게만 자리표시. */
export function serializeTradeReview(
  row: TradeReviewRow | null | undefined,
  viewer: ReviewViewer
): ProductTradeReview | null {
  if (!row) return null;
  if (row.isHidden) {
    const canSeeHidden =
      viewer != null &&
      (viewer.id === row.createdById || viewer.id === row.createdForId || isModeratorUser(viewer));
    return canSeeHidden ? { id: row.id, hidden: true } : null;
  }
  return toPublicTradeReview(row);
}

/** 이 분양글의 후기 행(숨김 포함). 글당 1개라 가장 먼저 쓴 것. */
export function findProductReviewRow(db: Db, productId: number): Promise<TradeReviewRow | null> {
  return db.review.findFirst({
    where: { productId },
    orderBy: { id: "asc" },
    select: tradeReviewSelect,
  });
}

/** 상세·GET /review 의 review(보는 사람 기준). */
export async function readProductReview(productId: number, viewer: ReviewViewer): Promise<ProductTradeReview | null> {
  return serializeTradeReview(await findProductReviewRow(client, productId), viewer);
}

/** 키워드별 수. 많은 순, 같으면 TRADE_REVIEW_KEYWORDS 순. 모르는 키는 세지 않는다. */
export function countReviewKeywords(rows: { keywords: string[] | null }[]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    Array.from(new Set(row.keywords ?? [])).forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  }
  return TRADE_REVIEW_KEYWORDS.filter((item) => counts.has(item.key))
    .map((item) => ({ key: item.key, count: counts.get(item.key)! }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 본인 내역 행의 tradeReview(분양글 id → 후기 요약). 분양내역은 분양자가 받은 후기(by: createdForId),
 * 입양내역은 내가 쓴 후기(by: createdById). 숨긴 후기도 hidden 으로 표시해 준다(본인이 당사자라서).
 */
export async function tradeReviewRefsByProduct(
  productIds: number[],
  by: { createdForId: number } | { createdById: number }
): Promise<Map<number, TradeReviewRef>> {
  const ids = Array.from(new Set(productIds));
  if (ids.length === 0) return new Map();
  const rows = await client.review.findMany({
    where: { productId: { in: ids }, ...by },
    orderBy: { id: "asc" },
    select: { id: true, productId: true, reply: true, isHidden: true },
  });
  const refs = new Map<number, TradeReviewRef>();
  for (const row of rows) {
    if (row.productId == null || refs.has(row.productId)) continue;
    refs.set(row.productId, { id: row.id, hasReply: Boolean(row.reply), hidden: row.isHidden });
  }
  return refs;
}

/** '입양 확정하기' 시트에서 확정과 같이 보낸 후기로 볼 시간(분석 with_confirm). */
const WITH_CONFIRM_WINDOW_MS = 2 * 60 * 1000;

/** 내 입양 확정이 방금(2분 안) 생겼으면 확정 시트에서 같이 보낸 후기로 본다. 분석용이라 실패하면 false. */
export async function reviewSentWithConfirm(productId: number, userId: number, now = Date.now()): Promise<boolean> {
  try {
    const purchase = await client.purchase.findFirst({
      where: { productId, userId, status: { not: CANCELLED_TRADE_STATUS } },
      orderBy: { id: "desc" },
      select: { createdAt: true },
    });
    return Boolean(purchase && now - purchase.createdAt.getTime() <= WITH_CONFIRM_WINDOW_MS);
  } catch {
    return false;
  }
}

/** 후기 작성·답글·숨김 뒤 다시 만들 화면: 분양글 상세(후기 블록), 분양자 프로필('후기 N'), 받은 후기 목록. */
export async function tradeReviewTargets(productId: number | null | undefined): Promise<DetailTarget[]> {
  if (typeof productId !== "number" || !Number.isSafeInteger(productId) || productId <= 0) return [];
  const product = await client.product.findUnique({ where: { id: productId }, select: { userId: true } });
  if (!product) return [{ type: "PRODUCT", id: productId }];
  return [
    { type: "PRODUCT", id: productId },
    { type: "PROFILE", id: product.userId },
    { type: "PROFILE_REVIEWS", id: product.userId },
  ];
}
