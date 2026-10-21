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
  productsCount: 0,
  ...stats,
});

const bloodline = (creatorId: number): BloodlineRankingItem =>
  ({ creator: { id: creatorId, name: `u${creatorId}` } }) as BloodlineRankingItem;

const labels = (result: ReturnType<typeof pickBreederKeywords>) => result.map((k) => k?.label ?? null);

describe("TOP 브리더 칭호(활동은 ○○왕, 쌓인 것은 ○○ 부자)", () => {
  it("랭킹 최댓값 대비 비율이 가장 큰 활동 묶음을 고른다", () => {
    const [first] = pickBreederKeywords(
      [breeder(1, { commentsCount: 10, postsCount: 4 }), breeder(2, { commentsCount: 20, postsCount: 4 })],
      [],
      1,
    );
    // 1위: 댓글 10/20=0.5, 게시글 4/4=1 → 기록왕
    expect(first).toEqual({ key: "post", label: "기록왕", detail: "게시글 4개", parts: ["게시글 4개"] });
  });

  it("경매왕은 낙찰·경매 성사·입찰을 합쳐 비교하고 근거를 모두 보여 준다", () => {
    const [first] = pickBreederKeywords(
      [
        breeder(1, { postsCount: 2, bidsCount: 1, auctionWinsCount: 1 }),
        breeder(2, { postsCount: 1, commentsCount: 2 }),
        breeder(3, { commentsCount: 1, sellerEndedAuctionsCount: 1 }),
      ],
      [],
      1,
    );
    // 경매 2/2=1, 기록 2/2=1 동점 → 경매가 먼저
    expect(first).toEqual({
      key: "auction",
      label: "경매왕",
      detail: "낙찰 1건 · 입찰 1회",
      parts: ["낙찰 1건", "입찰 1회"],
    });
  });

  it("앞 순위가 가져간 칭호는 다른 칭호가 있으면 다시 쓰지 않는다", () => {
    const result = pickBreederKeywords(
      [breeder(1, { commentsCount: 9, bidsCount: 3 }), breeder(2, { commentsCount: 9, bidsCount: 3 })],
      [],
      2,
    );
    expect(labels(result)).toEqual(["경매왕", "소통왕"]);
  });

  it("남은 칭호가 없으면 앞 순위와 같은 칭호라도 붙인다", () => {
    const result = pickBreederKeywords(
      [breeder(1, { postsCount: 16 }), breeder(2, { postsCount: 14 }), breeder(3, { postsCount: 13 })],
      [],
      3,
    );
    expect(result.map((k) => k?.detail)).toEqual(["게시글 16개", "게시글 14개", "게시글 13개"]);
    expect(labels(result)).toEqual(["기록왕", "기록왕", "기록왕"]);
  });

  it("분양·사진·받은 좋아요·팔로워(highlight)도 칭호로 고른다", () => {
    const result = pickBreederKeywords(
      [
        breeder(1, { postsCount: 16, highlight: highlight({ productsCount: 7, likesReceivedCount: 2 }) }),
        breeder(2, { postsCount: 14, highlight: highlight({ photosCount: 9, followersCount: 4 }) }),
        breeder(3, { postsCount: 13, highlight: highlight({ photosCount: 2, likesReceivedCount: 5 }) }),
      ],
      [],
      3,
    );
    expect(labels(result)).toEqual(["분양왕", "팔로워 부자", "좋아요 부자"]);
    expect(result.map((k) => k?.detail)).toEqual(["분양글 7개", "팔로워 4명", "받은 좋아요 5개"]);
  });

  it("사진이 가장 두드러지면 '사진 맛집'", () => {
    const [first] = pickBreederKeywords(
      [
        breeder(1, { postsCount: 5, highlight: highlight({ photosCount: 24 }) }),
        breeder(2, { postsCount: 10, highlight: highlight({ photosCount: 6 }) }),
      ],
      [],
      1
    );
    expect(first).toEqual({
      key: "photo",
      label: "사진 맛집",
      detail: "사진 24장",
      parts: ["사진 24장"],
    });
  });

  it("3 미만인 값은 다른 칭호가 있으면 고르지 않는다", () => {
    const result = pickBreederKeywords(
      [
        breeder(1, { postsCount: 16, highlight: highlight({ likesReceivedCount: 15, followersCount: 1 }) }),
        breeder(2, {
          postsCount: 14,
          highlight: highlight({ photosCount: 2, likesReceivedCount: 11, followersCount: 1 }),
        }),
        breeder(3, { postsCount: 13, highlight: highlight({ photosCount: 2, likesReceivedCount: 8 }) }),
      ],
      [],
      3,
    );
    // 1위: 좋아요 15/15=1 · 기록 16/16=1 동점 → 좋아요가 먼저. 2위: 팔로워 1(3 미만) → 기록 14/16.
    // 3위: 사진 2(3 미만)뿐이라 가져간 기록을 다시 쓴다.
    expect(labels(result)).toEqual(["좋아요 부자", "기록왕", "기록왕"]);
  });

  it("3 이상인 값이 하나도 없으면 작은 값이라도 고른다", () => {
    expect(pickBreederKeywords([breeder(1, { postsCount: 2 })], [], 1)[0]?.detail).toBe("게시글 2개");
  });

  it("값이 모두 0이면 칭호가 없다", () => {
    expect(pickBreederKeywords([breeder(1, {})], [], 3)).toEqual([null]);
  });

  it("혈통 수는 혈통 랭킹에서 만든 사람별로 센다", () => {
    const [first] = pickBreederKeywords(
      [breeder(1, { commentsCount: 1 }), breeder(2, { commentsCount: 5 })],
      [bloodline(1), bloodline(1), bloodline(2)],
      1,
    );
    expect(first?.label).toBe("혈통 부자");
    expect(first?.detail).toBe("혈통 2개");
  });
});

describe("TOP 브리더 활동 요약", () => {
  it("점수에 들어간 활동 중 0이 아닌 것만 순서대로 보여 준다", () => {
    expect(summarizeBreederActivity(breeder(1, { postsCount: 16, bidsCount: 2, auctionWinsCount: 1 }), null)).toBe(
      "게시글 16개 · 입찰 2회 · 낙찰 1건",
    );
  });

  it("칭호 근거가 요약에 없으면 끝에 붙이고 세 개까지만 보여 준다", () => {
    const [keyword] = pickBreederKeywords(
      [breeder(1, { postsCount: 4, commentsCount: 2, bidsCount: 1, highlight: highlight({ followersCount: 30 }) })],
      [],
      1,
    );
    expect(keyword?.label).toBe("팔로워 부자");
    expect(summarizeBreederActivity(breeder(1, { postsCount: 4, commentsCount: 2, bidsCount: 1 }), keyword)).toBe(
      "게시글 4개 · 댓글 2개 · 팔로워 30명",
    );
  });

  it("경매왕 근거가 이미 요약에 있으면 다시 붙이지 않는다", () => {
    const item = breeder(1, { postsCount: 2, bidsCount: 1, auctionWinsCount: 1 });
    const [keyword] = pickBreederKeywords([item], [], 1);
    expect(summarizeBreederActivity(item, keyword)).toBe("게시글 2개 · 입찰 1회 · 낙찰 1건");
  });

  it("카테고리 범위 랭킹은 게시글·분양글만 보여 준다", () => {
    expect(summarizeBreederActivity(breeder(1, { postsCount: 3, productsCount: 2 }), null)).toBe(
      "게시글 3개 · 분양글 2개",
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
      ["분양글 1개", 3],
    ]);
  });
});

import {
  TITLE_THRESHOLDS,
  lockedTitleLabel,
  pickLockedTitles,
  pickRepresentativeTitleKeys,
  titleConditionText,
  titleLabelOf,
  unlockedTitleKeys,
  type LockedTitleStats,
} from "@libs/shared/breederKeywords";

describe("칭호 잠금(AC-4)", () => {
  const zero: LockedTitleStats = {
    postsCount: 0,
    productsCount: 0,
    commentsCount: 0,
    bidsCount: 0,
    auctionsCount: 0,
    bloodlinesCount: 0,
    followersCount: 0,
    likesReceivedCount: 0,
    photosCount: 0,
  };

  it("임계값은 PRD §8 표와 같다", () => {
    expect(Object.fromEntries(Object.entries(TITLE_THRESHOLDS).map(([k, v]) => [k, v.count]))).toEqual({
      auction: 3,
      listing: 3,
      bloodline: 3,
      talk: 5,
      follower: 10,
      like: 10,
      photo: 5,
      post: 3,
    });
  });

  it("남은 양이 적은 순 3개(같으면 칭호 순서)", () => {
    const locked = pickLockedTitles({ ...zero, commentsCount: 3, postsCount: 2, followersCount: 9, photosCount: 1 });
    expect(locked).toEqual([
      { key: "follower", label: "팔로워 부자", remaining: { kind: "follower", count: 1 } },
      { key: "post", label: "기록왕", remaining: { kind: "post", count: 1 } },
      { key: "talk", label: "소통왕", remaining: { kind: "comment", count: 2 } },
    ]);
    expect(lockedTitleLabel(locked[2])).toBe("소통왕까지 댓글 2");
  });

  it("단 칭호는 잠금에 없고, 경매왕은 입찰 + 연 경매", () => {
    const stats = { ...zero, bidsCount: 2, auctionsCount: 1, postsCount: 5 };
    expect(unlockedTitleKeys(stats)).toEqual(["auction", "post"]);
    expect(pickLockedTitles(stats, 10).map((t) => t.key)).not.toEqual(expect.arrayContaining(["auction"]));
    expect(pickLockedTitles(stats, 10)).toHaveLength(6);
  });

  it("대표 칭호는 단 칭호 중 전체 최댓값 대비 비율이 큰 것, 이름·조건 문구(감사 #29)", () => {
    const keys = pickRepresentativeTitleKeys([
      { ...zero, commentsCount: 6, postsCount: 9 }, // 댓글 6/6 = 1 > 글 9/18 → 소통왕
      { ...zero, commentsCount: 5, postsCount: 18 }, // 글 18/18 = 1 > 댓글 5/6 → 기록왕
      { ...zero, commentsCount: 2 }, // 단 칭호 없음
    ]);
    expect(keys).toEqual(["talk", "post", null]);
    expect(titleLabelOf("talk")).toBe("소통왕");
    expect(titleLabelOf("gone")).toBeNull();
    expect(titleConditionText("talk")).toBe("댓글 5개 이상이면 달려요");
  });

  it("다 달았으면 빈 목록", () => {
    const all = { ...zero, postsCount: 9, productsCount: 9, commentsCount: 9, bidsCount: 9, bloodlinesCount: 9, followersCount: 99, likesReceivedCount: 99, photosCount: 9 };
    expect(pickLockedTitles(all)).toEqual([]);
  });
});
