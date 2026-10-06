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

export interface BloodlineCardTransferItem {
  id: number;
  fromUser: { id: number; name: string } | null;
  toUser: { id: number; name: string };
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
  creator: { id: number; name: string };
  currentOwner: { id: number; name: string };
  isOwnedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
  transfers: BloodlineCardTransferItem[];
  visualStyle?: BloodlineCardVisualStyle;
}

export interface BloodlineCardEventItem {
  id: number;
  action: BloodlineCardEventType;
  actorUser: { id: number; name: string } | null;
  fromUser: { id: number; name: string } | null;
  toUser: { id: number; name: string } | null;
  relatedCard: { id: number; name: string } | null;
  note: string | null;
  createdAt: string;
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
  error?: string;
}

export interface BloodlineCardTransferResponse {
  success: boolean;
  error?: string;
}

export interface BloodlineCardIssueLineResponse {
  success: boolean;
  card: BloodlineCardItem | null;
  error?: string;
}

export interface BloodlineCardEventsResponse {
  success: boolean;
  events: BloodlineCardEventItem[];
  error?: string;
}

export interface BloodlineCardDetailResponse {
  success: boolean;
  card: BloodlineCardItem | null;
  bloodlineSourceCard: BloodlineCardItem | null;
  parentLineCard: BloodlineCardItem | null;
  error?: string;
}

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

/** 하위 목록 검색: 카드명·설명·제작자·보유자 닉네임. */
export function searchBloodlineCards(cards: BloodlineCardItem[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return cards;
  return cards.filter(
    (card) =>
      card.name.toLowerCase().includes(normalized) ||
      Boolean(card.description?.toLowerCase().includes(normalized)) ||
      card.creator.name.toLowerCase().includes(normalized) ||
      card.currentOwner.name.toLowerCase().includes(normalized)
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
  cardType === "BLOODLINE" ? "혈통" : "라인";

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
