import {
  buildDebateSummary,
  debateMetaParts,
  debatePercents,
  debateState,
  mySideResultLine,
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
    expect(debateMetaParts(open, NOW)).toEqual({ activity: "2분 전", rest: "14명 참여 · 2일 남음" });
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
