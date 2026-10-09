import { getBreederScoreRules, pickBreederKeywords, summarizeBreederActivity } from "@libs/shared/breederKeywords";
import type { BloodlineRankingItem, BreederHighlight, BreederRankingItem } from "@libs/shared/ranking";

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

const highlight = (stats: Partial<BreederHighlight>): BreederHighlight => ({
  photos: [],
  photosCount: 0,
  likesReceivedCount: 0,
  followersCount: 0,
  ...stats,
});

const bloodline = (creatorId: number): BloodlineRankingItem =>
  ({
    creator: { id: creatorId, name: `u${creatorId}` },
  }) as BloodlineRankingItem;

describe("TOP 브리더 '○○ 부자' 키워드", () => {
  it("랭킹 최댓값 대비 비율이 가장 큰 지표를 고른다", () => {
    const [first] = pickBreederKeywords(
      [breeder(1, { commentsCount: 10, postsCount: 4 }), breeder(2, { commentsCount: 20, postsCount: 4 })],
      [],
      1,
    );
    // 1위: 댓글 10/20=0.5, 게시글 4/4=1 → 게시글
    expect(first).toEqual({
      stat: "postsCount",
      label: "게시글 부자",
      emoji: "✍️",
      detail: "게시글 4개",
    });
  });

  it("앞 순위가 가져간 지표는 다른 지표가 있으면 다시 쓰지 않는다", () => {
    const result = pickBreederKeywords(
      [breeder(1, { commentsCount: 9, bidsCount: 3 }), breeder(2, { commentsCount: 9, bidsCount: 3 })],
      [],
      2,
    );
    expect(result.map((k) => k?.label)).toEqual(["댓글 부자", "입찰 부자"]);
  });

  it("남은 지표가 없으면 앞 순위와 같은 키워드라도 붙인다", () => {
    const result = pickBreederKeywords(
      [breeder(1, { postsCount: 16 }), breeder(2, { postsCount: 14 }), breeder(3, { postsCount: 13 })],
      [],
      3,
    );
    expect(result.map((k) => k?.detail)).toEqual(["게시글 16개", "게시글 14개", "게시글 13개"]);
  });

  it("사진·받은 좋아요·팔로워(highlight)도 키워드로 고른다", () => {
    const result = pickBreederKeywords(
      [
        breeder(1, {
          postsCount: 16,
          highlight: highlight({ photosCount: 3, likesReceivedCount: 2 }),
        }),
        breeder(2, {
          postsCount: 14,
          highlight: highlight({ photosCount: 9, followersCount: 1 }),
        }),
        breeder(3, {
          postsCount: 13,
          highlight: highlight({ photosCount: 2, likesReceivedCount: 5 }),
        }),
      ],
      [],
      3,
    );
    expect(result).toEqual([
      {
        stat: "postsCount",
        label: "게시글 부자",
        emoji: "✍️",
        detail: "게시글 16개",
      },
      {
        stat: "photosCount",
        label: "사진 부자",
        emoji: "📷",
        detail: "사진 9장",
      },
      {
        stat: "likesReceivedCount",
        label: "좋아요 부자",
        emoji: "❤️",
        detail: "받은 좋아요 5개",
      },
    ]);
  });

  it("3 미만인 값은 다른 지표가 있으면 '부자'로 고르지 않는다", () => {
    const result = pickBreederKeywords(
      [
        breeder(1, {
          postsCount: 16,
          highlight: highlight({ likesReceivedCount: 15, followersCount: 1 }),
        }),
        breeder(2, {
          postsCount: 14,
          highlight: highlight({
            photosCount: 2,
            likesReceivedCount: 11,
            followersCount: 1,
          }),
        }),
        breeder(3, {
          postsCount: 13,
          highlight: highlight({ photosCount: 2, likesReceivedCount: 8 }),
        }),
      ],
      [],
      3,
    );
    // 2위: 팔로워 1/1=1 이지만 3 미만 → 좋아요 11/15. 3위: 사진 2(3 미만)뿐이라 가져간 게시글을 다시 쓴다.
    expect(result.map((k) => k?.detail)).toEqual(["게시글 16개", "받은 좋아요 11개", "게시글 13개"]);
  });

  it("3 이상인 지표가 하나도 없으면 작은 값이라도 고른다", () => {
    expect(pickBreederKeywords([breeder(1, { postsCount: 2 })], [], 1)[0]?.detail).toBe("게시글 2개");
  });

  it("값이 모두 0이면 키워드가 없다", () => {
    expect(pickBreederKeywords([breeder(1, {})], [], 3)).toEqual([null]);
  });

  it("혈통 수는 혈통 랭킹에서 만든 사람별로 센다", () => {
    const [first] = pickBreederKeywords(
      [breeder(1, { commentsCount: 1 }), breeder(2, { commentsCount: 5 })],
      [bloodline(1), bloodline(1), bloodline(2)],
      1,
    );
    expect(first).toEqual({
      stat: "bloodlines",
      label: "혈통 부자",
      emoji: "🧬",
      detail: "혈통 2개",
    });
  });
});

describe("TOP 브리더 활동 요약", () => {
  it("점수에 들어간 활동 중 0이 아닌 것만 순서대로 보여 준다", () => {
    expect(summarizeBreederActivity(breeder(1, { postsCount: 16, bidsCount: 2, auctionWinsCount: 1 }), null)).toBe(
      "게시글 16개 · 입찰 2회 · 낙찰 1건",
    );
  });

  it("키워드 근거가 점수 활동이 아니면 끝에 붙이고 세 개까지만 보여 준다", () => {
    const keyword = {
      stat: "followersCount" as const,
      label: "팔로워 부자",
      emoji: "👥",
      detail: "팔로워 3명",
    };
    expect(
      summarizeBreederActivity(
        breeder(1, {
          postsCount: 4,
          commentsCount: 2,
          bidsCount: 1,
          auctionWinsCount: 1,
        }),
        keyword,
      ),
    ).toBe("게시글 4개 · 댓글 2개 · 팔로워 3명");
  });

  it("카테고리 범위 랭킹은 게시글·상품만 보여 준다", () => {
    expect(summarizeBreederActivity(breeder(1, { postsCount: 3, productsCount: 2 }), null)).toBe(
      "게시글 3개 · 상품 2개",
    );
  });

  it("활동이 없으면 빈 문자열", () => {
    expect(summarizeBreederActivity(breeder(1, {}), null)).toBe("");
  });
});

describe("TOP 브리더 점수 기준", () => {
  it("전체 랭킹은 서버 점수식과 같은 가중치를 보여 준다", () => {
    expect(getBreederScoreRules(false).map((rule) => rule.points)).toEqual([10, 4, 6, 15, 8]);
  });

  it("관심 카테고리 범위면 가중치가 0 이 아닌 항목만 보여 준다", () => {
    expect(getBreederScoreRules(true).map((rule) => [rule.label, rule.points])).toEqual([
      ["게시글 1개", 1],
      ["상품 1개", 3],
    ]);
  });
});
