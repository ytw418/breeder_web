export const AUCTION_EDIT_WINDOW_MS = 10 * 60 * 1000; // 10분
export const AUCTION_EXTENSION_WINDOW_MS = 3 * 60 * 1000; // 종료 3분 이내
export const AUCTION_EXTENSION_MS = 5 * 60 * 1000; // +5분
export const AUCTION_MIN_START_PRICE = 1000;
export const AUCTION_MIN_DURATION_MS = 1 * 60 * 60 * 1000; // 1시간
export const AUCTION_MAX_DURATION_MS = 72 * 60 * 60 * 1000; // 72시간
export const AUCTION_MAX_ACTIVE_PER_USER = 100;
export const AUCTION_HIGH_PRICE_REQUIRE_CONTACT = 500_000;
/** 경매 사진 장수(등록·수정 공통). 서버 검증과 웹·앱 업로드 화면이 같은 값을 쓴다. */
export const AUCTION_PHOTOS_MIN = 1;
export const AUCTION_PHOTOS_MAX = 10;
/** 낙찰 후 결제·배송 모델이 없어, 종료 후 이 기간을 거래 진행 중으로 본다(회원탈퇴 차단 등). */
export const AUCTION_SETTLEMENT_GRACE_DAYS = 7;

/**
 * 입찰 단위는 판매자가 등록·수정 때 정하고 경매가 끝날 때까지 고정이다(Auction.minBidIncrement).
 * 범위는 1,000원~1,000,000원, 100원 단위. 서버 검증과 웹·앱 등록 화면이 같은 값을 쓴다.
 */
export const AUCTION_MIN_BID_INCREMENT = 1_000;
export const AUCTION_MAX_BID_INCREMENT = 1_000_000;
export const AUCTION_BID_INCREMENT_STEP = 100;
/** 등록 화면 안내·오류·룰 화면 공용 문구: "1,000원~1,000,000원, 100원 단위". */
export const AUCTION_BID_INCREMENT_RANGE_TEXT = `${AUCTION_MIN_BID_INCREMENT.toLocaleString("ko-KR")}원~${AUCTION_MAX_BID_INCREMENT.toLocaleString("ko-KR")}원, ${AUCTION_BID_INCREMENT_STEP}원 단위`;

/** 시작가 구간별 추천 입찰 단위. 등록 화면 기본값이고, 입찰 단위를 보내지 않는 구 앱 등록에도 쓴다. */
export const AUCTION_BID_INCREMENT_RULES = [
  { label: "1만원 미만", maxExclusive: 10_000, increment: 1_000 },
  { label: "10만원 미만", maxExclusive: 100_000, increment: 10_000 },
  { label: "100만원 미만", maxExclusive: 1_000_000, increment: 50_000 },
  { label: "100만원 이상", maxExclusive: null, increment: 100_000 },
] as const;

/** 가격 구간별 추천 입찰 단위(AUCTION_BID_INCREMENT_RULES). */
export const getBidIncrement = (price: number) => {
  const normalizedPrice = Math.max(0, Math.floor(Number(price) || 0));

  const matchedRule = AUCTION_BID_INCREMENT_RULES.find((rule) => {
    if (rule.maxExclusive === null) return true;
    return normalizedPrice < rule.maxExclusive;
  });

  return matchedRule?.increment ?? 1_000;
};

/** 판매자가 정한 입찰 단위가 허용 범위(AUCTION_BID_INCREMENT_RANGE_TEXT)인지. */
export const isBidIncrementValid = (value: number) =>
  Number.isInteger(value) &&
  value >= AUCTION_MIN_BID_INCREMENT &&
  value <= AUCTION_MAX_BID_INCREMENT &&
  value % AUCTION_BID_INCREMENT_STEP === 0;

/** 요청 body 의 입찰 단위. 보내지 않았으면(구 앱) undefined, 보냈으면 숫자(검사는 isBidIncrementValid). */
export const readRequestedBidIncrement = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  return Number(value);
};

/**
 * 경매의 입찰 단위. 저장값이 0 이하·없음일 때만 현재가 구간값으로 대신한다.
 * 범위 밖 저장값(예전 시드)도 그대로 믿는다 — 규칙이 바뀌어도 진행 중 경매가 깨지지 않게.
 */
export const resolveBidIncrement = (auction: {
  minBidIncrement?: number | null;
  currentPrice: number;
}) => {
  const stored = Number(auction.minBidIncrement);
  return Number.isInteger(stored) && stored > 0 ? stored : getBidIncrement(auction.currentPrice);
};

export const getMinimumBid = (currentPrice: number, increment: number) => {
  return Math.max(0, Number(currentPrice) || 0) + increment;
};

export const isAuctionDurationValid = (endAt: Date | string, baseTime = new Date()) => {
  const diff = new Date(endAt).getTime() - new Date(baseTime).getTime();
  return diff >= AUCTION_MIN_DURATION_MS && diff <= AUCTION_MAX_DURATION_MS;
};

/** 현재가 + 입찰 단위 이상이고, 현재가에서 입찰 단위의 배수만큼 올린 금액인지. */
export const isBidAmountValid = ({
  currentPrice,
  bidAmount,
  increment,
}: {
  currentPrice: number;
  bidAmount: number;
  increment: number;
}) => {
  const diff = bidAmount - currentPrice;
  return diff >= increment && diff % increment === 0;
};

export const getAuctionEditDeadline = (createdAt: Date | string) => {
  return new Date(new Date(createdAt).getTime() + AUCTION_EDIT_WINDOW_MS);
};

export const canEditAuction = ({
  isOwner,
  createdAt,
  status,
  bidCount,
  now = new Date(),
}: {
  isOwner: boolean;
  createdAt: Date | string;
  status: string;
  bidCount: number;
  now?: Date;
}) => {
  if (!isOwner) return false;
  if (status !== "진행중") return false;
  if (bidCount > 0) return false;
  const deadline = getAuctionEditDeadline(createdAt);
  return now <= deadline;
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
/**
 * 서버는 요청을 받은 시각 기준으로 종료 시각이 1~72시간 사이인지 본다(isAuctionDurationValid).
 * 요청 지연과 기기·서버 시계 차이를 견디도록 허용 범위 양 끝에서 1분씩 안쪽으로 둔다.
 */
const DURATION_MARGIN_MS = MINUTE_MS;

/**
 * 기간 프리셋(N시간)의 종료 시각(ms, 분 단위). 등록·수정 화면 공용(앱 getPresetEndAtMs 와 같다).
 * 분을 올린 뒤 N시간을 더하면 72시간 프리셋이 상한을 넘어 거의 항상 거절됐다.
 * 그래서 허용 범위(1시간+1분 ~ 72시간-1분) 안으로 자른다.
 */
export function getPresetEndAtMs(hours: number, nowMs = Date.now()): number {
  const earliest =
    Math.ceil((nowMs + AUCTION_MIN_DURATION_MS + DURATION_MARGIN_MS) / MINUTE_MS) * MINUTE_MS;
  const latest =
    Math.floor((nowMs + AUCTION_MAX_DURATION_MS - DURATION_MARGIN_MS) / MINUTE_MS) * MINUTE_MS;
  const target = Math.ceil(nowMs / MINUTE_MS) * MINUTE_MS + hours * HOUR_MS;
  return Math.min(Math.max(target, earliest), latest);
}

/** 진행중 경매의 마감 시각이 지났는지(서버 정산 전 '마감' 표시·refetch 판단용). */
export function isAuctionTimeOver(endAt: string | Date, nowMs = Date.now()): boolean {
  const end = new Date(endAt).getTime();
  if (Number.isNaN(end)) return false;
  return end - nowMs <= 0;
}

/** 경매 남은 시간: "3일 2시간 남음" / "12분 남음" / 지났으면 "마감"(앱 formatTimeLeft). */
export function formatAuctionTimeLeft(endAt: string | Date, nowMs = Date.now()): string {
  const end = new Date(endAt).getTime();
  if (Number.isNaN(end)) return "";
  const diff = end - nowMs;
  if (diff <= 0) return "마감";
  const min = Math.floor(diff / MINUTE_MS);
  const days = Math.floor(min / (60 * 24));
  const hours = Math.floor((min % (60 * 24)) / 60);
  const mins = min % 60;
  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 ${mins}분 남음`;
  return `${mins}분 남음`;
}

/** 수정 불가 사유. 서버 canEditAuction 규칙(진행중·입찰 없음·등록 후 10분) 순서대로 판별한다. */
export type AuctionEditLockReason = "status" | "bid" | "time";

export const AUCTION_EDIT_LOCK_MESSAGES: Record<
  AuctionEditLockReason,
  { title: string; description: string }
> = {
  status: {
    title: "진행중인 경매만 수정할 수 있습니다",
    description: "종료되었거나 취소된 경매는 수정할 수 없어요.",
  },
  bid: {
    title: "입찰이 들어와 더 이상 수정할 수 없습니다",
    description: "입찰이 시작된 경매는 입찰자 보호를 위해 수정할 수 없어요.",
  },
  time: {
    title: "수정 가능 시간이 지났습니다",
    description: "경매는 등록 후 10분 이내에만 수정할 수 있어요.",
  },
};

export function getAuctionEditLockReason(input: {
  canEdit: boolean;
  status: string;
  bidCount: number;
}): AuctionEditLockReason | null {
  if (input.canEdit) return null;
  if (input.status !== "진행중") return "status";
  if (input.bidCount > 0) return "bid";
  return "time";
}

/** 무한 목록 페이지 사이에 새 항목이 끼어 같은 id 가 다시 오면 처음 것만 남긴다. */
export function uniqueAuctionsById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
