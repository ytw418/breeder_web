import {
  scoreBloodline,
  scoreBreeder,
  scoreTrendingPost,
} from "@libs/server/ranking";
import { getKstWeekWindow, getPreviousKstWeekWindow } from "@libs/server/season";

describe("growth ranking helpers", () => {
  it("브리더 점수를 계획된 가중치대로 계산한다", () => {
    expect(
      scoreBreeder({
        postsCount: 2,
        commentsCount: 3,
        bidsCount: 1,
        auctionWinsCount: 1,
        sellerEndedAuctionsCount: 2,
      })
    ).toBe(69);
  });

  it("혈통 점수는 상승률 보정값을 포함해 계산한다", () => {
    expect(
      scoreBloodline({
        followCount: 5,
        tradeCount: 2,
        avgClosingPrice: 150000,
        growthRate7d: 0.5,
      })
    ).toBe(65);
  });

  it("급상승 커뮤니티 점수는 최근 24시간 좋아요/댓글 가중치를 따른다", () => {
    expect(
      scoreTrendingPost({
        likes24h: 4,
        comments24h: 3,
      })
    ).toBe(27);
  });

  it("KST 주간 경계는 월요일 00:00부터 일요일 23:59:59.999까지다", () => {
    const base = new Date("2026-03-11T03:00:00.000Z");
    const current = getKstWeekWindow(base);
    expect(current.startAt.toISOString()).toBe("2026-03-08T15:00:00.000Z");
    expect(current.endAt.toISOString()).toBe("2026-03-15T14:59:59.999Z");

    const previous = getPreviousKstWeekWindow(base);
    expect(previous.startAt.toISOString()).toBe("2026-03-01T15:00:00.000Z");
    expect(previous.endAt.toISOString()).toBe("2026-03-08T14:59:59.999Z");
  });
});
