/**
 * 입양자 지정·거래 후기 규칙(2026-10-21, 앱 docs/prd/trade-review.md, 시안 design/mockups/trade-review/A-karrot.html).
 * - 후기는 정해진 키워드 1~5개만 고른다(자유 글 없음, 부정 키워드 없음). 분양자는 답글을 한 번(300자) 남긴다.
 * - 입양 확정·후기는 분양자가 지정한 입양자만 한다. 미지정 글은 '입양자 지정 요청'으로 분양자에게 부탁한다(서버 trade.canRequestBuyer).
 * 웹 breeder_web libs/shared/tradeReview.ts = 앱 bredy_app src/lib/tradeReview.ts 사본이라 함께 고치고
 * 웹 `npx jest tradeReview`·앱 `node --test scripts/test-trade-review.mjs` 로 확인한다.
 */

/** 서버 Product.status 의 분양완료 값(화면 이름은 productTerms 의 '분양완료'). */
export const SOLD_PRODUCT_STATUS = "판매완료";

/** 용품 분양글(Product.productType). 용품에는 개체 키워드('생물')를 보이지 않는다. */
const SUPPLY_PRODUCT_TYPE = "용품";

export type TradeReviewKeywordScope = "all" | "생물";

export interface TradeReviewKeyword {
  key: string;
  label: string;
  /** all = 모든 분양글, 생물 = 용품이 아닌 분양글만 */
  appliesTo: TradeReviewKeywordScope;
}

/** 순서가 곧 화면·저장 순서다. 키를 바꾸거나 빼면 저장된 후기가 이름을 잃는다 — 이름만 고친다. */
export const TRADE_REVIEW_KEYWORDS: readonly TradeReviewKeyword[] = [
  { key: "as_described", label: "설명과 같아요", appliesTo: "all" },
  { key: "healthy", label: "개체가 건강해요", appliesTo: "생물" },
  { key: "care_info", label: "사육 정보를 자세히 알려줘요", appliesTo: "생물" },
  { key: "aftercare", label: "분양 뒤에도 잘 챙겨줘요", appliesTo: "생물" },
  { key: "fast_reply", label: "응답이 빨라요", appliesTo: "all" },
  { key: "punctual", label: "약속을 잘 지켜요", appliesTo: "all" },
  { key: "packing", label: "포장·이동이 꼼꼼해요", appliesTo: "all" },
  { key: "kind", label: "친절해요", appliesTo: "all" },
];

export const TRADE_REVIEW_MIN_KEYWORDS = 1;
export const TRADE_REVIEW_MAX_KEYWORDS = 5;
export const TRADE_REVIEW_REPLY_MAX = 300;

/** 이 분양글 후기에 고를 수 있는 키워드. 용품이면 all 만, 그 외(생물·값 없음)는 전부. */
export function keywordsForProduct(productType: string | null | undefined): TradeReviewKeyword[] {
  if (productType === SUPPLY_PRODUCT_TYPE) return TRADE_REVIEW_KEYWORDS.filter((item) => item.appliesTo === "all");
  return [...TRADE_REVIEW_KEYWORDS];
}

/**
 * 요청 본문의 키워드 → 저장할 키워드(정해진 순서, 중복 제거). 배열이 아니거나, 모르는 키·이 분양글에 맞지 않는 키가
 * 하나라도 있거나, 1~5개가 아니면 null(서버 400 INVALID_KEYWORDS).
 */
export function normalizeReviewKeywords(input: unknown, productType: string | null | undefined): string[] | null {
  if (!Array.isArray(input)) return null;
  const allowed = new Set(keywordsForProduct(productType).map((item) => item.key));
  const picked = new Set<string>();
  for (const value of input) {
    if (typeof value !== "string" || !allowed.has(value)) return null;
    picked.add(value);
  }
  if (picked.size < TRADE_REVIEW_MIN_KEYWORDS || picked.size > TRADE_REVIEW_MAX_KEYWORDS) return null;
  return TRADE_REVIEW_KEYWORDS.filter((item) => picked.has(item.key)).map((item) => item.key);
}

/** 키 → 화면 이름. 모르는 키는 빈 문자열(화면에서 뺀다). */
export function keywordLabel(key: string): string {
  return TRADE_REVIEW_KEYWORDS.find((item) => item.key === key)?.label ?? "";
}

/** 알림·미리보기 한 줄: "응답이 빨라요" / "응답이 빨라요 외 2개". 이름 있는 키가 없으면 빈 문자열. */
export function tradeReviewSummary(keys: readonly string[]): string {
  const labels = keys.map(keywordLabel).filter(Boolean);
  if (labels.length === 0) return "";
  return labels.length === 1 ? labels[0] : `${labels[0]} 외 ${labels.length - 1}개`;
}

export type TradeBuyerSource = "bredy" | "external";

/** 분양글 하나의 거래 상태(보는 사람 기준). 서버 상세 응답 trade 와 화면 분기에 같이 쓴다. */
export interface TradeState {
  /** 보는 사람. 비로그인 null */
  viewerId: number | null;
  /** 분양자(product.userId) */
  sellerId: number;
  /** Product.status(판매중·예약중·판매완료) */
  status: string;
  /** 지정된 입양자(Sale.buyerId). 미지정·브리디 밖이면 null */
  buyerId: number | null;
  buyerSource: TradeBuyerSource | null;
  /** 지정된 입양자가 입양 확정했는지(그 사람의 Purchase, 취소 제외) */
  purchaseConfirmed: boolean;
  /** 이 분양글에 거래 후기가 있는지 */
  hasReview: boolean;
  /** 그 후기에 분양자 답글이 있는지 */
  hasReply: boolean;
  isDeleted: boolean;
}

export type TradeViewerRole = "seller" | "buyer" | "other" | "guest";

export function tradeViewerRole(state: TradeState): TradeViewerRole {
  if (state.viewerId == null) return "guest";
  if (state.viewerId === state.sellerId) return "seller";
  if (state.buyerId != null && state.viewerId === state.buyerId) return "buyer";
  return "other";
}

const isSold = (state: TradeState) => state.status === SOLD_PRODUCT_STATUS;

/** 하단 바 '입양 확정'. 지정된 입양자 · 분양완료 · 아직 확정 전 · 지워지지 않은 글. */
export function canConfirmAdoption(state: TradeState): boolean {
  return tradeViewerRole(state) === "buyer" && isSold(state) && !state.purchaseConfirmed && !state.isDeleted;
}

/**
 * '거래 후기 쓰기'. 입양 확정한 입양자 · 아직 후기 없음.
 * 자격은 입양 확정 때 정해지므로 그 뒤 글 삭제·숨김·차단으로 막지 않는다(분양자가 후기를 막지 못하게).
 */
export function canWriteTradeReview(state: TradeState): boolean {
  return tradeViewerRole(state) === "buyer" && state.purchaseConfirmed && !state.hasReview;
}

/** '답글 남기기'. 분양자 · 후기 있음 · 답글 전(한 번만). */
export function canReplyTradeReview(state: TradeState): boolean {
  return tradeViewerRole(state) === "seller" && state.hasReview && !state.hasReply;
}

/** 분양자의 '지정하기·바꾸기'. 분양완료 · 지금 입양자의 입양 확정·후기 전 · 지워지지 않은 글. */
export function canChangeBuyer(state: TradeState): boolean {
  return (
    tradeViewerRole(state) === "seller" &&
    isSold(state) &&
    !(state.purchaseConfirmed || state.hasReview) &&
    !state.isDeleted
  );
}

/**
 * 분양자가 보는 상세 입양자 행 문구. 분양완료가 아니면 null.
 * "입양자를 아직 정하지 않았어요" / "입양자 ○○ · 입양 확정 대기" / "입양자 ○○ · 입양 확정 완료" / "브리디 밖에서 분양"
 */
export function tradeStatusLine(state: TradeState, buyerName?: string | null): string | null {
  if (!isSold(state)) return null;
  if (state.buyerSource === "external") return "브리디 밖에서 분양";
  if (state.buyerId == null) return "입양자를 아직 정하지 않았어요";
  const name = buyerName?.trim();
  const who = name ? `입양자 ${name}` : "입양자";
  return `${who} · ${state.purchaseConfirmed ? "입양 확정 완료" : "입양 확정 대기"}`;
}
