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
