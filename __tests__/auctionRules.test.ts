import {
  getBidIncrement,
  getMinimumBid,
  isBidAmountValid,
  isBidIncrementValid,
  readRequestedBidIncrement,
  resolveBidIncrement,
} from "@libs/auctionRules";

describe("경매 추천 입찰 단위(시작가 구간)", () => {
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

describe("판매자가 정하는 입찰 단위", () => {
  it("1,000원~1,000,000원 사이 100원 단위만 허용한다", () => {
    expect(isBidIncrementValid(1_000)).toBe(true);
    expect(isBidIncrementValid(1_500)).toBe(true);
    expect(isBidIncrementValid(1_000_000)).toBe(true);
    expect(isBidIncrementValid(900)).toBe(false);
    expect(isBidIncrementValid(1_050)).toBe(false);
    expect(isBidIncrementValid(1_000_100)).toBe(false);
    expect(isBidIncrementValid(1_500.5)).toBe(false);
    expect(isBidIncrementValid(Number.NaN)).toBe(false);
    expect(isBidIncrementValid(0)).toBe(false);
    expect(isBidIncrementValid(-1_000)).toBe(false);
    expect(isBidIncrementValid(1e12)).toBe(false);
  });

  it("추천 구간값은 모두 허용 범위 안이다", () => {
    for (const price of [0, 9_999, 50_000, 500_000, 5_000_000]) {
      expect(isBidIncrementValid(getBidIncrement(price))).toBe(true);
    }
  });

  it("요청에 입찰 단위가 없으면(구 앱) undefined, 있으면 숫자로 읽는다", () => {
    expect(readRequestedBidIncrement(undefined)).toBeUndefined();
    expect(readRequestedBidIncrement(null)).toBeUndefined();
    expect(readRequestedBidIncrement("")).toBeUndefined();
    // 0 은 "안 보냄"이 아니라 잘못된 값으로 읽어 400 이 나게 한다.
    expect(readRequestedBidIncrement(0)).toBe(0);
    expect(readRequestedBidIncrement(3_000)).toBe(3_000);
    expect(readRequestedBidIncrement("3000")).toBe(3_000);
    expect(readRequestedBidIncrement("abc")).toBeNaN();
  });

  it("경매에 저장된 입찰 단위를 그대로 쓰고, 0 이하·없음이면 현재가 구간값으로 대신한다", () => {
    expect(resolveBidIncrement({ minBidIncrement: 3_000, currentPrice: 50_000 })).toBe(3_000);
    // 규칙이 바뀌어도 진행 중 경매가 깨지지 않게 범위 밖 저장값도 믿는다.
    expect(resolveBidIncrement({ minBidIncrement: 100, currentPrice: 50_000 })).toBe(100);
    expect(resolveBidIncrement({ minBidIncrement: 0, currentPrice: 50_000 })).toBe(10_000);
    expect(resolveBidIncrement({ minBidIncrement: null, currentPrice: 5_000 })).toBe(1_000);
  });
});

describe("입찰 금액 검사", () => {
  it("최소 입찰가는 현재가 + 경매의 입찰 단위", () => {
    expect(getMinimumBid(50_000, 1_000)).toBe(51_000);
  });

  it("현재가에서 입찰 단위의 배수만큼 올린 금액만 허용한다", () => {
    const rule = { currentPrice: 50_000, increment: 1_000 };
    expect(isBidAmountValid({ ...rule, bidAmount: 51_000 })).toBe(true);
    expect(isBidAmountValid({ ...rule, bidAmount: 53_000 })).toBe(true);
    expect(isBidAmountValid({ ...rule, bidAmount: 50_000 })).toBe(false);
    expect(isBidAmountValid({ ...rule, bidAmount: 51_500 })).toBe(false);
  });

  it("시작가 5만원이어도 판매자가 정한 단위로 입찰할 수 있다(구간값 10,000원 강제 아님)", () => {
    expect(isBidAmountValid({ currentPrice: 50_000, increment: 5_000, bidAmount: 55_000 })).toBe(true);
  });
});
