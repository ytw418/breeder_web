/**
 * 커뮤니티 참여 유도 문구(앱 docs/prd/community-vibe.md §3.1·§3.2·§3.4).
 * 빈 상태는 "없어요"로 끝내지 않는다: [네가 처음] + [지금 움직임 하나] + [행동 버튼].
 * 앱 `src/lib/communityCopy.ts` 와 같은 사본이다. 고치면 둘 다 고치고 웹 jest `communityCopy`·앱 `npm run test:community-copy` 를 돌린다.
 */
import type { RankingMe, RankingNextActionKind } from "./communityVibe";

export type EmptyCopy = { title: string; body: string | null; action: string };

/** 받침이 있으면 true(ㄹ 받침 포함). 한글이 아니면 숫자 읽기 기준. */
function hasBatchim(word: string): boolean {
  const last = word.trim().slice(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  // 숫자: 0(영)·1(일)·3(삼)·6(육)·7(칠)·8(팔) 은 받침, 2·4·5·9 는 없음
  if (/[0-9]/.test(last)) return "013678".includes(last);
  return false;
}

/** 받침이 ㄹ 이면 true("로" 를 쓴다). */
function hasRieulBatchim(word: string): boolean {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 8;
  return /[178]$/.test(last);
}

/** "~로/~으로". */
export function withRo(word: string): string {
  return `${word}${hasBatchim(word) && !hasRieulBatchim(word) ? "으로" : "로"}`;
}

/** 범위 라벨 뒤에 "근처"를 붙인다. 이미 "보은군 근처"면 다시 붙이지 않는다. */
export function nearLabel(regionLabel: string): string {
  return regionLabel.endsWith("근처") ? regionLabel : `${regionLabel} 근처`;
}

/** 홈 동네 브리더 0명(50km 안에도 없음). visitors 는 7일 범위 홈 방문자 수. */
export function neighborhoodEmptyCopy(regionLabel: string, visitors: number): EmptyCopy {
  const near = nearLabel(regionLabel);
  return {
    title: `${near} 첫 브리더가 되어 보세요`,
    body:
      visitors > 0
        ? `이번 주 ${near}에서 ${visitors.toLocaleString()}명이 둘러봤어요`
        : "인사 글은 근처 브리더 홈에 바로 보여요",
    action: "인사 남기기",
  };
}

/** 채팅 목록 0. sameSpeciesNearby 는 내 주력 종 + 내 시/군/구 사용자 수. */
export function chatEmptyCopy(sameSpeciesNearby: number): EmptyCopy {
  return {
    title:
      sameSpeciesNearby > 0
        ? `이 종 키우는 사람 ${sameSpeciesNearby.toLocaleString()}명이 근처에 있어요`
        : "분양글에서 인사를 보내 보세요",
    body: null,
    action: "분양글 둘러보기",
  };
}

/** 분양 탭 무료 분양 0(2026-10-15 '무료나눔' → '무료 분양'). */
export function freeGiveawayEmptyCopy(): EmptyCopy {
  return { title: "첫 무료 분양은 홈 맨 위에 하루 동안 보여요", body: null, action: "첫 번째로 무료 분양하기" };
}

/**
 * 작은 숫자에 맥락을 붙인다. "분양글 1개" → "분양글 1개로 이번 주 1위".
 * period 가 all 이면 "전체 1위".
 */
export function heroRankReason(part: string, rank = 1, period: "weekly" | "all" = "weekly"): string {
  return `${withRo(part)} ${period === "weekly" ? "이번 주" : "전체"} ${rank}위`;
}

const ACTION_LABEL: Record<RankingNextActionKind, { name: string; unit: string }> = {
  post: { name: "글", unit: "개" },
  comment: { name: "댓글", unit: "개" },
  bid: { name: "입찰", unit: "번" },
};

/** "글 2개" / "댓글 5개" / "입찰 2번" */
export function rankingActionLabel(action: { kind: RankingNextActionKind; count: number }): string {
  const { name, unit } = ACTION_LABEL[action.kind];
  return `${name} ${action.count}${unit}`;
}

/**
 * 홈 TOP 카드 내 순위 줄. 순위 숫자(`emphasis`)만 주황으로 칠할 수 있게 셋으로 나눈다.
 * - 1위: "이번 주 1위예요 · 2위와 N점 차이"
 * - 순위 있음: "나는 지금 7위 · 3위까지 글 2개"
 * - 순위 없음(이번 주 점수 0): "나는 아직 순위 밖 · 3위까지 글 2개"
 */
export function myRankLine(me: RankingMe): { prefix: string; emphasis: string; suffix: string } {
  if (me.rank === 1) {
    return {
      prefix: "이번 주 ",
      emphasis: "1위",
      suffix: me.gapToSecond !== null ? `예요 · 2위와 ${me.gapToSecond}점 차이` : "예요",
    };
  }
  const goal =
    me.nextRank !== null && me.nextAction
      ? ` · ${me.nextRank}위까지 ${rankingActionLabel(me.nextAction)}`
      : "";
  if (me.rank === null) return { prefix: "나는 아직 ", emphasis: "순위 밖", suffix: goal };
  return { prefix: "나는 지금 ", emphasis: `${me.rank}위`, suffix: goal };
}

/** 진행 바 비율(0~1). 목표가 없으면 1. */
export function rankProgress(me: Pick<RankingMe, "score" | "nextScore">): number {
  if (me.nextScore === null || me.nextScore <= 0) return 1;
  return Math.max(0, Math.min(1, me.score / me.nextScore));
}

export type CelebrateTarget = "post" | "product" | "auction";

const TARGET_NOUN: Record<CelebrateTarget, string> = { post: "글", product: "분양글", auction: "경매" };

/** 보상 시트 제목. "반려생활 234번째 글" / "12번째 분양글" / "5번째 경매" */
export function celebrateTitle(target: CelebrateTarget, ordinal: number): string {
  const n = ordinal.toLocaleString();
  if (target === "post") return `반려생활 ${n}번째 글`;
  return `${n}번째 ${TARGET_NOUN[target]}`;
}

export interface CelebrateFactInput {
  target: CelebrateTarget;
  /** 범위 라벨("서울", "보은군 근처"). 동네가 없으면 null. */
  regionLabel: string | null;
  /** 범위 안에서 그 종류의 첫 글인가. */
  regionFirst: boolean;
  /** 오늘(KST) 서비스 전체에서 그 종류의 첫 글인가. */
  todayFirst: boolean;
  /** 종(type·category). 없으면 null. */
  species: string | null;
  /** 이번 주(KST) 그 종의 첫 글인가. */
  weekSpeciesFirst: boolean;
  /** 이 글의 분야를 관심 카테고리로 고정한 사람 수. */
  pinnedCount: number;
}

/** 둘째 줄 사실 하나. 우선순위: 범위 첫 글 > 오늘 첫 글 > 이번 주 종 첫 글 > 관심 고정 N명. 없으면 null. */
export function celebrateFact(input: CelebrateFactInput): string | null {
  const noun = TARGET_NOUN[input.target];
  if (input.regionFirst && input.regionLabel) return `${input.regionLabel} 첫 ${noun}`;
  if (input.todayFirst) return `오늘 첫 ${noun}`;
  if (input.weekSpeciesFirst && input.species) return `이번 주 ${input.species} 첫 ${noun}`;
  if (input.pinnedCount > 0) return `${input.pinnedCount.toLocaleString()}명이 관심 분야로 고정한 ${noun}${hasBatchim(noun) ? "이에요" : "예요"}`;
  return null;
}

/** fact 가 null 일 때 화면이 쓰는 둘째 줄. */
export function celebrateFallback(target: CelebrateTarget, opts: { isQuestion?: boolean; pinnedCount?: number } = {}): string {
  if (target === "product") return "홈 '지금 올라온 분양'에 바로 보여요";
  if (target === "post" && opts.isQuestion && (opts.pinnedCount ?? 0) > 0) {
    return `관심 고정자 ${opts.pinnedCount}명에게 알림이 갔어요`;
  }
  return "지금 바로 목록에 보여요";
}
