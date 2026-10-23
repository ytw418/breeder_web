/**
 * 찬반 토론 규칙·문구(앱 docs/prd/live-talk.md §3.1·§3.8).
 * 앱 src/lib/debateFormat.ts 와 같은 파일 사본이다. 바꾸면 두 곳을 같이 고치고
 * 웹 jest(__tests__/debateFormat.test.ts)·앱 `npm run test:debate-format` 을 돌린다.
 */

export type DebateSide = "A" | "B";
export type DebateState = "open" | "decided" | "undecided";

/** 이 수 이상 표가 모여야 % 를 보인다(진행 중). 끝났는데 이보다 적으면 '결론 없음'. */
export const DEBATE_RESULT_MIN_VOTES = 3;
export const DEBATE_QUESTION_MIN = 5;
export const DEBATE_QUESTION_MAX = 40;
export const DEBATE_OPTION_MAX = 12;
export const DEBATE_DESCRIPTION_MAX = 1000;
/** 기간 칩 순서(3일 기본, 2026-10-14 기획 재검토). */
export const DEBATE_DURATIONS_HOURS = [72, 168, 24] as const;
export type DebateDurationHours = (typeof DEBATE_DURATIONS_HOURS)[number];
export const DEBATE_DEFAULT_DURATION: DebateDurationHours = 72;
export const DEBATE_DEFAULT_OPTIONS = { A: "찬성", B: "반대" } as const;
export const DEBATE_DAILY_LIMIT = 3;
/** 가입하고 이 시간이 지나야 토론을 열 수 있다. */
export const DEBATE_MIN_ACCOUNT_AGE_HOURS = 24;
/** 작성자에게 참여 알림을 보내는 참여 수. */
export const DEBATE_MILESTONES = [5, 20, 50] as const;
export const DEBATE_CATEGORY = "토론";
/** 토론 글 신고 이 건수면 운영자 확인 전까지 자동 가림(일반 글·댓글은 기존 규칙). */
export const DEBATE_REPORT_HIDE_COUNT = 2;

/** 토론 글에 붙는 요약(글 목록·상세·홈 카드 응답의 debate). */
export interface DebateSummary {
  optionA: string;
  optionB: string;
  /** 상시 토론이면 null(마감 없음). */
  endsAt: string | null;
  /** 상시 토론(운영자가 분야별로 고정, 앱 docs/prd/evergreen-debate.md)이면 분야·첫 투표 시각. 아니면 null. */
  evergreen: { field: string; since: string | null } | null;
  state: DebateState;
  participants: number;
  /** open: 내가 골랐고 3표 이상일 때만(상시 토론은 안 골라도 3표 이상이면). decided: 늘. undecided: null. 합은 100. */
  result: { a: number; b: number } | null;
  /** decided 일 때만. 50:50 이면 tie. */
  winner: DebateSide | "tie" | null;
  mySide: DebateSide | null;
  switchCount: number;
  /** 마지막 댓글·투표 시각(만든 시각은 넣지 않는다 — 아무도 안 움직인 토론은 null). */
  lastActivityAt: string | null;
  /** lastActivityAt 이 댓글인지 투표(선택 바꾸기 포함)인지. 카드 메타 "2분 전 댓글"·"2분 전 투표". */
  lastActivityKind: "comment" | "vote" | null;
  /** 작성자 본인이고 다른 사람이 아직 투표하지 않았으면 질문·선택지를 고칠 수 있다. */
  editable: boolean;
}

export interface DebateSummaryInput {
  optionA: string;
  optionB: string;
  endsAt: Date | string | null;
  /** 상시 토론 분야 키(EVERGREEN_FIELDS). 회원 토론은 null. */
  evergreenField?: string | null;
  /** 첫 투표 시각(상시 토론의 '○년 ○월부터'). */
  firstVoteAt?: Date | string | null;
  countA: number;
  countB: number;
  mySide: DebateSide | null;
  switchCount: number;
  lastActivityAt: Date | string | null;
  lastActivityKind?: "comment" | "vote" | null;
  isAuthor: boolean;
  firstOtherVoteAt: Date | string | null;
}

const toTime = (value: Date | string) => new Date(value).getTime();

/** 마지막 글자에 받침이 있는지(한글이 아니면 받침 없음으로 본다). */
function hasBatchim(word: string): boolean {
  const code = word.trim().charCodeAt(word.trim().length - 1);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}
/** 받침이 ㄹ 인지('으로' 대신 '로'). */
function hasRieulBatchim(word: string): boolean {
  const code = word.trim().charCodeAt(word.trim().length - 1);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 === 8;
}
/** "'냉동'이" · "'반대'가" */
export const withSubjectJosa = (word: string) => `'${word}'${hasBatchim(word) ? "이" : "가"}`;
/** "'냉동'으로" · "'반대'로" · "'고양이 털'로" */
export const withDirectionJosa = (word: string) =>
  `'${word}'${hasBatchim(word) && !hasRieulBatchim(word) ? "으로" : "로"}`;
const toIso = (value: Date | string | null) => (value == null ? null : new Date(value).toISOString());

/** 끝났는지(서버 시각 기준)와 표 수로 상태를 정한다. 마감이 없으면(상시 토론) 늘 진행 중이다. */
export function debateState(endsAt: Date | string | null, participants: number, now = Date.now()): DebateState {
  if (endsAt == null || now < toTime(endsAt)) return "open";
  return participants >= DEBATE_RESULT_MIN_VOTES ? "decided" : "undecided";
}

/** A = 반올림, B = 100 − A. 0표면 0:0. */
export function debatePercents(countA: number, countB: number): { a: number; b: number } {
  const total = countA + countB;
  if (total <= 0) return { a: 0, b: 0 };
  const a = Math.round((countA / total) * 100);
  return { a, b: 100 - a };
}

export function buildDebateSummary(input: DebateSummaryInput, now = Date.now()): DebateSummary {
  const participants = input.countA + input.countB;
  const state = debateState(input.endsAt, participants, now);
  const percents = debatePercents(input.countA, input.countB);
  const evergreen = input.endsAt == null;
  // 상시 토론은 결과가 늘 보인다(사용자 2026-10-22 "결과가 계속 보이면"). 3표 미만이면 막대 대신 안내.
  const showResult =
    state === "decided" ||
    (state === "open" && (input.mySide !== null || evergreen) && participants >= DEBATE_RESULT_MIN_VOTES);
  const winner: DebateSummary["winner"] =
    state === "decided"
      ? input.countA === input.countB
        ? "tie"
        : input.countA > input.countB
          ? "A"
          : "B"
      : null;
  return {
    optionA: input.optionA,
    optionB: input.optionB,
    endsAt: input.endsAt == null ? null : new Date(input.endsAt).toISOString(),
    evergreen: evergreen ? { field: input.evergreenField ?? EVERGREEN_ALL, since: toIso(input.firstVoteAt ?? null) } : null,
    state,
    participants,
    result: showResult ? percents : null,
    winner,
    mySide: input.mySide,
    switchCount: input.switchCount,
    lastActivityAt: toIso(input.lastActivityAt),
    lastActivityKind: input.lastActivityAt ? input.lastActivityKind ?? "comment" : null,
    editable: input.isAuthor && input.firstOtherVoteAt == null && state === "open",
  };
}

/** 선택한 쪽 이름. */
export const sideLabel = (summary: Pick<DebateSummary, "optionA" | "optionB">, side: DebateSide) =>
  side === "A" ? summary.optionA : summary.optionB;

/** "첫 투표를 기다려요" · "N명 참여" */
export function participantsLabel(participants: number): string {
  return participants > 0 ? `${participants.toLocaleString("ko-KR")}명 참여` : "첫 투표를 기다려요";
}

/** "2일 남음" · "18시간 남음" · "곧 끝나요 · 42분" · "끝난 토론 · 10월 12일"(KST). 마감 없으면 "상시 토론". */
export function remainingLabel(endsAt: Date | string | null, now = Date.now()): string {
  if (endsAt == null) return "상시 토론";
  const diff = toTime(endsAt) - now;
  if (diff <= 0) {
    const kst = new Date(toTime(endsAt) + 9 * 3600_000);
    return `끝난 토론 · ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
  }
  const minutes = Math.ceil(diff / 60_000);
  if (minutes < 60) return `곧 끝나요 · ${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 남음`;
  // 일은 반올림: 3일 토론을 연 직후(71시간 59분)가 "2일 남음"으로 보이지 않게.
  return `${Math.round(minutes / 1440)}일 남음`;
}

/** 최근 활동 시각: "방금" · "N분 전" · "N시간 전". 24시간 넘으면 빈 값(카드 메타에서 뺀다). */
export function activityLabel(iso: Date | string | null, now = Date.now()): string {
  if (!iso) return "";
  const minutes = Math.floor((now - toTime(iso)) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}시간 전` : "";
}

/** 진행 중 3표 미만일 때 고른 사람에게 보이는 안내. */
export const pendingResultLabel = (participants: number) =>
  `아직 ${participants}명만 골랐어요 · ${DEBATE_RESULT_MIN_VOTES}명부터 결과가 보여요`;

/**
 * 목록·레일 카드 메타 한 줄.
 * open: "2분 전 댓글 · 14명 참여 · 2일 남음"(활동 시각 activity 는 주황 600, 뒤 activityWord 는 댓글·투표.
 *       아무도 안 움직였거나 24시간 넘었으면 앞부분 생략)
 * decided: "끝남 · '냉동' 71% · 38명 참여" / 동률 "끝남 · 팽팽하게 끝났어요 · 38명 참여"
 * undecided: "끝남 · 2명 참여 · 결론 없음"
 */
export function debateMetaParts(
  summary: DebateSummary,
  now = Date.now()
): { activity: string; activityWord: string; rest: string } {
  if (summary.state === "open") {
    const activity = activityLabel(summary.lastActivityAt, now);
    return {
      activity,
      activityWord: activity ? (summary.lastActivityKind === "vote" ? "투표" : "댓글") : "",
      rest: [participantsLabel(summary.participants), remainingLabel(summary.endsAt, now)].join(" · "),
    };
  }
  if (summary.state === "undecided") {
    return { activity: "", activityWord: "", rest: `끝남 · ${summary.participants}명 참여 · 결론 없음` };
  }
  const winnerText =
    summary.winner === "tie" || !summary.result
      ? "팽팽하게 끝났어요"
      : `'${sideLabel(summary, summary.winner as DebateSide)}' ${
          summary.winner === "A" ? summary.result.a : summary.result.b
        }%`;
  return { activity: "", activityWord: "", rest: `끝남 · ${winnerText} · ${participantsLabel(summary.participants)}` };
}

/** 결과 카드 제목. */
export function resultHeadline(summary: DebateSummary): string {
  if (summary.state === "undecided") return "참여가 적어 결론을 못 냈어요";
  if (summary.winner === "tie") return "팽팽하게 끝났어요";
  if (summary.winner) return `${withSubjectJosa(sideLabel(summary, summary.winner))} 이겼어요`;
  return "";
}

/** 결과 카드의 '내 선택' 줄. 고르지 않았으면 null. */
export function mySideResultLine(summary: DebateSummary): string | null {
  if (!summary.mySide || summary.state !== "decided") return null;
  const mine = sideLabel(summary, summary.mySide);
  if (summary.winner === "tie") return `내 선택은 ${mine} — 팽팽했어요`;
  return summary.winner === summary.mySide
    ? `내 선택은 ${mine} — 이긴 쪽이에요`
    : `내 선택은 ${mine} — 소수 의견이었어요`;
}

/** 서버 결과 알림 문구(decided 만). */
export function resultNotificationMessage(summary: DebateSummary): string | null {
  if (summary.state !== "decided" || !summary.result) return null;
  if (summary.winner === "tie") return "토론 결과가 나왔어요 · 팽팽하게 끝났어요";
  const side = summary.winner as DebateSide;
  return `토론 결과가 나왔어요 · '${sideLabel(summary, side)}' ${side === "A" ? summary.result.a : summary.result.b}%`;
}

export type DebateInputErrorCode =
  | "DEBATE_QUESTION_LENGTH"
  | "DEBATE_OPTION_LENGTH"
  | "DEBATE_OPTION_SAME"
  | "DEBATE_DURATION"
  | "DEBATE_DESCRIPTION_LENGTH";

export type DebateInput = {
  title: string;
  optionA: string;
  optionB: string;
  durationHours: number;
  description?: string;
};

/** 토론 열기 입력 검사(앱·웹 버튼 켜짐과 서버가 같은 함수를 쓴다). */
export function validateDebateInput(
  input: DebateInput
): { ok: true } | { ok: false; errorCode: DebateInputErrorCode; message: string } {
  const title = input.title.trim();
  if (title.length < DEBATE_QUESTION_MIN || title.length > DEBATE_QUESTION_MAX) {
    return {
      ok: false,
      errorCode: "DEBATE_QUESTION_LENGTH",
      message: `질문은 ${DEBATE_QUESTION_MIN}~${DEBATE_QUESTION_MAX}자로 써 주세요`,
    };
  }
  const a = input.optionA.trim();
  const b = input.optionB.trim();
  if (!a || !b || a.length > DEBATE_OPTION_MAX || b.length > DEBATE_OPTION_MAX) {
    return { ok: false, errorCode: "DEBATE_OPTION_LENGTH", message: `선택지는 1~${DEBATE_OPTION_MAX}자로 써 주세요` };
  }
  if (a.toLowerCase() === b.toLowerCase()) {
    return { ok: false, errorCode: "DEBATE_OPTION_SAME", message: "두 선택지를 다르게 써 주세요" };
  }
  if (!(DEBATE_DURATIONS_HOURS as readonly number[]).includes(input.durationHours)) {
    return { ok: false, errorCode: "DEBATE_DURATION", message: "기간을 골라 주세요" };
  }
  if ((input.description ?? "").trim().length > DEBATE_DESCRIPTION_MAX) {
    return {
      ok: false,
      errorCode: "DEBATE_DESCRIPTION_LENGTH",
      message: `설명은 ${DEBATE_DESCRIPTION_MAX}자까지 쓸 수 있어요`,
    };
  }
  return { ok: true };
}

/** 기간 칩 이름. */
export const durationLabel = (hours: number) => (hours >= 24 ? (hours === 24 ? "24시간" : `${hours / 24}일`) : `${hours}시간`);

/** 마음 바꾼 줄 문구. */
export const switchLine = (userName: string, toLabel: string) =>
  `${userName}님이 ${withDirectionJosa(toLabel)} 마음을 바꿨어요`;
/** 선택 바꾸기 확인 시트 문구. */
export const switchConfirmMessage = (toLabel: string) =>
  `${withDirectionJosa(toLabel)} 바꿀까요? 이미 쓴 댓글의 쪽 표시는 그대로예요`;

/** 라이브 댓글 시간 구분 줄: 앞 댓글과 10분 이상 벌어지면 넣는다. */
export const LIVE_DIVIDER_GAP_MS = 10 * 60_000;
export function needsLiveDivider(prevIso: string | null, currentIso: string): boolean {
  if (!prevIso) return true;
  return toTime(currentIso) - toTime(prevIso) >= LIVE_DIVIDER_GAP_MS;
}
/** 구분 줄 문구: "방금" · "N분 전" · "N시간 전" · "어제" · "10월 12일" */
export function liveDividerLabel(iso: string, now = Date.now()): string {
  const recent = activityLabel(iso, now);
  if (recent) return recent;
  const kst = new Date(toTime(iso) + 9 * 3600_000);
  const today = new Date(now + 9 * 3600_000);
  const dayDiff = Math.floor(
    (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
      Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())) /
      86_400_000
  );
  if (dayDiff === 1) return "어제";
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

/** 라이브 점: 최근 10분 안 활동이 있으면 켠다. */
export const isLiveActive = (lastActivityAt: string | null, now = Date.now()) =>
  !!lastActivityAt && now - toTime(lastActivityAt) < 10 * 60_000;

/* ── 상시 토론(앱 docs/prd/evergreen-debate.md) ── */

/** 분야 무관 주제(펫샵 등). 칩 이름은 '공통'(모아보기의 '전체' 칩과 헷갈리지 않게). */
export const EVERGREEN_ALL = "all";
/** 운영자가 고르는 분야. path 는 서버 카테고리 트리(관심 분야 순서 정하기에 쓴다). */
export const EVERGREEN_FIELDS = [
  { key: "reptile", label: "파충류", path: "/reptile/" },
  { key: "aquarium", label: "물생활", path: "/fish/" },
  { key: "insect", label: "곤충", path: "/insect/" },
  { key: "hamster", label: "햄스터", path: "/mammal/hamster/" },
  { key: EVERGREEN_ALL, label: "공통", path: null },
] as const;
export type EvergreenFieldKey = (typeof EVERGREEN_FIELDS)[number]["key"];
export const isEvergreenField = (value: unknown): value is EvergreenFieldKey =>
  EVERGREEN_FIELDS.some((field) => field.key === value);
export const evergreenFieldLabel = (key: string | null | undefined) =>
  EVERGREEN_FIELDS.find((field) => field.key === key)?.label ?? "공통";

/** 결과 카드(공유 이미지)를 만들 수 있는 최소 표 수. 적은 표로 큰 %를 홍보하지 않으려는 것. */
export const RESULT_CARD_MIN_VOTES = 30;

const overlaps = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);

/**
 * 분야 칩 순서: 내 관심 분야(고정 path 와 겹치는 분야) 먼저, 그다음 기본 순서, '공통'은 맨 끝.
 * 포유류만 고정했으면 포유류 분야와 '공통'만 남긴다(scopeTerms 의 '집사' 규칙과 같은 범위).
 * available 은 상시 토론이 하나라도 있는 분야 키(없는 칩은 그리지 않는다).
 */
export function orderEvergreenFields(
  available: readonly string[],
  pins: readonly { path: string }[] = []
): { key: string; label: string }[] {
  const has = new Set(available);
  const mammalOnly = pins.length > 0 && pins.every((pin) => pin.path.startsWith("/mammal/"));
  const fields = EVERGREEN_FIELDS.filter(
    (field) => has.has(field.key) && (!mammalOnly || field.path == null || field.path.startsWith("/mammal/"))
  );
  const mine = (path: string | null) => path != null && pins.some((pin) => overlaps(pin.path, path));
  return [...fields]
    .sort((a, b) => {
      const rank = (field: (typeof fields)[number]) => (field.path == null ? 2 : mine(field.path) ? 0 : 1);
      return rank(a) - rank(b);
    })
    .map(({ key, label }) => ({ key, label }));
}

/** "2026년 10월부터"(KST). 아직 표가 없으면 빈 값. */
export function evergreenSinceLabel(since: Date | string | null): string {
  if (!since) return "";
  const kst = new Date(toTime(since) + 9 * 3600_000);
  return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월부터`;
}

/** 결과 카드 기간 "2026.10~2027.10"(KST, 첫 투표 달 ~ 이번 달). 같은 달이면 "2026.10". */
export function resultCardPeriod(since: Date | string, now = Date.now()): string {
  const fmt = (time: number) => {
    const kst = new Date(time + 9 * 3600_000);
    return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const from = fmt(toTime(since));
  const to = fmt(now);
  return from === to ? from : `${from}~${to}`;
}

/** 결과 카드에 크게 쓸 쪽과 %. 50:50 이면 tie. */
export function resultCardLead(summary: Pick<DebateSummary, "optionA" | "optionB">, countA: number, countB: number) {
  const percents = debatePercents(countA, countB);
  if (countA === countB) return { tie: true as const, label: "팽팽해요", percent: 50, percents };
  const side: DebateSide = countA > countB ? "A" : "B";
  return { tie: false as const, label: sideLabel(summary, side), percent: side === "A" ? percents.a : percents.b, percents };
}

/** 상세 메타 "2026년 10월부터 1,204명 참여 · 마음 바꾼 사람 31명". */
export function evergreenMetaLabel(summary: Pick<DebateSummary, "evergreen" | "participants" | "switchCount">): string {
  const since = evergreenSinceLabel(summary.evergreen?.since ?? null);
  const head = since ? `${since} ${participantsLabel(summary.participants)}` : participantsLabel(summary.participants);
  return summary.switchCount > 0 ? `${head} · 마음 바꾼 사람 ${summary.switchCount}명` : head;
}
