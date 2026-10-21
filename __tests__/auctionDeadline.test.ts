import { formatAuctionDeadline } from "@libs/shared/auctionDeadline";

/** 앱 src/lib/auctionDeadline.ts 와 같은 규칙(앱은 scripts/test-auction-deadline.mjs). */

describe("formatAuctionDeadline", () => {
  it("KST 로 '21일 밤 11:05 마감'처럼 쓰고, 다른 달이면 월을 붙인다", () => {
    const now = Date.parse("2026-10-21T00:58:00+09:00");
    expect(formatAuctionDeadline("2026-10-21T14:05:00Z", now)).toBe("21일 밤 11:05 마감");
    expect(formatAuctionDeadline("2026-10-22T00:30:00+09:00", now)).toBe("22일 새벽 12:30 마감");
    expect(formatAuctionDeadline("2026-11-02T12:00:00+09:00", now)).toBe("11월 2일 낮 12:00 마감");
    expect(formatAuctionDeadline("invalid", now)).toBe("");
  });
});
