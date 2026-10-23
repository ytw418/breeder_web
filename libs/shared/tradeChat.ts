/**
 * 채팅 분양글 맥락 규칙(2026-10-21, 앱 docs/prd/trade-review.md·docs/prd/chat.md, 시안 design/mockups/trade-review/A-karrot.html #chat-*).
 * - 분양글에서 연 방의 첫 메시지와 함께 서버가 분양글 카드 행(Message.type TEXT + productId)을 방·글당 1번 넣는다.
 *   message 칸의 스냅샷 "[분양글] 제목 · 가격"은 옛 앱 말풍선·푸시·목록 미리보기에 그대로 보인다.
 * - 새 앱·웹은 productId 가 있는 메시지를 카드 말풍선으로 그리고, 목록 미리보기는 '분양글을 보냈어요'로 바꾼다.
 * 웹 breeder_web libs/shared/tradeChat.ts = 앱 bredy_app src/lib/tradeChat.ts 사본이라 함께 고치고
 * 웹 `npx jest tradeChat`·앱 `node --test scripts/test-trade-review.mjs` 로 확인한다.
 */
import {
  canConfirmAdoption,
  canWriteTradeReview,
  SOLD_PRODUCT_STATUS,
  tradeViewerRole,
  type TradeState,
} from "./tradeReview";

/** 서버 카테고리 트리의 포유류 path(scopeTerms 와 같다). 강아지는 '/mammal/dog/'. */
const MAMMAL_PATH = "/mammal/";
const SUPPLY_PRODUCT_TYPE = "용품";

/** 입력창 위 추천 칩 3개(누르면 바로 보낸다). 용품 / 포유류 / 그 외 생물. */
export function productStarterChips(product: {
  productType: string | null | undefined;
  categoryPath: string | null | undefined;
}): string[] {
  if (product.productType === SUPPLY_PRODUCT_TYPE) {
    return ["아직 분양 중인가요?", "상태 사진 더 볼 수 있을까요?", "직거래 가능한가요?"];
  }
  if (product.categoryPath?.startsWith(MAMMAL_PATH)) {
    return ["아직 분양 중인가요?", "성별·나이 알려주실 수 있나요?", "직접 보러 가도 될까요?"];
  }
  return ["아직 분양 중인가요?", "성별·나이(해칭일) 알려주실 수 있나요?", "생물 택배 가능한가요?"];
}

/** 0 → '무료 분양', 값 없음 → '가격 미정', 그 외 '150,000원'(기기 로캘과 무관하게 콤마). */
function cardPriceLabel(price: number | null | undefined): string {
  if (price === 0) return "무료 분양";
  if (price == null || !Number.isFinite(price)) return "가격 미정";
  return `${String(Math.trunc(price)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;
}

/** 카드 행 message 스냅샷: "[분양글] 제목 · 150,000원" / "[분양글] 제목 · 무료 분양". */
export function productCardSnapshot(product: { name: string; price: number | null | undefined }): string {
  return `[분양글] ${product.name.trim()} · ${cardPriceLabel(product.price)}`;
}

/** 카드 행이 마지막 메시지일 때 채팅 목록 미리보기. */
export const PRODUCT_CARD_PREVIEW = "분양글을 보냈어요";

/** 분양글 카드 행인지(productId 가 있는 메시지). */
export function isProductCard(message: { productId?: number | null }): boolean {
  return typeof message.productId === "number";
}

/** 채팅방 문맥 바 버튼: 분양자 '분양완료' / 입양자 '입양 확정'·'거래 후기 쓰기' / 없음. */
export type ChatProductAction = "sold" | "confirm" | "review" | null;

/** 문맥 바 버튼을 고른다. 분양자는 분양완료 전 → sold, 지정된 입양자는 확정 전 → confirm, 확정 뒤 후기 전 → review. */
export function chatProductAction(state: TradeState): ChatProductAction {
  if (state.isDeleted) return null;
  if (tradeViewerRole(state) === "seller") return state.status === SOLD_PRODUCT_STATUS ? null : "sold";
  if (canConfirmAdoption(state)) return "confirm";
  if (canWriteTradeReview(state)) return "review";
  return null;
}

/** 메시지 행에 붙는 분양글 요약(카드 말풍선). 지웠거나 숨긴 글이면 서버가 null 로 준다. */
export interface ChatMessageProduct {
  id: number;
  name: string;
  price: number | null;
  /** Cloudflare 이미지 id(대표 사진) */
  image: string | null;
  /** 서버 Product.status */
  status: string;
  /** 화면 이름(분양중·예약중·분양완료) */
  statusLabel: string;
  /** 종 이름·거래 유형. 강아지·고양이 글은 가격 대신 글 종류를 보인다(price.ts productPriceText). 옛 응답엔 없다. */
  category?: string | null;
  dealType?: string | null;
}

/** GET /api/chat/:id?card=1 의 chatRoom.product — 문맥 바·추천 칩. */
export interface ChatRoomProduct extends ChatMessageProduct {
  sellerId: number;
  /** 추천 칩 분기(productStarterChips) */
  productType: string | null;
  categoryPath: string | null;
  viewerAction: ChatProductAction;
  /** 입력창 위 추천 칩: 내가 분양자가 아니고 · 분양중·예약중이고 · 이 방에 그 글 카드가 아직 없을 때 true. */
  showStarterChips: boolean;
}
