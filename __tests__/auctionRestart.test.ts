import {
  AUCTION_RESTART_COPY,
  AUCTION_RESTART_ERROR_MESSAGES,
  AUCTION_RESTART_NOTIFICATIONS,
  AUCTION_RESTART_REASONS,
  formatAuctionPreviousRound,
  getAuctionRestartState,
} from "@libs/shared/auctionRestart";

/** 앱 src/lib/auctionRestart.ts 와 같은 규칙(앱은 scripts/test-auction-restart.mjs). */

describe("getAuctionRestartState", () => {
  it("유찰은 사유 없이, 낙찰자가 있는 종료는 사유를 받아 다시 시작한다", () => {
    expect(getAuctionRestartState({ status: "유찰", winnerId: null, round: 1 })).toEqual({
      eligible: true,
      reasonRequired: false,
      restartsLeft: 3,
      lock: null,
    });
    expect(getAuctionRestartState({ status: "종료", winnerId: 9, round: 2 })).toEqual({
      eligible: true,
      reasonRequired: true,
      restartsLeft: 2,
      lock: null,
    });
  });

  it("진행중·취소·숨김·횟수 초과는 막는다", () => {
    expect(getAuctionRestartState({ status: "진행중", winnerId: null }).lock).toBe("status");
    expect(getAuctionRestartState({ status: "취소", winnerId: null }).lock).toBe("status");
    expect(getAuctionRestartState({ status: "유찰", winnerId: null, isHidden: true }).lock).toBe("hidden");
    expect(getAuctionRestartState({ status: "유찰", winnerId: null, round: 4 })).toMatchObject({
      eligible: false,
      restartsLeft: 0,
      lock: "limit",
    });
  });
});

describe("formatAuctionPreviousRound", () => {
  it("유찰과 입양 안 된 낙찰을 한 줄로 요약한다", () => {
    const base = { round: 1, endedAt: "2026-10-13T00:00:00.000Z", reason: null };
    expect(formatAuctionPreviousRound({ ...base, status: "유찰", finalPrice: 10000, bidCount: 0 })).toBe(
      "1번째 경매 · 입찰 없이 마감"
    );
    expect(
      formatAuctionPreviousRound({ ...base, status: "종료", finalPrice: 52000, bidCount: 3, reason: "NO_CONTACT" })
    ).toBe("1번째 경매 · 입찰 3건 · 낙찰가 52,000원 · 입양 안 됨(낙찰자가 연락이 없어요)");
  });
});

it("화면·알림 문구에 '상품·판매·구매'를 쓰지 않는다(AGENTS.md 화면 용어)", () => {
  const texts = [
    ...Object.values(AUCTION_RESTART_COPY).map((value) =>
      typeof value === "function" ? (value as (...args: unknown[]) => string)(2, 10000) : value
    ),
    AUCTION_RESTART_NOTIFICATIONS.unsold("왕사슴"),
    AUCTION_RESTART_NOTIFICATIONS.winnerCancelled("브리더", "왕사슴"),
    AUCTION_RESTART_NOTIFICATIONS.bidderInvite("브리더", "왕사슴", 10000),
    ...Object.values(AUCTION_RESTART_ERROR_MESSAGES),
    ...AUCTION_RESTART_REASONS.map((reason) => reason.label),
  ];
  for (const text of texts) expect(text).not.toMatch(/상품|판매|구매/);
});
