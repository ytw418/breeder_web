import type { NextApiResponse } from "next";
import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import type { AuthUser } from "@libs/server/auth";
import { canEditAnyContent, isModeratorUser } from "@libs/server/adminAccess";
import { getBlockRelation } from "@libs/server/blocks";
import { isCrewUser } from "@libs/server/crew";
import {
  SOLD_PRODUCT_STATUS,
  canChangeBuyer,
  canConfirmAdoption,
  canReplyTradeReview,
  canWriteTradeReview,
  type ProductTradeInfo,
  type TradeBuyerSource,
  type TradeState,
} from "@libs/shared/tradeReview";

/**
 * 입양자 지정·입양 확정·거래 후기 서버 공용(앱 docs/prd/trade-review.md §3.3·§3.6).
 * - 거래를 바꾸는 쓰기(sold·buyer·buyer-request·purchase·status_change 되돌리기·review)는 모두 withTradeLock 안에서
 *   Sale(completed)·이 글의 입양 확정·후기를 다시 읽고 판정한다. 같은 분양글의 요청은 하나씩 차례로 돈다.
 * - 판정에 걸리면 TradeError 를 던져 트랜잭션을 되돌리고, 핸들러는 sendTradeError 로 응답한다.
 */

type Db = Prisma.TransactionClient | typeof client;

/** Sale·Purchase 의 되돌린 행(분양완료 되돌리기). 목록·집계·판정에서 뺀다. */
export const CANCELLED_TRADE_STATUS = "cancelled";
/** Sale·Purchase 의 성사 값(기존 코드 값 그대로). */
export const COMPLETED_TRADE_STATUS = "completed";

export class TradeError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string
  ) {
    super(message);
    this.name = "TradeError";
    // target es5 에서 Error 상속 instanceof 가 깨지지 않게(reports·sanctions 와 같은 처리).
    Object.setPrototypeOf(this, TradeError.prototype);
  }
}

export const tradeErrors = {
  conflict: () => new TradeError(409, "TRADE_CONFLICT", "잠시 후 다시 시도해 주세요."),
  externalBuyer: () => new TradeError(403, "TRADE_EXTERNAL_BUYER", "브리디 밖에서 분양된 글이에요."),
  notAssigned: () =>
    new TradeError(
      403,
      "TRADE_NOT_ASSIGNED",
      "분양자가 입양자를 지정하면 입양 확정할 수 있어요. 지정을 요청해 보세요."
    ),
  notBuyer: () => new TradeError(403, "TRADE_NOT_BUYER", "분양자가 지정한 입양자만 입양 확정할 수 있어요."),
  alreadyPurchased: () => new TradeError(400, "ALREADY_PURCHASED", "이미 입양 확정한 분양글입니다."),
  alreadySold: () => new TradeError(400, "ALREADY_SOLD", "이미 분양완료 처리된 분양글입니다."),
  notSoldForConfirm: () => new TradeError(400, "NOT_SOLD", "분양완료된 분양글만 입양 확정할 수 있습니다."),
  notSoldForBuyer: () => new TradeError(400, "NOT_SOLD", "분양완료된 분양글만 입양자를 지정할 수 있어요."),
  noSale: () => new TradeError(400, "NO_SALE", "분양완료 기록을 찾지 못했어요. 분양완료를 다시 눌러 주세요."),
  statusLocked: () =>
    new TradeError(400, "TRADE_LOCKED", "입양 확정·후기가 있는 분양글은 상태를 되돌릴 수 없어요"),
  buyerLocked: () =>
    new TradeError(400, "TRADE_LOCKED", "입양 확정·후기가 있어 입양자를 바꿀 수 없어요."),
  invalidBuyer: () =>
    new TradeError(400, "INVALID_BUYER", "분양자와 대화한 회원만 입양자로 지정할 수 있어요"),
  blockedBuyer: () => new TradeError(400, "BLOCKED", "지금은 이 회원을 입양자로 지정할 수 없어요."),
  requestNotAllowed: () =>
    new TradeError(403, "REQUEST_NOT_ALLOWED", "분양자와 대화한 회원만 요청할 수 있어요"),
};

/** 앱은 error || message 를, 웹은 message 를 토스트로 보여 준다. 둘 다 같은 문구로 보낸다. */
export function sendTradeError(res: NextApiResponse, error: TradeError) {
  return res.status(error.status).json({
    success: false,
    error: error.message,
    message: error.message,
    errorCode: error.errorCode,
  });
}

/**
 * 분양글 하나의 거래 쓰기를 직렬화한다. 트랜잭션이 끝나면 lock 도 풀린다(xact lock).
 * 키는 chatWave 와 같은 두 정수 형태(hashtext('trade'), productId) — 분양글끼리 해시 충돌이 없다.
 */
export async function withTradeLock<T>(
  productId: number,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('trade'), ${productId}::int)`;
    return fn(tx);
  });
}

/** 판정에 쓰는 이 분양글의 거래 기록. */
export interface TradeSnapshot {
  /** 성사된 Sale(가장 최근). 미분양·되돌린 글은 null */
  sale: { id: number; buyerId: number | null; buyerSource: string | null } | null;
  /** 입양 확정(취소 제외)한 회원 id. 옛 공개 '입양 확정' 버튼으로 생긴 행도 들어 있다. */
  purchaserIds: number[];
  /** 이 분양글의 거래 후기(숨김 포함) */
  review: { id: number; reply: string | null } | null;
}

export const EMPTY_TRADE_SNAPSHOT: TradeSnapshot = { sale: null, purchaserIds: [], review: null };

export async function readTradeSnapshot(db: Db, productId: number): Promise<TradeSnapshot> {
  const [sale, purchases, review] = await Promise.all([
    db.sale.findFirst({
      where: { productId, status: COMPLETED_TRADE_STATUS },
      orderBy: { id: "desc" },
      select: { id: true, buyerId: true, buyerSource: true },
    }),
    db.purchase.findMany({
      where: { productId, status: { not: CANCELLED_TRADE_STATUS } },
      select: { userId: true },
    }),
    db.review.findFirst({
      where: { productId },
      orderBy: { id: "asc" },
      select: { id: true, reply: true },
    }),
  ]);
  return {
    sale: sale ?? null,
    purchaserIds: (purchases ?? []).map((row) => row.userId),
    review: review ?? null,
  };
}

/** Sale 의 입양자 칸 → 판정용 값. buyerSource 가 'bredy' 인데 buyerId 가 비어 있으면 미지정으로 본다. */
export function saleBuyer(sale: TradeSnapshot["sale"]): {
  buyerId: number | null;
  buyerSource: TradeBuyerSource | null;
} {
  if (sale?.buyerSource === "external") return { buyerId: null, buyerSource: "external" };
  if (sale?.buyerSource === "bredy" && typeof sale.buyerId === "number") {
    return { buyerId: sale.buyerId, buyerSource: "bredy" };
  }
  return { buyerId: null, buyerSource: null };
}

export function tradeStateOf(
  product: { userId: number; status: string; isDeleted?: boolean | null },
  snapshot: TradeSnapshot,
  viewerId: number | null
): TradeState {
  const { buyerId, buyerSource } = saleBuyer(snapshot.sale);
  return {
    viewerId,
    sellerId: product.userId,
    status: product.status,
    buyerId,
    buyerSource,
    purchaseConfirmed: buyerId != null && snapshot.purchaserIds.includes(buyerId),
    hasReview: Boolean(snapshot.review),
    hasReply: Boolean(snapshot.review?.reply),
    isDeleted: Boolean(product.isDeleted),
  };
}

/** 지금 입양자의 입양 확정 또는 이 글의 후기가 있으면 입양자 바꾸기·되돌리기를 막는다. 다른 사람의 옛 확정은 막지 않는다. */
export function isTradeLocked(state: TradeState): boolean {
  return state.purchaseConfirmed || state.hasReview;
}

/** 입양 확정 권한(§3.3 ㄱ~ㄹ). 차단·탈퇴·글 삭제는 여기서 막지 않는다(자격은 지정 때 정해진다). */
export function assertCanConfirmAdoption(state: TradeState, snapshot: TradeSnapshot, viewerId: number) {
  if (state.buyerSource === "external") throw tradeErrors.externalBuyer();
  if (state.buyerId == null) throw tradeErrors.notAssigned();
  if (state.buyerId !== viewerId) throw tradeErrors.notBuyer();
  if (snapshot.purchaserIds.includes(viewerId)) throw tradeErrors.alreadyPurchased();
}

type TradeViewer = Pick<AuthUser, "id"> & { name?: string | null; email?: string | null; role?: AuthUser["role"] };

/**
 * '제가 입양했어요 — 입양자 지정 요청' 자격: 로그인 · 분양완료 · 미지정(브리디 밖 아님) · 분양자 아님 · 내 입양 확정 없음 ·
 * 크루 아님 · 서로 차단 아님 · 분양자와 1:1 방에 분양자가 보낸 메시지(분양글 카드 제외)가 1개 이상.
 */
export async function canRequestBuyerFor(
  viewer: TradeViewer | null | undefined,
  state: TradeState,
  snapshot: TradeSnapshot,
  db: Db = client
): Promise<boolean> {
  if (!viewer?.id) return false;
  if (state.status !== SOLD_PRODUCT_STATUS || state.isDeleted) return false;
  if (state.buyerSource !== null || state.buyerId !== null) return false;
  if (viewer.id === state.sellerId) return false;
  if (snapshot.purchaserIds.includes(viewer.id)) return false;
  if (isCrewUser(viewer)) return false;
  const [relation, sellerMessage] = await Promise.all([
    getBlockRelation(viewer.id, state.sellerId),
    db.message.findFirst({
      where: {
        userId: state.sellerId,
        productId: null,
        chatRoom: { chatRoomMembers: { some: { userId: viewer.id } } },
      },
      select: { id: true },
    }),
  ]);
  if (relation.blockedByMe || relation.blockedMe) return false;
  return Boolean(sellerMessage);
}

/** 예전에 나를 입양자로 지정한 알림이 있는데 지금 입양자가 내가 아니면 true(분양완료 글만). */
async function wasBuyerFor(viewerId: number | null, productId: number, state: TradeState): Promise<boolean> {
  if (viewerId == null || state.status !== SOLD_PRODUCT_STATUS) return false;
  if (state.buyerId === viewerId) return false;
  const notice = await client.notification.findFirst({
    where: { type: "ADOPTER_ASSIGNED", userId: viewerId, targetType: "product", targetId: productId },
    select: { id: true },
  });
  return Boolean(notice);
}

/**
 * 상세 응답 trade(보는 사람 기준). 분양완료가 아닌 글은 거래 기록을 읽지 않는다(되돌리기 때 Sale·확정이 모두 취소되고,
 * 후기가 있으면 되돌릴 수 없어서 판매중·예약중 글의 trade 는 늘 빈 값이다).
 */
export async function buildProductTrade(
  product: { id: number; userId: number; status: string; isDeleted?: boolean | null },
  viewer?: TradeViewer | null,
  snapshot?: TradeSnapshot
): Promise<ProductTradeInfo> {
  const snap =
    snapshot ??
    (product.status === SOLD_PRODUCT_STATUS
      ? await readTradeSnapshot(client, product.id)
      : EMPTY_TRADE_SNAPSHOT);
  const viewerId = viewer?.id ?? null;
  const state = tradeStateOf(product, snap, viewerId);
  const isSeller = viewerId != null && viewerId === product.userId;
  const canManage = isSeller || canEditAnyContent(viewer);
  const canSeeBuyer = isSeller || isModeratorUser(viewer);

  const [canRequestBuyer, wasBuyer, buyer] = await Promise.all([
    canRequestBuyerFor(viewer, state, snap),
    wasBuyerFor(viewerId, product.id, state),
    canSeeBuyer && state.buyerId != null
      ? client.user.findUnique({
          where: { id: state.buyerId },
          select: { id: true, name: true, avatar: true, status: true },
        })
      : null,
  ]);

  return {
    status: product.status,
    sellerId: product.userId,
    buyerAssigned: state.buyerId != null,
    buyerSource: state.buyerSource,
    buyerIsMe: viewerId != null && state.buyerId === viewerId,
    purchaseConfirmed: state.purchaseConfirmed,
    canConfirm: canConfirmAdoption(state),
    canReview: canWriteTradeReview(state),
    canReply: canReplyTradeReview(state),
    // 운영자 이메일 계정도 남의 글 입양자를 지정·변경한다(분양완료 처리와 같은 권한).
    canChangeBuyer: canManage && canChangeBuyer({ ...state, viewerId: product.userId }),
    canRequestBuyer,
    wasBuyer,
    ...(canSeeBuyer
      ? {
          buyer: buyer
            ? { id: buyer.id, name: buyer.name, avatar: buyer.avatar ?? null, status: String(buyer.status) }
            : null,
        }
      : {}),
  };
}

/** 알림 문구에 쓰는 이름. DB 이름이 없으면 토큰 이름, 그것도 없으면 '회원'. */
export async function tradeUserName(userId: number, fallback?: string | null): Promise<string> {
  const row = await client.user.findUnique({ where: { id: userId }, select: { name: true } });
  return row?.name || fallback || "회원";
}

/** ADOPTER_ASSIGNED 문구. 지정한 사람에게 옛 입양 확정이 이미 있으면 바로 후기를 부탁한다. */
export function adopterAssignedMessage(sellerName: string, legacyPurchase: boolean): string {
  return legacyPurchase
    ? `${sellerName}님이 회원님을 입양자로 지정했어요. 거래 후기를 남겨 주세요.`
    : `${sellerName}님이 회원님을 입양자로 지정했어요. 입양 확정을 눌러 주세요.`;
}
