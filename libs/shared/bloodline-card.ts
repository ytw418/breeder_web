import { DELETED_USER_LABEL, displayUserName } from "@libs/shared/deletedUser";

/**
 * 혈통 공용 타입·화면 순수 함수(서버 응답 계약, 설계 §3).
 * 용어: BLOODLINE = "혈통"(이름 증서), LINE = "출처 카드"(혈통에서 받은 사람에게 보낸 하위 카드).
 * 새 응답 필드는 모두 optional 이다(구 서버·구 클라이언트 호환). 기존 필드 이름·타입은 바꾸지 않는다.
 */

export type BloodlineCardType = "BLOODLINE" | "LINE";
export type BloodlineCardStatus = "ACTIVE" | "INACTIVE" | "REVOKED";
export type BloodlineCardTransferPolicy =
  | "NONE"
  | "ONE_TIME"
  | "LIMITED_CHAIN"
  | "LIMITED_COUNT"
  | "VERIFIED_ONLY";

export type BloodlineCardEventType =
  | "BLOODLINE_CREATED"
  | "BLOODLINE_TRANSFER"
  | "LINE_CREATED"
  | "LINE_ISSUED"
  | "LINE_TRANSFER"
  | "CARD_REVOKED";

export type BloodlineCardVisualStyle = "noir" | "clean" | "editorial";

/** 받은 사람 닉네임 비공개 표시(libs/server/bloodline-visibility). */
export const BLOODLINE_MASKED_USER_NAME = "닉네임 비공개";

/**
 * 응답 안의 사용자. 마스킹되면 `{ id: 0, name: "닉네임 비공개", masked: true }` 다
 * (id 0 은 탈퇴 사용자 표시와 같은 관례라 프로필 링크를 걸지 않는다).
 */
export interface BloodlineUserRef {
  id: number;
  name: string;
  masked?: boolean;
}

export interface BloodlineCardTransferItem {
  id: number;
  fromUser: BloodlineUserRef | null;
  toUser: BloodlineUserRef;
  note: string | null;
  createdAt: string;
}

export interface BloodlineCardItem {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  cardType: BloodlineCardType;
  speciesType: string | null;
  bloodlineReferenceId: number | null;
  parentCardId: number | null;
  status: BloodlineCardStatus;
  transferPolicy: BloodlineCardTransferPolicy;
  issueCount: number;
  transferCount: number;
  creator: BloodlineUserRef;
  currentOwner: BloodlineUserRef;
  isOwnedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
  transfers: BloodlineCardTransferItem[];
  /** 렌더에 쓰지 않는다. 서버는 항상 "noir" 를 준다(타입 호환). */
  visualStyle?: BloodlineCardVisualStyle;
  /** 산지(libs/shared/regions REGIONS 값) */
  originSido?: string | null;
  originSigungu?: string | null;
  /** 짧은 산지 표시 "충남 공주"(formatRegionShort) */
  originLabel?: string | null;
  /** 뿌리 혈통만: 출처 카드를 받은 서로 다른 현재 보유자 수(만든 사람·발급자 보유분 제외) */
  receivedCount?: number;
  /** 출처 카드이고 뷰어가 지금 보유자일 때만: 닉네임 공개 여부 */
  ownerNameVisible?: boolean;
  /** 뿌리 혈통만: 이 혈통이 붙은 상품 수(삭제·숨김 제외) */
  listingCount?: number;
}

export interface BloodlineCardEventItem {
  id: number;
  action: BloodlineCardEventType;
  actorUser: BloodlineUserRef | null;
  fromUser: BloodlineUserRef | null;
  toUser: BloodlineUserRef | null;
  relatedCard: { id: number; name: string } | null;
  note: string | null;
  createdAt: string;
}

/** 상품·경매 등록에서 붙일 수 있는 혈통(`GET /api/bloodline-cards?mode=attach`). */
export interface AttachableBloodline {
  /** 연결에 쓰는 id(항상 BLOODLINE) */
  rootId: number;
  name: string;
  speciesType: string | null;
  /** "충남 공주" */
  originLabel: string | null;
  creator: { id: number; name: string };
  /** mine = 내가 보유한 혈통, received = 그 혈통의 출처 카드 보유 */
  relation: "mine" | "received";
  /** received 일 때 내 출처 카드 id */
  lineCardId?: number;
  receivedFrom?: { id: number; name: string };
  receivedAt?: string;
  /** 대표 사진(Cloudflare 이미지 id). 뿌리 혈통 사진이고, 출처 카드는 발급 때 뿌리 사진을 복사한다 */
  image?: string | null;
}

export interface BloodlineCardsResponse {
  success: boolean;
  myBloodlines: BloodlineCardItem[];
  receivedBloodlines: BloodlineCardItem[];
  createdLines: BloodlineCardItem[];
  receivedLines: BloodlineCardItem[];
  // 아래 항목은 기존 클라이언트 호환용
  myCreatedCards: BloodlineCardItem[];
  receivedCards: BloodlineCardItem[];
  ownedCards: BloodlineCardItem[];
  /** `?mode=attach` 일 때만 */
  attachable?: AttachableBloodline[];
  error?: string;
  errorCode?: string;
}

/** 보내기·넘기기 경로(계측용). */
export interface BloodlineSendSource {
  type: "chat" | "search" | "auction";
  auctionId?: number;
}

/** `POST /api/bloodline-cards` 요청. 새 필드는 모두 선택(구 클라이언트 payload 그대로 동작). */
export interface CreateBloodlineCardBody {
  name: string;
  /** 노출 Category.name 중 하나(서버 필수) */
  speciesType?: string;
  /** Cloudflare 이미지 id(서버 필수) */
  image?: string;
  /** 선택, 300자 이하 */
  description?: string;
  originSido?: string;
  originSigungu?: string;
  /** 무시(호환용) */
  visualStyle?: string;
  /** 무시(호환용) */
  transferPolicy?: string;
}

/** `POST /api/bloodline-cards/[id]/issue-line`·`[id]/transfer` 요청. */
export interface SendBloodlineCardBody {
  toUserId?: number;
  toUserName?: string;
  /** 300자 이하. 받는 사람 카드 화면 "○○님의 메모" */
  note?: string;
  source?: BloodlineSendSource;
}

/** `PATCH /api/bloodline-cards/[id]` 요청. 이름·사진은 바꿀 수 없다. */
export interface BloodlineCardPatchBody {
  speciesType?: string;
  description?: string | null;
  originSido?: string | null;
  originSigungu?: string | null;
  /** 출처 카드 현재 보유자만 */
  ownerNameVisible?: boolean;
}

export interface BloodlineCardPatchResponse {
  success: boolean;
  card?: BloodlineCardItem | null;
  error?: string;
  errorCode?: string;
}

export interface BloodlineCardTransferResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
}

export interface BloodlineCardIssueLineResponse {
  success: boolean;
  card: BloodlineCardItem | null;
  error?: string;
  errorCode?: string;
}

export interface BloodlineCardEventsResponse {
  success: boolean;
  events: BloodlineCardEventItem[];
  error?: string;
  errorCode?: string;
}

/** owner = 뿌리 혈통 보유자, holder = 그 뿌리의 출처 카드 보유자, none = 그 외(비로그인 포함) */
export type BloodlineViewerRelation = "owner" | "holder" | "none";

export interface BloodlineCardDetailResponse {
  success: boolean;
  /** 요청한 id 의 카드(뿌리 또는 LINE) */
  card: BloodlineCardItem | null;
  bloodlineSourceCard: BloodlineCardItem | null;
  /** 호환용. 새 UI 는 쓰지 않는다 */
  parentLineCard: BloodlineCardItem | null;
  /** 뿌리를 열었는데 뷰어가 그 뿌리의 출처 카드를 보유하면 그 카드 */
  viewerLineCard?: BloodlineCardItem | null;
  viewerRelation?: BloodlineViewerRelation;
  error?: string;
  errorCode?: string;
}

export interface BloodlineRecipientItem {
  /** 마스킹 적용 */
  user: BloodlineUserRef;
  lineCardId: number;
  /** direct = 보낸 사람에게서 직접 받음, rehomed = 다음 분에게 보내기(LINE_TRANSFER)로 받은 현재 보유자 */
  via: "direct" | "rehomed";
  receivedAt: string;
  isMe?: boolean;
  /**
   * 이 사람이 누구에게나(비로그인 포함) 닉네임이 보이는지. 출처 카드에서 "내 닉네임 공개"를 켰으면 true.
   * 보낸 사람에게는 받은 사람이 늘 보이므로, false 면 화면이 "다른 사람에게는 닉네임이 비공개예요"를 덧붙인다.
   * 가린 사용자(masked)는 늘 false.
   */
  nameVisible?: boolean;
}

/** `GET /api/bloodline-cards/[id]/recipients` (공개, 뷰어별 마스킹) */
export interface BloodlineRecipientsResponse {
  success: boolean;
  /** = receivedCount */
  total: number;
  recipients: BloodlineRecipientItem[];
  error?: string;
  errorCode?: string;
}

/** 상품·경매 상세의 혈통 요약(뷰어와 무관). ACTIVE 혈통이 아니면 응답에 null. */
export interface BloodlineLinkSummary {
  /** 뿌리 혈통 id */
  id: number;
  name: string;
  speciesType: string | null;
  /** "충남 공주" */
  originLabel: string | null;
  creator: { id: number; name: string };
  /** 판매자가 만든 / 보유(넘겨받음) / 출처 카드 받음 / 지금은 관계 없음 */
  sellerRelation: "creator" | "holder" | "received" | "none";
  /** received 일 때 출처 카드를 받은 날(ISO) */
  receivedAt: string | null;
}

/** 경매 상세 응답의 혈통 요약. winnerReceived 는 판매자·종료·낙찰자 있음이고 판매자가 지금 보낼 수 있을 때만 계산한다. */
export type AuctionBloodlineLinkSummary = BloodlineLinkSummary & { winnerReceived?: boolean };

/* ------------------------------------------------------------------ */
/* 화면 공용 순수 함수 (앱 bloodline-management/index.tsx·BloodlineSectionListScreen 과 같은 규칙) */
/* ------------------------------------------------------------------ */

type BloodlineCardsLike = Partial<
  Pick<
    BloodlineCardsResponse,
    | "myBloodlines"
    | "createdLines"
    | "receivedBloodlines"
    | "receivedLines"
    | "myCreatedCards"
    | "receivedCards"
    | "ownedCards"
  >
>;

export interface BloodlineCardGroups {
  myBloodlines: BloodlineCardItem[];
  createdLines: BloodlineCardItem[];
  receivedBloodlines: BloodlineCardItem[];
  receivedLines: BloodlineCardItem[];
  /** 받은 혈통 + 받은 라인 */
  receivedCards: BloodlineCardItem[];
}

/**
 * 응답을 내 혈통 / 내 라인 / 받은 카드로 나눈다. 새 필드가 비어 있으면 호환 필드(myCreatedCards·
 * receivedCards·ownedCards)로 채운다.
 */
export function groupBloodlineCards(
  data: BloodlineCardsLike | null | undefined,
  userId?: number | null
): BloodlineCardGroups {
  if (!data) {
    return {
      myBloodlines: [],
      createdLines: [],
      receivedBloodlines: [],
      receivedLines: [],
      receivedCards: [],
    };
  }
  const owned = data.ownedCards || [];
  const pick = (
    primary: BloodlineCardItem[] | undefined,
    compat: BloodlineCardItem[] | undefined,
    cardType: BloodlineCardType,
    mine: boolean
  ) => {
    if (primary?.length) return primary;
    if (compat?.length) return compat.filter((card) => card.cardType === cardType);
    return owned.filter(
      (card) =>
        (mine ? card.creator.id === userId : card.creator.id !== userId) &&
        card.cardType === cardType
    );
  };
  const myBloodlines = pick(data.myBloodlines, data.myCreatedCards, "BLOODLINE", true);
  const createdLines = pick(data.createdLines, data.myCreatedCards, "LINE", true);
  const receivedBloodlines = pick(data.receivedBloodlines, data.receivedCards, "BLOODLINE", false);
  const receivedLines = pick(data.receivedLines, data.receivedCards, "LINE", false);
  return {
    myBloodlines,
    createdLines,
    receivedBloodlines,
    receivedLines,
    receivedCards: [...receivedBloodlines, ...receivedLines],
  };
}

export type BloodlineManagementFilter = "all" | "bloodline" | "line" | "received";

const FOCUS_TO_FILTER: Record<string, BloodlineManagementFilter> = {
  // 예전 섹션형 화면의 ?focus= 값(알림·외부 링크 호환)
  myBloodlines: "bloodline",
  createdLines: "line",
  receivedCards: "received",
  // 지금 칩 값도 그대로 받는다
  all: "all",
  bloodline: "bloodline",
  line: "line",
  received: "received",
};

/** 혈통관리 `?focus=` 딥링크 → 칩. 모르는 값이면 null(기본 "전체"). */
export function bloodlineFilterFromFocus(focus?: string | null): BloodlineManagementFilter | null {
  if (!focus) return null;
  return Object.prototype.hasOwnProperty.call(FOCUS_TO_FILTER, focus) ? FOCUS_TO_FILTER[focus] : null;
}

/** 혈통관리 칩별 카드. "전체"는 id 로 중복을 없앤 합집합. */
export function cardsForBloodlineFilter(
  groups: BloodlineCardGroups,
  filter: BloodlineManagementFilter
): BloodlineCardItem[] {
  if (filter === "bloodline") return groups.myBloodlines;
  if (filter === "line") return groups.createdLines;
  if (filter === "received") return groups.receivedCards;
  const seen = new Set<number>();
  return [...groups.myBloodlines, ...groups.createdLines, ...groups.receivedCards].filter(
    (card) => {
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    }
  );
}

/** 검색에 쓸 사용자 이름. 가린 사용자("닉네임 비공개")는 검색 대상에서 뺀다. */
const searchableUserName = (user: BloodlineUserRef | null | undefined) =>
  user && !user.masked ? user.name.toLowerCase() : "";

/** 하위 목록 검색: 카드명·설명·제작자·보유자 닉네임(가린 이름 제외). */
export function searchBloodlineCards(cards: BloodlineCardItem[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return cards;
  return cards.filter(
    (card) =>
      card.name.toLowerCase().includes(normalized) ||
      Boolean(card.description?.toLowerCase().includes(normalized)) ||
      searchableUserName(card.creator).includes(normalized) ||
      searchableUserName(card.currentOwner).includes(normalized)
  );
}

/** 카드 메타 줄: "종 · 설명" (빈 값 제외). */
export function bloodlineCardMeta(card: Pick<BloodlineCardItem, "speciesType" | "description">) {
  return [card.speciesType, card.description]
    .map((part) => (part ? part.trim() : ""))
    .filter(Boolean)
    .join(" · ");
}

export const bloodlineCardTypeLabel = (cardType: BloodlineCardType) =>
  cardType === "BLOODLINE" ? "혈통" : "출처 카드";

/** ISO → "2026.03.14". 잘못된 값이면 null. */
export function formatBloodlineIssuedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}.${month}.${day}`;
}

/** ISO → "03.14 09:05" (이력·이벤트 행). */
export function formatBloodlineEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

/** ISO → "2026.09.12"(이력 행·받은 날). 잘못된 값이면 받은 그대로. */
export function formatBloodlineEventDate(value: string) {
  return formatBloodlineIssuedAt(value) ?? value;
}

/** "받은 사람 3명" / 0 이면 "아직 받은 사람 없음" / 값이 없으면(구 서버) null → 그리지 않는다. */
export function formatReceivedCount(count?: number | null) {
  if (typeof count !== "number" || !Number.isFinite(count)) return null;
  return count > 0 ? `받은 사람 ${count}명` : "아직 받은 사람 없음";
}

/** 이력에서 숨기는 사건. LINE_CREATED 는 LINE_ISSUED 와 같은 사건의 중복 기록이다. */
export const isHiddenBloodlineEvent = (action: BloodlineCardEventType) => action === "LINE_CREATED";

/** 이력 문장 속 사람: 가린 사람은 "닉네임 비공개 분", 없으면 탈퇴 표시, 그 외 "○○님". */
export function bloodlineUserPhrase(user: BloodlineUserRef | null | undefined) {
  if (!user) return `${DELETED_USER_LABEL}님`;
  if (user.masked) return `${BLOODLINE_MASKED_USER_NAME} 분`;
  return `${displayUserName(user.name) || DELETED_USER_LABEL}님`;
}

/**
 * 이력 한 줄(설계 §2.3):
 * BLOODLINE_CREATED "○○님이 만들었어요" / LINE_ISSUED "○○님에게 보냈어요" /
 * LINE_TRANSFER "○○님이 다음 분에게 보냈어요" / BLOODLINE_TRANSFER "○○님에게 혈통을 넘겼어요" /
 * CARD_REVOKED "운영 정책으로 회수됐어요". LINE_CREATED 는 화면에서 숨긴다(isHiddenBloodlineEvent).
 */
export function bloodlineEventSentence(
  event: Pick<BloodlineCardEventItem, "action" | "actorUser" | "fromUser" | "toUser">
) {
  // "○○님" / "닉네임 비공개 분" 모두 받침이 있어 조사는 "이" 다.
  switch (event.action) {
    case "BLOODLINE_CREATED":
      return `${bloodlineUserPhrase(event.actorUser)}이 만들었어요`;
    case "LINE_ISSUED":
    case "LINE_CREATED":
      return `${bloodlineUserPhrase(event.toUser)}에게 보냈어요`;
    case "LINE_TRANSFER":
      return `${bloodlineUserPhrase(event.fromUser ?? event.actorUser)}이 다음 분에게 보냈어요`;
    case "BLOODLINE_TRANSFER":
      return `${bloodlineUserPhrase(event.toUser)}에게 혈통을 넘겼어요`;
    case "CARD_REVOKED":
      return "운영 정책으로 회수됐어요";
    default:
      return "";
  }
}
