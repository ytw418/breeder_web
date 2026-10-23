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

/**
 * 거래 기록(입양자 지정·입양 확정·거래 후기·'거래 완료 N')을 남기지 않는 글 종류(Product.dealType).
 * 임보 구해요는 입양이 아니라 잠시 맡기는 일이라 '임보처를 찾았어요'는 글만 닫는다(2026-10-24 코덱스 기획 리뷰,
 * 앱 docs/prd/pet-space.md §16).
 */
const TRADELESS_DEAL_TYPES: readonly string[] = ["foster"];

export const isTradelessDeal = (dealType: string | null | undefined): boolean =>
  TRADELESS_DEAL_TYPES.includes(dealType ?? "");

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
  /** 거래 기록을 남기지 않는 글(임보 구해요, isTradelessDeal). 입양 확정·입양자 지정·지정 요청을 막는다. 옛 호출은 비워 둔다. */
  noTrade?: boolean;
}

/** 상세 trade.buyer(분양자·운영자에게만). 탈퇴한 입양자는 name 이 '탈퇴한 사용자#id'(화면에서 정규화). */
export interface TradeBuyerSummary {
  id: number;
  name: string;
  avatar: string | null;
  status: string;
}

/**
 * GET /api/products/:id 의 trade(보는 사람 기준). 비로그인이면 can*·buyerIsMe·wasBuyer 가 모두 false.
 * 앱 docs/prd/trade-review.md §4 A.
 */
export interface ProductTradeInfo {
  status: string;
  sellerId: number;
  /** 회원 입양자가 지정됐는지(브리디 밖·미지정 false) */
  buyerAssigned: boolean;
  buyerSource: TradeBuyerSource | null;
  buyerIsMe: boolean;
  /** 지정된 입양자가 입양 확정했는지(옛 '입양 확정' 버튼으로 남은 확정도 그 사람이 지정되면 인정) */
  purchaseConfirmed: boolean;
  /** 하단 바 '입양 확정' */
  canConfirm: boolean;
  /** '거래 후기 쓰기' */
  canReview: boolean;
  /** 후기 '답글 남기기'(분양자) */
  canReply: boolean;
  /** 입양자 '지정하기·바꾸기'(분양자·운영자 이메일 계정) */
  canChangeBuyer: boolean;
  /** '제가 입양했어요 — 입양자 지정 요청'(미지정 글, 분양자가 나에게 메시지를 보낸 적 있는 회원) */
  canRequestBuyer: boolean;
  /** 예전에 나를 입양자로 지정했다가 바꿨는지("분양자가 입양자를 바꿨어요") */
  wasBuyer: boolean;
  /** 분양자·운영자에게만 내려온다(그 외·비로그인 SSR 은 필드 없음). 입양자가 없으면 null */
  buyer?: TradeBuyerSummary | null;
}

/** 입양자 후보가 어느 묶음에서 왔는지(시트 소제목·분석 candidate_rank). */
export type TradeCandidateRank = "requested" | "primary" | "others";

export interface TradeCandidateUser {
  id: number;
  name: string;
  avatar: string | null;
}

/** GET /api/products/:id/buyer-candidates. 한 사람은 앞 묶음에만 한 번 나온다(requested → primary → others). */
export interface BuyerCandidatesResponse {
  success: boolean;
  /** '입양자 지정을 요청한 사람'(최근 순, 맨 위를 미리 선택) */
  requested: { user: TradeCandidateUser; requestedAt: string }[];
  /** '이 분양글로 채팅한 상대'(분양글 카드가 있는 방, 최근 카드 순) */
  primary: { user: TradeCandidateUser; chatRoomId: number; lastMessageAt: string; cardAt: string }[];
  /** '다른 대화 상대'(서로 메시지를 주고받은 방, 최근 대화 순, 최대 30) */
  others: { user: TradeCandidateUser; chatRoomId: number; lastMessageAt: string }[];
}

export type TradeViewerRole = "seller" | "buyer" | "other" | "guest";

export function tradeViewerRole(state: TradeState): TradeViewerRole {
  if (state.viewerId == null) return "guest";
  if (state.viewerId === state.sellerId) return "seller";
  if (state.buyerId != null && state.viewerId === state.buyerId) return "buyer";
  return "other";
}

const isSold = (state: TradeState) => state.status === SOLD_PRODUCT_STATUS;

/** 하단 바 '입양 확정'. 지정된 입양자 · 분양완료 · 아직 확정 전 · 지워지지 않은 글 · 임보 글 아님. */
export function canConfirmAdoption(state: TradeState): boolean {
  return (
    !state.noTrade &&
    tradeViewerRole(state) === "buyer" &&
    isSold(state) &&
    !state.purchaseConfirmed &&
    !state.isDeleted
  );
}

/**
 * '거래 후기 쓰기'. 입양 확정한 입양자 · 아직 후기 없음.
 * 자격은 입양 확정 때 정해지므로 그 뒤 글 삭제·숨김·차단으로 막지 않는다(분양자가 후기를 막지 못하게).
 * 임보 글은 입양 확정이 생기지 않아 따로 막지 않는다(글 종류 바꾸기로 후기를 막지 못하게 — 서버 update 가드).
 */
export function canWriteTradeReview(state: TradeState): boolean {
  return tradeViewerRole(state) === "buyer" && state.purchaseConfirmed && !state.hasReview;
}

/** '답글 남기기'. 분양자 · 후기 있음 · 답글 전(한 번만). */
export function canReplyTradeReview(state: TradeState): boolean {
  return tradeViewerRole(state) === "seller" && state.hasReview && !state.hasReply;
}

/** 분양자의 '지정하기·바꾸기'. 분양완료 · 지금 입양자의 입양 확정·후기 전 · 지워지지 않은 글 · 임보 글 아님. */
export function canChangeBuyer(state: TradeState): boolean {
  return (
    !state.noTrade &&
    tradeViewerRole(state) === "seller" &&
    isSold(state) &&
    !(state.purchaseConfirmed || state.hasReview) &&
    !state.isDeleted
  );
}

/**
 * 분양자가 보는 상세 입양자 행 문구. 분양완료가 아니거나 임보 글이면 null.
 * "입양자를 아직 정하지 않았어요" / "입양자 ○○ · 입양 확정 대기" / "입양자 ○○ · 입양 확정 완료" / "브리디 밖에서 분양"
 */
export function tradeStatusLine(state: TradeState, buyerName?: string | null): string | null {
  if (!isSold(state) || state.noTrade) return null;
  if (state.buyerSource === "external") return "브리디 밖에서 분양";
  if (state.buyerId == null) return "입양자를 아직 정하지 않았어요";
  const name = buyerName?.trim();
  const who = name ? `입양자 ${name}` : "입양자";
  return `${who} · ${state.purchaseConfirmed ? "입양 확정 완료" : "입양 확정 대기"}`;
}

/** 후기 작성자(입양자). 탈퇴한 회원은 서버가 이름을 '탈퇴한 사용자'로 바꿔 준다. */
export interface TradeReviewAuthor {
  id: number;
  name: string;
  avatar: string | null;
}

/** 공개 거래 후기(상세 review · GET /api/products/:id/review · 받은 후기 목록 행). 시각은 ISO 문자열. */
export interface TradeReviewPublic {
  id: number;
  /** TRADE_REVIEW_KEYWORDS 의 key(정해진 순서). 화면은 keywordLabel 로 이름을 붙이고 모르는 키는 뺀다. */
  keywords: string[];
  createdAt: string;
  author: TradeReviewAuthor;
  /** 분양자 답글(한 번). 없으면 null */
  reply: string | null;
  repliedAt: string | null;
}

/** 운영자가 숨긴 후기. 작성자·분양자·운영자에게만 이 자리표시가 내려오고, 그 외에는 review 가 null 이다. */
export interface TradeReviewHidden {
  id: number;
  hidden: true;
}

/** GET /api/products/:id 의 review · GET /api/products/:id/review. 후기가 없거나 볼 수 없으면 null. */
export type ProductTradeReview = TradeReviewPublic | TradeReviewHidden;

export function isHiddenTradeReview(review: ProductTradeReview | null | undefined): review is TradeReviewHidden {
  return Boolean(review && "hidden" in review && review.hidden);
}

/** 본인 분양내역·입양내역 행의 tradeReview(이 분양글에 후기가 있는지). 없으면 null. */
export interface TradeReviewRef {
  id: number;
  hasReply: boolean;
  /** 운영자가 숨긴 후기(화면은 '숨겨진 후기'로 보이고 답글 입구를 두지 않는다) */
  hidden: boolean;
}

/** 받은 후기 목록 행의 분양글. 분양자가 지운 글은 이름·사진 없이 removed 만. */
export type TradeReviewProduct =
  | { id: number; name: string; image: string | null }
  | { id: number; removed: true };

export interface UserTradeReviewItem extends TradeReviewPublic {
  product: TradeReviewProduct;
}

/** GET /api/users/:id/reviews?page=1&size=20 — 받은 거래 후기(숨긴 후기·숨긴 분양글의 후기 제외, 최근 순). */
export interface UserTradeReviewsResponse {
  success: boolean;
  /** 이 목록 조건의 전체 수(헤더 '받은 거래 후기 N') */
  total: number;
  items: UserTradeReviewItem[];
  /** 키워드별 수(많은 순, 같으면 TRADE_REVIEW_KEYWORDS 순). 전체 후기 기준(이 페이지만이 아님) */
  keywordCounts: { key: string; count: number }[];
}
