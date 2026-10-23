import {
  buildDebateSummary,
  debateMetaParts,
  debatePercents,
  debateState,
  evergreenMetaLabel,
  evergreenSinceLabel,
  mySideResultLine,
  orderEvergreenFields,
  resultCardLead,
  resultCardPeriod,
  remainingLabel,
  resultHeadline,
  switchConfirmMessage,
  switchLine,
  validateDebateInput,
} from "@libs/shared/debateFormat";

const NOW = Date.parse("2026-10-15T03:00:00Z");
const base = {
  optionA: "냉동",
  optionB: "생먹이",
  countA: 0,
  countB: 0,
  mySide: null,
  switchCount: 0,
  lastActivityAt: null,
  isAuthor: false,
  firstOtherVoteAt: null,
} as const;

describe("debateState", () => {
  it("endsAt 정각부터 끝, 3표부터 decided, 미만은 undecided", () => {
    const endsAt = new Date(NOW);
    expect(debateState(endsAt, 10, NOW - 1)).toBe("open");
    expect(debateState(endsAt, 3, NOW)).toBe("decided");
    expect(debateState(endsAt, 2, NOW)).toBe("undecided");
  });
});

describe("debatePercents", () => {
  it("A 는 반올림, B 는 100 − A, 합은 늘 100", () => {
    expect(debatePercents(2, 1)).toEqual({ a: 67, b: 33 });
    expect(debatePercents(1, 2)).toEqual({ a: 33, b: 67 });
    expect(debatePercents(0, 0)).toEqual({ a: 0, b: 0 });
  });
});

describe("buildDebateSummary", () => {
  const open = new Date(NOW + 3600_000);
  it("진행 중이면 내가 골랐고 3표 이상일 때만 % 를 싣는다", () => {
    expect(buildDebateSummary({ ...base, endsAt: open, countA: 2, countB: 1 }, NOW).result).toBeNull();
    expect(buildDebateSummary({ ...base, endsAt: open, countA: 1, countB: 1, mySide: "A" }, NOW).result).toBeNull();
    expect(buildDebateSummary({ ...base, endsAt: open, countA: 2, countB: 1, mySide: "A" }, NOW).result).toEqual({ a: 67, b: 33 });
  });
  it("끝나고 3표 이상이면 늘 % · 이긴 쪽, 동률은 tie, 3표 미만은 결론 없음", () => {
    const ended = new Date(NOW - 1);
    expect(buildDebateSummary({ ...base, endsAt: ended, countA: 5, countB: 2 }, NOW)).toMatchObject({
      state: "decided",
      winner: "A",
      result: { a: 71, b: 29 },
    });
    expect(buildDebateSummary({ ...base, endsAt: ended, countA: 2, countB: 2 }, NOW).winner).toBe("tie");
    expect(buildDebateSummary({ ...base, endsAt: ended, countA: 1, countB: 1 }, NOW)).toMatchObject({
      state: "undecided",
      result: null,
      winner: null,
    });
  });
  it("작성자이고 남의 첫 투표 전·진행 중일 때만 수정 가능", () => {
    expect(buildDebateSummary({ ...base, endsAt: open, isAuthor: true }, NOW).editable).toBe(true);
    expect(buildDebateSummary({ ...base, endsAt: open, isAuthor: true, firstOtherVoteAt: new Date(NOW) }, NOW).editable).toBe(false);
  });
});

describe("문구", () => {
  it("남은 시간·끝난 날짜(KST)", () => {
    expect(remainingLabel(new Date(NOW + 2 * 86_400_000 + 5000), NOW)).toBe("2일 남음");
    // 3일 토론을 연 직후(71시간 59분)는 3일 남음
    expect(remainingLabel(new Date(NOW + 72 * 3600_000 - 60_000), NOW)).toBe("3일 남음");
    expect(remainingLabel(new Date(NOW + 18 * 3600_000 + 5000), NOW)).toBe("18시간 남음");
    expect(remainingLabel(new Date(NOW + 42 * 60_000), NOW)).toBe("곧 끝나요 · 42분");
    expect(remainingLabel("2026-10-12T05:00:00Z", NOW)).toBe("끝난 토론 · 10월 12일");
  });
  it("조사: 받침이면 '이'·'으로', 아니면 '가'·'로', ㄹ 받침은 '로'", () => {
    const ended = new Date(NOW - 1);
    expect(resultHeadline(buildDebateSummary({ ...base, endsAt: ended, countA: 5, countB: 2 }, NOW))).toBe("'냉동'이 이겼어요");
    expect(resultHeadline(buildDebateSummary({ ...base, optionB: "반대", endsAt: ended, countA: 1, countB: 4 }, NOW))).toBe(
      "'반대'가 이겼어요"
    );
    expect(switchLine("젠크레", "무조건 단독")).toBe("젠크레님이 '무조건 단독'으로 마음을 바꿨어요");
    expect(switchConfirmMessage("반대")).toBe("'반대'로 바꿀까요? 이미 쓴 댓글의 쪽 표시는 그대로예요");
    expect(switchConfirmMessage("참나무 굴")).toBe("'참나무 굴'로 바꿀까요? 이미 쓴 댓글의 쪽 표시는 그대로예요");
  });
  it("카드 메타: 진행 중·끝남·결론 없음", () => {
    const open = buildDebateSummary(
      { ...base, endsAt: new Date(NOW + 2 * 86_400_000 + 5000), countA: 9, countB: 5, lastActivityAt: new Date(NOW - 120_000) },
      NOW
    );
    expect(debateMetaParts(open, NOW)).toEqual({ activity: "2분 전", activityWord: "댓글", rest: "14명 참여 · 2일 남음" });
    expect(debateMetaParts({ ...open, lastActivityKind: "vote" }, NOW).activityWord).toBe("투표");
    expect(debateMetaParts({ ...open, lastActivityAt: null, lastActivityKind: null }, NOW)).toMatchObject({ activity: "", activityWord: "" });
    const decided = buildDebateSummary({ ...base, endsAt: new Date(NOW - 1), countA: 27, countB: 11 }, NOW);
    expect(debateMetaParts(decided, NOW).rest).toBe("끝남 · '냉동' 71% · 38명 참여");
    const undecided = buildDebateSummary({ ...base, endsAt: new Date(NOW - 1), countA: 2 }, NOW);
    expect(debateMetaParts(undecided, NOW).rest).toBe("끝남 · 2명 참여 · 결론 없음");
    expect(mySideResultLine({ ...decided, mySide: "B" })).toBe("내 선택은 생먹이 — 소수 의견이었어요");
  });
});

describe("validateDebateInput", () => {
  const ok = { title: "레게 합사 괜찮을까요", optionA: "찬성", optionB: "반대", durationHours: 72 };
  it("질문 5자·선택지 빈칸·같은 선택지·기간을 막는다", () => {
    expect(validateDebateInput(ok).ok).toBe(true);
    expect(validateDebateInput({ ...ok, title: "합사?" })).toMatchObject({ errorCode: "DEBATE_QUESTION_LENGTH" });
    expect(validateDebateInput({ ...ok, optionB: " " })).toMatchObject({ errorCode: "DEBATE_OPTION_LENGTH" });
    expect(validateDebateInput({ ...ok, optionB: " 찬성 " })).toMatchObject({ errorCode: "DEBATE_OPTION_SAME" });
    expect(validateDebateInput({ ...ok, durationHours: 48 })).toMatchObject({ errorCode: "DEBATE_DURATION" });
  });
});

describe("상시 토론(앱 docs/prd/evergreen-debate.md)", () => {
  it("마감이 없으면 늘 진행 중이고, 안 골라도 3표부터 결과가 보인다", () => {
    expect(debateState(null, 100, NOW)).toBe("open");
    const few = buildDebateSummary({ ...base, endsAt: null, evergreenField: "aquarium", countA: 1, countB: 1 }, NOW);
    expect(few.result).toBeNull();
    const summary = buildDebateSummary(
      { ...base, endsAt: null, evergreenField: "aquarium", firstVoteAt: "2026-10-01T00:00:00Z", countA: 87, countB: 13 },
      NOW
    );
    expect(summary).toMatchObject({
      state: "open",
      endsAt: null,
      evergreen: { field: "aquarium", since: "2026-10-01T00:00:00.000Z" },
      result: { a: 87, b: 13 },
      winner: null,
    });
    expect(remainingLabel(null, NOW)).toBe("상시 토론");
    expect(debateMetaParts(summary, NOW).rest).toBe("100명 참여 · 상시 토론");
  });

  it("회원 토론은 evergreen 이 null", () => {
    expect(buildDebateSummary({ ...base, endsAt: new Date(NOW + 3600_000) }, NOW).evergreen).toBeNull();
  });

  it("분야 칩: 내 관심 분야 먼저, 공통은 맨 끝, 포유류만이면 포유류·공통만", () => {
    const all = ["all", "reptile", "aquarium", "hamster"];
    expect(orderEvergreenFields(all).map((f) => f.key)).toEqual(["reptile", "aquarium", "hamster", "all"]);
    expect(orderEvergreenFields(all, [{ path: "/fish/guppy/" }]).map((f) => f.key)).toEqual([
      "aquarium",
      "reptile",
      "hamster",
      "all",
    ]);
    expect(orderEvergreenFields(all, [{ path: "/mammal/" }]).map((f) => f.label)).toEqual([
      "햄스터",
      "공통",
    ]);
  });

  it("기간·메타·결과 카드 문구", () => {
    expect(evergreenSinceLabel("2026-09-30T16:00:00Z")).toBe("2026년 10월부터");
    expect(evergreenSinceLabel(null)).toBe("");
    expect(resultCardPeriod("2026-10-01T00:00:00Z", Date.parse("2027-10-02T00:00:00Z"))).toBe("2026.10~2027.10");
    expect(resultCardPeriod("2026-10-01T00:00:00Z", NOW)).toBe("2026.10");
    expect(
      evergreenMetaLabel({ evergreen: { field: "all", since: "2026-10-01T00:00:00Z" }, participants: 1204, switchCount: 31 })
    ).toBe("2026년 10월부터 1,204명 참여 · 마음 바꾼 사람 31명");
    expect(resultCardLead({ optionA: "가능하다", optionB: "불가능하다" }, 87, 13)).toMatchObject({
      tie: false,
      label: "가능하다",
      percent: 87,
    });
    expect(resultCardLead({ optionA: "a", optionB: "b" }, 10, 30)).toMatchObject({ label: "b", percent: 75 });
    expect(resultCardLead({ optionA: "a", optionB: "b" }, 20, 20).tie).toBe(true);
  });
});
