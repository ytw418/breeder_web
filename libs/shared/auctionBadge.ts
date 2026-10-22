/**
 * 경매 목록 카드 사진 위 딱지(2026-10-22 사용자 "유찰·진행중은 목록에서 보여 주지 마, NEW 랑 몇 개는 어그로 문구").
 * 문구는 실제 데이터로만 고른다 — 지어낸 숫자·문구는 쓰지 않는다.
 * - 종료: '종료'(회색). 유찰·취소: 딱지 없음. 진행중이어도 '진행중' 딱지는 없다.
 * - 진행 중(마감 전): 지금 많이 보는 경매(서버 popular) → '지금 많이 보는 중', 이번 회차 입찰 3회 이상 → '입찰 경쟁 중',
 *   올린(다시 시작한) 지 24시간 안 → 'NEW'. 셋 다 아니면 딱지 없음.
 * 앱 src/lib/auctionBadge.ts 와 같은 사본이다(웹 jest __tests__/auctionBadge.test.ts, 앱 node --test scripts/test-auction-badge.mjs).
 */

/** 올린 지 이 안이면 NEW. */
export const AUCTION_NEW_MS = 24 * 60 * 60 * 1000;
/** 이번 회차 입찰이 이만큼이면 '입찰 경쟁 중'. */
export const AUCTION_HOT_BIDS = 3;
/** '지금 많이 보는 중': 진행 중 경매 가운데 조회 수(Auction.viewCount) 상위 몇 개. 서버 목록 API 가 고른다. */
export const AUCTION_POPULAR_COUNT = 3;
/** 조회 수가 이보다 적으면 상위여도 '많이 보는 중'이라 하지 않는다. */
export const AUCTION_POPULAR_MIN_VIEWS = 10;

export type AuctionBadgeTone = "new" | "hot" | "ended";

export interface AuctionBadge {
  label: string;
  tone: AuctionBadgeTone;
}

export function auctionCardBadge(input: {
  status: string;
  endAt: string | Date;
  /** 목록 정렬 시각(등록·다시 시작). 옛 응답이면 createdAt 을 쓴다. */
  listedAt?: string | Date | null;
  createdAt?: string | Date | null;
  bids: number;
  /** 지금 시각. 아직 모르면(첫 렌더) 진행 중 딱지를 그리지 않는다. */
  nowMs: number | null | undefined;
  /** 서버가 '지금 많이 보는 경매'로 고른 경매. */
  popular?: boolean;
}): AuctionBadge | null {
  if (input.status === "종료") return { label: "종료", tone: "ended" };
  if (input.status !== "진행중" || input.nowMs == null) return null;
  if (new Date(input.endAt).getTime() <= input.nowMs) return null;
  if (input.popular) return { label: "지금 많이 보는 중", tone: "hot" };
  if (input.bids >= AUCTION_HOT_BIDS) return { label: "입찰 경쟁 중", tone: "hot" };
  const listed = input.listedAt ?? input.createdAt;
  if (listed && input.nowMs - new Date(listed).getTime() <= AUCTION_NEW_MS) return { label: "NEW", tone: "new" };
  return null;
}
