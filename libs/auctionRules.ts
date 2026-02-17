export const AUCTION_EDIT_WINDOW_MS = 10 * 60 * 1000; // 10분
export const AUCTION_EXTENSION_WINDOW_MS = 3 * 60 * 1000; // 종료 3분 이내
export const AUCTION_EXTENSION_MS = 5 * 60 * 1000; // +5분
export const AUCTION_MIN_START_PRICE = 1000;
export const AUCTION_MIN_DURATION_MS = 1 * 60 * 60 * 1000; // 1시간
export const AUCTION_MAX_DURATION_MS = 72 * 60 * 60 * 1000; // 72시간
export const AUCTION_MAX_ACTIVE_PER_USER = 100;
export const AUCTION_HIGH_PRICE_REQUIRE_CONTACT = 500_000;

export const AUCTION_BID_INCREMENT_RULES = [
  { label: "1만원 미만", maxExclusive: 10_000, increment: 1_000 },
  { label: "10만원 미만", maxExclusive: 100_000, increment: 10_000 },
  { label: "100만원 미만", maxExclusive: 1_000_000, increment: 50_000 },
  { label: "100만원 이상", maxExclusive: null, increment: 100_000 },
] as const;

export const getBidIncrement = (price: number) => {
  const normalizedPrice = Math.max(0, Math.floor(Number(price) || 0));

  const matchedRule = AUCTION_BID_INCREMENT_RULES.find((rule) => {
    if (rule.maxExclusive === null) return true;
    return normalizedPrice < rule.maxExclusive;
  });

  return matchedRule?.increment ?? 1_000;
};

export const getMinimumBid = (currentPrice: number) => {
  return Math.max(0, Number(currentPrice) || 0) + getBidIncrement(currentPrice);
};

export const isAuctionDurationValid = (endAt: Date | string, baseTime = new Date()) => {
  const diff = new Date(endAt).getTime() - new Date(baseTime).getTime();
  return diff >= AUCTION_MIN_DURATION_MS && diff <= AUCTION_MAX_DURATION_MS;
};

export const isBidAmountValid = ({
  currentPrice,
  bidAmount,
}: {
  currentPrice: number;
  bidAmount: number;
}) => {
  const increment = getBidIncrement(currentPrice);
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
