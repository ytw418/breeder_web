import {
  AUCTION_ACTIVITY_WEIGHTS,
  LISTING_METRIC,
  parseRankingParams,
  RANKING_PERIODS,
  RANKING_TYPES,
  rankingEmptyTitle,
  rankingNote,
  rankingRowLabel,
  scoreAuctionActivity,
} from "@libs/shared/rankingTypes";

/** 앱 scripts/web-tests/rankingTypes.test.ts 와 같은 사본. */
const TREE: Record<string, string[]> = { 파충류: ["크레스티드 게코", "볼파이썬"], 어류: ["구피"] };
const subs = (parent: string) => TREE[parent] ?? [];
const tops = Object.keys(TREE);

describe("rankingTypes", () => {
  it("탭은 종합 브리더 + 혈통·경매·분양, 기간은 역대·이번 주·이번 달", () => {
    expect(RANKING_TYPES.map((t) => t.label)).toEqual(["종합 브리더", "인기 혈통", "경매 활동", "분양"]);
    expect(RANKING_PERIODS.map((p) => p.label)).toEqual(["역대", "이번 주", "이번 달"]);
  });

  it("경매 활동 점수는 입찰 2 · 등록 3 · 낙찰 10", () => {
    expect(AUCTION_ACTIVITY_WEIGHTS).toEqual({ bid: 2, listed: 3, win: 10 });
    expect(scoreAuctionActivity({ bidsCount: 4, listedCount: 1, winsCount: 1 })).toBe(21);
    expect(scoreAuctionActivity({ bidsCount: 0, listedCount: 0, winsCount: 0 })).toBe(0);
  });

  it("분양은 일단 분양글 수로 센다", () => {
    expect(LISTING_METRIC).toBe("posted");
    expect(rankingRowLabel("listings", { listingsCount: 12 }, "weekly")).toBe("분양글 12개");
    expect(rankingRowLabel("listings", { listingsCount: 3, metric: "completed" }, "weekly")).toBe("분양 완료 3건");
  });

  it("행 보조 문구", () => {
    expect(rankingRowLabel("breeders", { score: 1234 }, "all")).toBe("1,234점");
    expect(rankingRowLabel("bloodlines", { ownerCount: 34 }, "all")).toBe("보유자 34명");
    expect(rankingRowLabel("bloodlines", { ownerCount: 5, issuedCount: 7 }, "monthly")).toBe("새 보유자 5명 · 발급 7장");
    expect(rankingRowLabel("auctions", { bidsCount: 8, listedCount: 3, winsCount: 2 }, "weekly")).toBe(
      "입찰 8 · 등록 3 · 낙찰 2"
    );
  });

  it("안내·빈 상태 문구에 '상품·판매·구매'를 쓰지 않는다", () => {
    for (const type of RANKING_TYPES) {
      for (const period of RANKING_PERIODS) {
        expect(rankingNote(type.id, period.id, "볼파이썬")).not.toMatch(/상품|판매|구매/);
        expect(rankingEmptyTitle(type.id, period.id, null)).not.toMatch(/상품|판매|구매/);
      }
    }
    expect(rankingEmptyTitle("listings", "monthly", "구피")).toBe("이번 달 구피 분양 기록이 아직 없어요");
  });

  it("딥링크 값을 정리한다", () => {
    expect(parseRankingParams({}, subs, tops)).toEqual({ type: "breeders", period: "weekly", species: "", sub: "" });
    expect(parseRankingParams({ tab: "community", period: "yearly" }, subs, tops)).toMatchObject({
      type: "breeders",
      period: "weekly",
    });
    expect(
      parseRankingParams({ tab: "listings", period: "monthly", species: "파충류", sub: "볼파이썬" }, subs, tops)
    ).toEqual({ type: "listings", period: "monthly", species: "파충류", sub: "볼파이썬" });
    expect(parseRankingParams({ species: "파충류", sub: "구피" }, subs, tops).sub).toBe("");
    expect(parseRankingParams({ species: "공룡", sub: "구피" }, subs, tops)).toMatchObject({ species: "", sub: "" });
  });
});
