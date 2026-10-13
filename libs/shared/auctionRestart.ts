/**
 * 경매 다시 시작 규칙·문구(앱 docs/prd/auction-restart.md, 2026-10-13).
 * 유찰된 경매, 또는 낙찰됐지만 낙찰자가 입양하지 않은 경매를 분양자가 기간만 새로 정해 같은 경매로 다시 연다.
 * 웹 libs/shared/auctionRestart.ts = 앱 src/lib/auctionRestart.ts 사본이라 함께 고친다(웹 jest·앱 npm run test:auction-restart).
 */

/** 경매 하나당 다시 시작할 수 있는 횟수. round 는 1부터라 다시 시작한 횟수 = round - 1. */
export const AUCTION_MAX_RESTARTS = 3;

export type AuctionRestartReasonId = "NO_CONTACT" | "DECLINED" | "OTHER";

/** 낙찰된 경매를 다시 시작할 때 고르는 사유. 유찰은 사유가 없다. */
export const AUCTION_RESTART_REASONS: readonly { id: AuctionRestartReasonId; label: string }[] = [
  { id: "NO_CONTACT", label: "낙찰자가 연락이 없어요" },
  { id: "DECLINED", label: "낙찰자가 입양을 안 한대요" },
  { id: "OTHER", label: "다른 이유로 입양이 안 됐어요" },
];

export function isAuctionRestartReasonId(value: unknown): value is AuctionRestartReasonId {
  return AUCTION_RESTART_REASONS.some((reason) => reason.id === value);
}

export function auctionRestartReasonLabel(id: string | null | undefined): string {
  return AUCTION_RESTART_REASONS.find((reason) => reason.id === id)?.label ?? "";
}

/** 낙찰된 경매를 다시 시작하면 운영팀에 자동으로 접수하는 신고 사유(사용자 신고 사유 목록에는 없다). */
export const AUCTION_NO_SHOW_REPORT_REASON = "낙찰 후 노쇼";

export function auctionNoShowReportDetail(input: {
  round: number;
  price: number;
  reason: AuctionRestartReasonId;
}): string {
  return `${input.round}번째 경매 낙찰자(낙찰가 ${input.price.toLocaleString("ko-KR")}원)가 입양을 진행하지 않아 분양자가 경매를 다시 시작했어요. 사유: ${auctionRestartReasonLabel(input.reason)}`;
}

/** 다시 시작할 수 없는 이유. status: 진행중·취소, hidden: 운영자 숨김, limit: 횟수를 다 씀. */
export type AuctionRestartLock = "status" | "hidden" | "limit" | null;

export interface AuctionRestartState {
  eligible: boolean;
  /** 낙찰자가 있는 종료 경매면 사유를 골라야 한다(낙찰 취소 + 재입찰 막기 + 운영 신고). */
  reasonRequired: boolean;
  restartsLeft: number;
  lock: AuctionRestartLock;
}

/** 분양자 기준 다시 시작 가능 여부. 유찰, 또는 종료(낙찰자 있으면 사유 필수)만 된다. */
export function getAuctionRestartState(auction: {
  status: string;
  winnerId: number | null;
  round?: number | null;
  isHidden?: boolean | null;
}): AuctionRestartState {
  const round = Math.max(1, Math.floor(Number(auction.round) || 1));
  const restartsLeft = Math.max(0, AUCTION_MAX_RESTARTS - (round - 1));
  const reasonRequired = auction.status === "종료" && auction.winnerId != null;
  const locked = (lock: AuctionRestartLock): AuctionRestartState => ({
    eligible: false,
    reasonRequired,
    restartsLeft,
    lock,
  });
  if (auction.isHidden) return locked("hidden");
  if (auction.status !== "유찰" && auction.status !== "종료") return locked("status");
  if (restartsLeft <= 0) return locked("limit");
  return { eligible: true, reasonRequired, restartsLeft, lock: null };
}

/** 2회차부터 "2번째 경매". 1회차는 빈 문자열(표시하지 않는다). */
export function auctionRoundLabel(round: number | null | undefined): string {
  const value = Math.floor(Number(round) || 1);
  return value >= 2 ? `${value}번째 경매` : "";
}

/** 상세 '지난 경매' 한 줄. reason 은 분양자·운영자에게만 실린다. */
export interface AuctionPreviousRound {
  round: number;
  status: string;
  endedAt: string;
  finalPrice: number;
  bidCount: number;
  reason: string | null;
}

export function formatAuctionPreviousRound(previous: AuctionPreviousRound): string {
  const head = `${previous.round}번째 경매`;
  if (previous.status !== "종료" || previous.bidCount <= 0) return `${head} · 입찰 없이 마감`;
  const reason = auctionRestartReasonLabel(previous.reason);
  return [
    head,
    `입찰 ${previous.bidCount}건`,
    `낙찰가 ${previous.finalPrice.toLocaleString("ko-KR")}원`,
    reason ? `입양 안 됨(${reason})` : "입양 안 됨",
  ].join(" · ");
}

export const AUCTION_RESTART_COPY = {
  button: "경매 다시 시작",
  unsoldOwnerNotice: "입찰 없이 마감됐어요. 기간을 새로 정해 다시 시작해 보세요.",
  endedOwnerCaption: "낙찰자가 입양하지 않았다면 경매를 다시 시작할 수 있어요.",
  sheetTitle: "경매 다시 시작",
  sheetDescription: (nextRound: number, startPrice: number) =>
    `${nextRound}번째 경매로 다시 열어요. 시작가 ${startPrice.toLocaleString("ko-KR")}원부터 다시 입찰을 받고, 사진·설명·입찰 단위는 그대로예요.`,
  durationLabel: "경매 기간",
  endsAt: (text: string) => `마감 ${text}`,
  reasonLabel: "다시 시작하는 이유",
  winnerNotice:
    "낙찰은 취소되고 낙찰자에게 알림이 가요. 낙찰자는 이 경매에 다시 입찰할 수 없고, 운영팀에 '낙찰 후 노쇼' 신고가 함께 접수돼요.",
  restartsLeft: (left: number) =>
    `다시 시작은 경매마다 ${AUCTION_MAX_RESTARTS}번까지 할 수 있어요(남은 횟수 ${left}번).`,
  limitReached: `다시 시작을 ${AUCTION_MAX_RESTARTS}번 모두 했어요. 새 경매로 등록해 주세요.`,
  confirm: "다시 시작",
  submitting: "다시 시작하는 중...",
  cancel: "닫기",
  success: (round: number) => `${round}번째 경매를 시작했어요`,
  blockedBidderNotice: "이전 낙찰자는 이 경매에 다시 입찰할 수 없어요.",
  previousRoundsTitle: "지난 경매",
} as const;

export const AUCTION_RESTART_NOTIFICATIONS = {
  /** 유찰 정산 때 분양자에게(AUCTION_END). */
  unsold: (title: string) =>
    `"${title}" 경매가 입찰 없이 마감됐어요. 기간을 새로 정해 다시 시작해 보세요.`,
  /** 낙찰을 취소하고 다시 시작했을 때 이전 낙찰자에게(AUCTION_RESTARTED). */
  winnerCancelled: (sellerName: string, title: string) =>
    `${sellerName}님이 "${title}" 경매의 낙찰을 취소하고 다시 시작했어요. 이 경매에는 다시 입찰할 수 없어요.`,
  /** 다시 시작했을 때 지난 회차 입찰자에게(AUCTION_RESTARTED). */
  bidderInvite: (sellerName: string, title: string, startPrice: number) =>
    `${sellerName}님이 "${title}" 경매를 다시 시작했어요. 시작가 ${startPrice.toLocaleString("ko-KR")}원부터 다시 입찰할 수 있어요.`,
} as const;

export const AUCTION_RESTART_ERROR_MESSAGES: Record<string, string> = {
  AUCTION_RESTART_FORBIDDEN: "분양자만 경매를 다시 시작할 수 있어요.",
  AUCTION_RESTART_ACCOUNT_RESTRICTED: "현재 계정 상태에서는 경매를 다시 시작할 수 없어요.",
  AUCTION_RESTART_NOT_ALLOWED: "유찰됐거나 낙찰 후 입양이 안 된 경매만 다시 시작할 수 있어요.",
  AUCTION_RESTART_LIMIT_EXCEEDED: AUCTION_RESTART_COPY.limitReached,
  AUCTION_RESTART_REASON_REQUIRED: "다시 시작하는 이유를 골라 주세요.",
  AUCTION_DURATION_OUT_OF_RANGE_RESTART: "경매 기간은 지금부터 1시간~72시간 사이여야 해요.",
  AUCTION_RESTART_CONFLICT: "경매 상태가 바뀌었어요. 새로고침한 뒤 다시 시도해 주세요.",
  AUCTION_RESTART_FAILED: "경매를 다시 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
  BID_BLOCKED_PREVIOUS_WINNER: AUCTION_RESTART_COPY.blockedBidderNotice,
};
