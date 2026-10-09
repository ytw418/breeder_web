import { pickBreederKeywords } from "@libs/shared/breederKeywords";
import type { BloodlineRankingItem, BreederRankingItem } from "@libs/shared/ranking";

const breeder = (id: number, stats: Partial<BreederRankingItem>): BreederRankingItem =>
  ({
    rank: id,
    previousRank: null,
    rankDelta: 0,
    score: 100 - id,
    scoreDelta: 0,
    postsCount: 0,
    commentsCount: 0,
    bidsCount: 0,
    auctionWinsCount: 0,
    sellerEndedAuctionsCount: 0,
    user: { id, name: `u${id}`, avatar: null },
    ...stats,
  }) as BreederRankingItem;

const bloodline = (creatorId: number): BloodlineRankingItem =>
  ({ creator: { id: creatorId, name: `u${creatorId}` } }) as BloodlineRankingItem;

describe("TOP 브리더 '○○ 부자' 키워드", () => {
  it("랭킹 최댓값 대비 비율이 가장 큰 지표를 고른다", () => {
    const [first] = pickBreederKeywords(
      [breeder(1, { commentsCount: 10, postsCount: 2 }), breeder(2, { commentsCount: 20, postsCount: 2 })],
      [],
      1
    );
    // 1위: 댓글 10/20=0.5, 게시글 2/2=1 → 게시글
    expect(first).toEqual({ label: "게시글 부자", emoji: "✍️", detail: "게시글 2개" });
  });

  it("앞 순위가 가져간 지표는 다시 쓰지 않는다", () => {
    const result = pickBreederKeywords(
      [breeder(1, { commentsCount: 9, bidsCount: 1 }), breeder(2, { commentsCount: 9, bidsCount: 1 })],
      [],
      2
    );
    expect(result.map((k) => k?.label)).toEqual(["댓글 부자", "입찰 부자"]);
  });

  it("값이 모두 0이면 키워드가 없다", () => {
    expect(pickBreederKeywords([breeder(1, {})], [], 3)).toEqual([null]);
  });

  it("혈통 수는 혈통 랭킹에서 만든 사람별로 센다", () => {
    const [first] = pickBreederKeywords(
      [breeder(1, { commentsCount: 1 }), breeder(2, { commentsCount: 5 })],
      [bloodline(1), bloodline(1), bloodline(2)],
      1
    );
    expect(first).toEqual({ label: "혈통 부자", emoji: "🧬", detail: "혈통 2개" });
  });
});
