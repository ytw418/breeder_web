/** 재방문 알림 규칙(앱 docs/prd/reengagement-push.md): 하루 통수 제한·야간·문구. */
import {
  closingLeftLabel,
  debateClosingCopy,
  interestProductsCopy,
  isFreeProduct,
  isReengagementNight,
  kstDayStartOf,
  nearbyFreeCopy,
  questionHelpCopy,
  sidePercent,
  withinDailyCap,
} from "@libs/server/reengagementRules";

const kst = (iso: string) => new Date(`${iso}+09:00`);

describe("withinDailyCap", () => {
  it("오늘 합계 2통이면 빼고, 같은 종류를 이미 받았으면 1통이어도 뺀다", () => {
    const rows = [
      { userId: 1, type: "DEBATE_CLOSING" },
      { userId: 1, type: "QUESTION_HELP" },
      { userId: 2, type: "NEARBY_FREE_PRODUCT" },
      { userId: 3, type: "DEBATE_CLOSING" },
    ];
    expect(withinDailyCap([1, 2, 3, 4], rows, "NEARBY_FREE_PRODUCT")).toEqual([3, 4]);
    expect(withinDailyCap([1, 2, 3, 4], rows, "INTEREST_PRODUCTS")).toEqual([2, 3, 4]);
  });

  it("중복 id 는 한 번만 남긴다", () => {
    expect(withinDailyCap([5, 5, 6], [], "QUESTION_HELP")).toEqual([5, 6]);
  });
});

describe("야간·하루 시작", () => {
  it("KST 21시~8시 전은 야간이다", () => {
    expect(isReengagementNight(kst("2026-10-23T20:59:00"))).toBe(false);
    expect(isReengagementNight(kst("2026-10-23T21:00:00"))).toBe(true);
    expect(isReengagementNight(kst("2026-10-24T03:00:00"))).toBe(true);
    expect(isReengagementNight(kst("2026-10-24T07:59:00"))).toBe(true);
    expect(isReengagementNight(kst("2026-10-24T08:00:00"))).toBe(false);
  });

  it("KST 0시를 하루 시작으로 센다", () => {
    expect(kstDayStartOf(kst("2026-10-24T00:30:00")).toISOString()).toBe("2026-10-23T15:00:00.000Z");
    expect(kstDayStartOf(kst("2026-10-23T23:59:00")).toISOString()).toBe("2026-10-22T15:00:00.000Z");
  });
});

it("무료 분양은 거래 유형 adoption 이거나 0원", () => {
  expect(isFreeProduct({ dealType: "adoption", price: 30000 })).toBe(true);
  expect(isFreeProduct({ dealType: "sale", price: 0 })).toBe(true);
  expect(isFreeProduct({ dealType: "sale", price: 1000 })).toBe(false);
  expect(isFreeProduct({ dealType: "sale", price: null })).toBe(false);
});

describe("문구", () => {
  it("동네 무료 분양: 시/군/구 + 종 + 제목, '무료나눔'이라 쓰지 않는다", () => {
    const copy = nearbyFreeCopy({ sigungu: "강남구", species: "레오파드 게코", title: "베이비 2마리" });
    expect(copy.title).toBe("강남구에 레오파드 게코 무료 분양이 올라왔어요");
    expect(copy.body).toBe("베이비 2마리 · 바로 확인해 보세요");
    expect(copy.message).toBe("강남구에 레오파드 게코 무료 분양이 올라왔어요: 베이비 2마리");
    expect(JSON.stringify(copy)).not.toMatch(/무료나눔|상품|판매/);
    expect(nearbyFreeCopy({ sigungu: "공주시", species: null, title: "x" }).title).toBe("공주시에 무료 분양이 올라왔어요");
  });

  it("토론 마감: 남은 시간·지금 비율", () => {
    const now = kst("2026-10-23T19:00:00");
    const copy = debateClosingCopy({
      question: "합사 해도 될까요?",
      optionA: "된다",
      optionB: "안 된다",
      aVotes: 13,
      bVotes: 12,
      endsAt: new Date(now.getTime() + 62 * 60_000),
      now,
    });
    expect(copy.title).toBe("실시간 HOT 토론이 1시간 뒤 마감돼요!");
    expect(copy.body).toBe("합사 해도 될까요? · 지금 된다 52% : 안 된다 48%");
    expect(closingLeftLabel(new Date(now.getTime() + 33 * 60_000), now)).toBe("40분");
    expect(closingLeftLabel(new Date(now.getTime() + 3 * 60_000), now)).toBe("10분");
    expect(sidePercent(0, 0)).toEqual([50, 50]);
  });

  it("관심 분야 묶음·답 없는 질문", () => {
    expect(interestProductsCopy({ scopeLabel: "크레스티드 게코", titles: ["a", "b", "c", "d"], count: 4 })).toEqual({
      message: "오늘 크레스티드 게코 새 분양 4건이 올라왔어요",
      title: "오늘 크레스티드 게코 새 분양 4건이 올라왔어요",
      body: "a / b / c",
    });
    expect(questionHelpCopy({ species: "볼파이썬", title: "탈피가 안 돼요" })).toEqual({
      message: "볼파이썬 질문에 아직 답이 없어요: 탈피가 안 돼요",
      title: "볼파이썬 질문에 아직 답이 없어요",
      body: "탈피가 안 돼요 · 키워 본 경험을 나눠 주세요",
    });
  });
});
