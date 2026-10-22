import { AUCTION_HOT_BIDS, AUCTION_NEW_MS, auctionCardBadge } from "@libs/shared/auctionBadge";

const NOW = Date.parse("2026-10-22T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const live = {
  status: "진행중",
  endAt: new Date(NOW + 48 * HOUR).toISOString(),
  listedAt: new Date(NOW - 72 * HOUR).toISOString(),
  bids: 0,
  nowMs: NOW,
};

describe("auctionCardBadge", () => {
  it("유찰·취소와 그냥 진행중은 딱지가 없다", () => {
    expect(auctionCardBadge({ ...live, status: "유찰" })).toBeNull();
    expect(auctionCardBadge({ ...live, status: "취소" })).toBeNull();
    expect(auctionCardBadge(live)).toBeNull();
  });

  it("종료는 회색 '종료'", () => {
    expect(auctionCardBadge({ ...live, status: "종료" })).toEqual({ label: "종료", tone: "ended" });
  });

  it("올린 지 24시간 안이면 NEW, 옛 응답은 createdAt 으로 본다", () => {
    expect(auctionCardBadge({ ...live, listedAt: new Date(NOW - 2 * HOUR).toISOString() })).toEqual({ label: "NEW", tone: "new" });
    expect(auctionCardBadge({ ...live, listedAt: new Date(NOW - AUCTION_NEW_MS - 1).toISOString() })).toBeNull();
    expect(auctionCardBadge({ ...live, listedAt: undefined, createdAt: new Date(NOW - HOUR).toISOString() })).toEqual({ label: "NEW", tone: "new" });
  });

  it("입찰 3회 이상이면 '입찰 경쟁 중'(NEW 보다 먼저)", () => {
    expect(AUCTION_HOT_BIDS).toBe(3);
    expect(auctionCardBadge({ ...live, bids: 2 })).toBeNull();
    expect(auctionCardBadge({ ...live, bids: 3, listedAt: new Date(NOW - HOUR).toISOString() })).toEqual({ label: "입찰 경쟁 중", tone: "hot" });
  });

  it("서버가 고른 많이 보는 경매는 '지금 많이 보는 중'이 가장 먼저", () => {
    expect(auctionCardBadge({ ...live, bids: 5, popular: true })).toEqual({ label: "지금 많이 보는 중", tone: "hot" });
  });

  it("마감 시각이 지났거나 지금 시각을 모르면 진행 중 딱지를 그리지 않는다", () => {
    expect(auctionCardBadge({ ...live, bids: 5, endAt: new Date(NOW - 1).toISOString() })).toBeNull();
    expect(auctionCardBadge({ ...live, bids: 5, nowMs: undefined })).toBeNull();
  });
});
