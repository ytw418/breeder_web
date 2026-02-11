import { getBidIncrement } from "@libs/auctionRules";

describe("경매 입찰 단위 규칙", () => {
  it("1만원 미만은 1,000원 단위", () => {
    expect(getBidIncrement(9_999)).toBe(1_000);
  });

  it("10만원 미만은 10,000원 단위", () => {
    expect(getBidIncrement(10_000)).toBe(10_000);
    expect(getBidIncrement(99_999)).toBe(10_000);
  });

  it("100만원 미만은 50,000원 단위", () => {
    expect(getBidIncrement(100_000)).toBe(50_000);
    expect(getBidIncrement(999_999)).toBe(50_000);
  });

  it("100만원 이상은 100,000원 단위", () => {
    expect(getBidIncrement(1_000_000)).toBe(100_000);
    expect(getBidIncrement(2_100_000)).toBe(100_000);
  });
});
