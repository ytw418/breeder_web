import {
  celebrateFact,
  celebrateFallback,
  celebrateTitle,
  chatEmptyCopy,
  freeGiveawayEmptyCopy,
  heroRankReason,
  myRankLine,
  nearLabel,
  neighborhoodEmptyCopy,
  rankProgress,
  rankingActionLabel,
  withRo,
  type CelebrateFactInput,
} from "@libs/shared/communityCopy";
import type { RankingMe } from "@libs/shared/communityVibe";

const join = (line: { prefix: string; emphasis: string; suffix: string }) => line.prefix + line.emphasis + line.suffix;

describe("빈 상태 문구(AC-1)", () => {
  it("동네 0명: 방문자 있음/없음", () => {
    expect(neighborhoodEmptyCopy("서울", 12)).toEqual({
      title: "서울 근처 첫 브리더가 되어 보세요",
      body: "이번 주 서울 근처에서 12명이 둘러봤어요",
      action: "인사 남기기",
    });
    expect(neighborhoodEmptyCopy("보은군 근처", 0)).toEqual({
      title: "보은군 근처 첫 브리더가 되어 보세요",
      body: "인사 글은 근처 브리더 홈에 바로 보여요",
      action: "인사 남기기",
    });
  });

  it("채팅 0", () => {
    expect(chatEmptyCopy(4).title).toBe("이 종 키우는 사람 4명이 근처에 있어요");
    expect(chatEmptyCopy(0).title).toBe("분양글에서 인사를 보내 보세요");
    expect(chatEmptyCopy(0).action).toBe("분양글 둘러보기");
  });

  it("무료나눔 0", () => {
    expect(freeGiveawayEmptyCopy()).toEqual({
      title: "첫 나눔은 홈 맨 위에 하루 동안 보여요",
      body: null,
      action: "첫 번째로 나누기",
    });
  });

  it("어떤 빈 상태도 '없어요'로 끝나지 않고 행동 버튼이 있다", () => {
    const all = [neighborhoodEmptyCopy("서울", 0), neighborhoodEmptyCopy("서울", 3), chatEmptyCopy(0), chatEmptyCopy(2), freeGiveawayEmptyCopy()];
    for (const copy of all) {
      expect(copy.title).not.toMatch(/없어요$/);
      expect(copy.body ?? "").not.toMatch(/없어요$/);
      expect(copy.action.length).toBeGreaterThan(0);
    }
  });

  it("nearLabel 은 '근처'를 두 번 붙이지 않는다", () => {
    expect(nearLabel("수원시")).toBe("수원시 근처");
    expect(nearLabel("보은군 근처")).toBe("보은군 근처");
  });
});

describe("작은 숫자 맥락", () => {
  it("조사 로/으로", () => {
    expect(withRo("분양글 1개")).toBe("분양글 1개로");
    expect(withRo("낙찰 1건")).toBe("낙찰 1건으로");
    expect(withRo("사진 3장")).toBe("사진 3장으로");
    expect(withRo("팔로워 7")).toBe("팔로워 7로");
    expect(withRo("입찰 2")).toBe("입찰 2로");
  });

  it("hero 근거", () => {
    expect(heroRankReason("분양글 1개")).toBe("분양글 1개로 이번 주 1위");
    expect(heroRankReason("게시글 3개", 1, "all")).toBe("게시글 3개로 전체 1위");
  });
});

describe("내 순위 줄(F-2)", () => {
  const base: RankingMe = { rank: 7, score: 26, delta: null, nextRank: 3, nextScore: 46, nextAction: { kind: "post", count: 2 }, gapToSecond: null };

  it("3위 밖", () => {
    expect(join(myRankLine(base))).toBe("나는 지금 7위 · 3위까지 글 2개");
    expect(myRankLine(base).emphasis).toBe("7위");
  });

  it("1위", () => {
    expect(join(myRankLine({ ...base, rank: 1, nextRank: null, nextScore: null, nextAction: null, gapToSecond: 12 }))).toBe(
      "이번 주 1위예요 · 2위와 12점 차이"
    );
  });

  it("순위 밖(점수 0)", () => {
    expect(join(myRankLine({ ...base, rank: null, score: 0, nextAction: { kind: "comment", count: 3 } }))).toBe(
      "나는 아직 순위 밖 · 3위까지 댓글 3개"
    );
  });

  it("활동 이름", () => {
    expect(rankingActionLabel({ kind: "bid", count: 2 })).toBe("입찰 2번");
  });

  it("진행 바", () => {
    expect(rankProgress({ score: 23, nextScore: 46 })).toBe(0.5);
    expect(rankProgress({ score: 50, nextScore: 46 })).toBe(1);
    expect(rankProgress({ score: 10, nextScore: null })).toBe(1);
  });
});

describe("등록 보상(F-4, AC-5)", () => {
  const input: CelebrateFactInput = {
    target: "post",
    regionLabel: "서울",
    regionFirst: true,
    todayFirst: true,
    species: "크레스티드 게코",
    weekSpeciesFirst: true,
    pinnedCount: 5,
  };

  it("우선순위: 범위 첫 글 > 오늘 첫 글 > 이번 주 종 첫 글 > 관심 고정", () => {
    expect(celebrateFact(input)).toBe("서울 첫 글");
    expect(celebrateFact({ ...input, regionFirst: false })).toBe("오늘 첫 글");
    expect(celebrateFact({ ...input, regionFirst: false, todayFirst: false })).toBe("이번 주 크레스티드 게코 첫 글");
    expect(celebrateFact({ ...input, regionFirst: false, todayFirst: false, weekSpeciesFirst: false })).toBe(
      "5명이 관심 분야로 고정한 글이에요"
    );
    expect(
      celebrateFact({ ...input, regionFirst: false, todayFirst: false, weekSpeciesFirst: false, pinnedCount: 0 })
    ).toBeNull();
  });

  it("동네 라벨이 없으면 범위 첫 글은 건너뛴다", () => {
    expect(celebrateFact({ ...input, regionLabel: null })).toBe("오늘 첫 글");
  });

  it("종류별 이름", () => {
    expect(celebrateFact({ ...input, target: "product", regionLabel: "보은군 근처" })).toBe("보은군 근처 첫 분양글");
    expect(celebrateFact({ ...input, target: "auction", regionFirst: false, todayFirst: false, weekSpeciesFirst: false })).toBe(
      "5명이 관심 분야로 고정한 경매예요"
    );
    expect(celebrateTitle("post", 234)).toBe("반려생활 234번째 글");
    expect(celebrateTitle("product", 12)).toBe("12번째 분양글");
  });

  it("fact 가 없을 때 둘째 줄", () => {
    expect(celebrateFallback("product")).toBe("홈 '지금 올라온 분양'에 바로 보여요");
    expect(celebrateFallback("post", { isQuestion: true, pinnedCount: 3 })).toBe("관심 고정자 3명에게 알림이 갔어요");
  });
});
