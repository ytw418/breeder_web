"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import useUser from "hooks/useUser";
import { voteDebate } from "@libs/client/liveTalkApi";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import {
  DEBATE_RESULT_MIN_VOTES,
  pendingResultLabel,
  sideLabel,
  type DebateSide,
  type DebateSummary,
} from "@libs/shared/debateFormat";

/**
 * 찬반 토론 공용 조각(앱 docs/prd/live-talk.md §3.1, 시안 design/mockups/live-talk/A-karrot.html .st · .gauge · .glabel · .vote).
 * A = 주황(brand), B = 검정(text). 색만으로 구분하지 않게 칩·라벨에 늘 쪽 이름을 쓴다.
 * 앱 src/components/features/debate/* 와 같은 크기·문구.
 */

/** 쪽 칩 18 r4 11/600 — A brand-soft + brand-text, B stance-b-soft + text. */
export function StanceChip({ side, label, className }: { side: DebateSide; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded px-1.5 text-[11px] font-semibold leading-[18px]",
        side === "A" ? "bg-app-brand-soft text-app-brand-text" : "bg-app-stance-b-soft text-app-text",
        className
      )}
    >
      {label}
    </span>
  );
}

/** '글쓴이' 칩(작성자 댓글·입력바). */
export function AuthorChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded bg-app-surface px-1.5 text-[11px] font-semibold leading-[18px] text-app-sub",
        className
      )}
    >
      글쓴이
    </span>
  );
}

/** 검정 '토론' pill(목록·레일 제목 앞, 시안 .qpill.d). */
export function DebatePill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded bg-app-inverse px-1.5 text-[11px] font-semibold leading-[18px] text-app-inverse-text",
        className
      )}
    >
      토론
    </span>
  );
}

/** 막대: 상세 10 r5, 카드 6 r3, 사이 2px. 0% 쪽은 그리지 않는다. */
export function DebateGauge({ result, thick = false }: { result: { a: number; b: number }; thick?: boolean }) {
  return (
    <div
      className={cn("flex gap-0.5 overflow-hidden", thick ? "h-2.5 rounded-[5px]" : "h-1.5 rounded-[3px]")}
      role="img"
      aria-label={`${result.a}% 대 ${result.b}%`}
    >
      {result.a > 0 ? <i className="block h-full bg-app-brand" style={{ width: `${result.a}%` }} /> : null}
      {result.b > 0 ? <i className="block h-full bg-app-text" style={{ width: `${result.b}%` }} /> : null}
    </div>
  );
}

const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5L20 7" />
  </svg>
);

/**
 * 결과 라벨 + 막대. 체크는 끝난 토론이면 이긴 쪽, 진행 중이면 내 선택에 붙는다.
 * 결과가 아직 없으면(진행 중 3표 미만·고르기 전) 고른 사람에게 "아직 N명만 골랐어요 · 3명부터 결과가 보여요".
 */
export function DebateResult({
  summary,
  size = "card",
  className,
}: {
  summary: DebateSummary;
  size?: "card" | "detail";
  className?: string;
}) {
  if (!summary.result) {
    if (summary.state === "open" && summary.mySide) {
      return (
        <p className={cn("text-[13px] leading-[18px] text-app-muted", className)}>
          {summary.participants >= DEBATE_RESULT_MIN_VOTES ? "결과를 불러오는 중이에요" : pendingResultLabel(summary.participants)}
        </p>
      );
    }
    return null;
  }
  const checked: DebateSide | null =
    summary.state === "decided" ? (summary.winner === "A" || summary.winner === "B" ? summary.winner : null) : summary.mySide;
  const detail = size === "detail";
  const label = cn("flex items-center gap-1 font-bold", detail ? "text-[15px] leading-5" : "text-[13px] leading-[18px]");
  const num = cn("tabular-nums", detail ? "text-[20px] tracking-[-0.4px]" : "text-[15px]");
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className={cn(label, "min-w-0 text-app-brand-text")}>
          <b className={num}>{summary.result.a}%</b>
          <span className="truncate">{summary.optionA}</span>
          {checked === "A" ? <CheckIcon size={detail ? 16 : 14} /> : null}
        </span>
        <span className={cn(label, "min-w-0 text-app-text")}>
          {checked === "B" ? <CheckIcon size={detail ? 16 : 14} /> : null}
          <span className="truncate">{summary.optionB}</span>
          <b className={num}>{summary.result.b}%</b>
        </span>
      </div>
      <DebateGauge result={summary.result} thick={detail} />
    </div>
  );
}

const VOTE_SIZE = {
  home: "h-12 rounded-xl text-[15px]",
  card: "h-10 rounded-lg text-[14px]",
  /** 홈 쓰레드 피드(앱 docs/prd/home-v2.md v2): 테두리 없는 surface 채움 36. */
  feed: "h-9 rounded-lg text-[14px]",
  detail: "h-14 rounded-xl text-[16px]",
  mini: "h-8 rounded-lg px-3 text-[13px]",
} as const;

/** 선택지 버튼 2개(색 점 8 + 이름). mini 는 입력바 자리의 작은 버튼(폭 자동). */
export function DebateVoteButtons({
  summary,
  size,
  pendingSide,
  onVote,
  className,
}: {
  summary: Pick<DebateSummary, "optionA" | "optionB">;
  size: keyof typeof VOTE_SIZE;
  pendingSide?: DebateSide | null;
  onVote: (side: DebateSide) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative z-[2] flex gap-2", className)}>
      {(["A", "B"] as const).map((side) => (
        <button
          key={side}
          type="button"
          disabled={Boolean(pendingSide)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onVote(side);
          }}
          className={cn(
            "flex min-w-0 items-center justify-center gap-2 border font-semibold text-app-text transition-colors active:bg-app-surface",
            size === "mini" ? "shrink-0" : "flex-1",
            size === "feed"
              ? pendingSide === side
                ? "border-app-text bg-app-surface"
                : "border-transparent bg-app-surface"
              : pendingSide === side
                ? "border-app-text bg-app-surface"
                : "border-app-border bg-app-bg",
            VOTE_SIZE[size]
          )}
        >
          <i
            className={cn(
              "block shrink-0 rounded-full",
              size === "feed" ? "h-1.5 w-1.5" : "h-2 w-2",
              side === "A" ? "bg-app-brand" : "bg-app-text"
            )}
          />
          <span className="truncate">{sideLabel(summary, side)}</span>
        </button>
      ))}
    </div>
  );
}

/** MainLayout 의 toLoginHref 와 같다(카드가 레이아웃·로고까지 끌어오지 않게 따로 둔다). */
const toLoginHref = (next: string) => `/auth/login?next=${encodeURIComponent(next)}`;

/** 비로그인이 고른 쪽을 로그인 뒤 보낸다(앱은 모듈 변수, 웹은 sessionStorage). */
const PENDING_VOTE_KEY = "bredy:pending-vote";
const PENDING_VOTE_TTL_MS = 10 * 60_000;

/** 고르기 직후 화면(서버 응답 전): 내 선택만 바꾸고 참여 수를 올린다. 결과는 서버가 준다(상시 토론은 지금 결과를 그대로 둔다). */
function optimisticVote(summary: DebateSummary, side: DebateSide): DebateSummary {
  return {
    ...summary,
    mySide: side,
    participants: summary.mySide ? summary.participants : summary.participants + 1,
    switchCount: summary.mySide && summary.mySide !== side ? summary.switchCount + 1 : summary.switchCount,
    result: summary.mySide || summary.evergreen ? summary.result : null,
  };
}

/**
 * 투표 상태(낙관 갱신 → 서버 요약으로 교체, 실패하면 되돌리고 토스트).
 * 409 DEBATE_CLOSED 는 "방금 끝난 토론이에요" + 서버가 준 요약(없으면 다시 불러오기 onClosed).
 */
export function useDebateVote({
  postId,
  initial,
  source,
  onVoted,
  onClosed,
}: {
  postId: number;
  initial: DebateSummary | null | undefined;
  source: "home" | "feed" | "rail" | "detail";
  onVoted?: (summary: DebateSummary) => void;
  onClosed?: () => void;
}) {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [summary, setSummary] = useState<DebateSummary | null>(initial ?? null);
  const [pendingSide, setPendingSide] = useState<DebateSide | null>(null);
  const busy = useRef(false);

  // 목록·상세가 새 요약을 받으면 따른다(보내는 중이면 응답이 이긴다).
  useEffect(() => {
    if (!busy.current) setSummary(initial ?? null);
  }, [initial]);

  const vote = useCallback(
    async (side: DebateSide) => {
      if (!summary || busy.current) return;
      if (!user) {
        if (isLoading) return;
        try {
          sessionStorage.setItem(PENDING_VOTE_KEY, JSON.stringify({ postId, side, at: Date.now() }));
        } catch {
          // 저장이 막힌 브라우저면 로그인 뒤 다시 고르면 된다.
        }
        router.push(toLoginHref(`${window.location.pathname}${window.location.search}`));
        return;
      }
      if (summary.state !== "open" || summary.mySide === side) return;
      busy.current = true;
      const before = summary;
      setPendingSide(side);
      setSummary(optimisticVote(before, side));
      const res = await voteDebate(postId, side, source);
      busy.current = false;
      setPendingSide(null);
      if (res.ok && res.data.debate) {
        setSummary(res.data.debate);
        onVoted?.(res.data.debate);
        return;
      }
      setSummary(before);
      if (res.data.errorCode === "DEBATE_CLOSED") {
        toast("방금 끝난 토론이에요");
        onClosed?.();
        return;
      }
      toast.error("다시 눌러 주세요");
    },
    [summary, user, isLoading, postId, source, router, onVoted, onClosed]
  );

  // 로그인하고 돌아오면 고르던 쪽을 보낸다(10분 안, 같은 글, 아직 안 골랐을 때).
  useEffect(() => {
    if (!user || !summary || summary.mySide || summary.state !== "open") return;
    let pending: { postId: number; side: DebateSide; at: number } | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(PENDING_VOTE_KEY) ?? "null");
    } catch {
      pending = null;
    }
    if (!pending || pending.postId !== postId) return;
    sessionStorage.removeItem(PENDING_VOTE_KEY);
    if (Date.now() - pending.at > PENDING_VOTE_TTL_MS) return;
    void vote(pending.side);
  }, [user, summary, postId, vote]);

  return { summary, setSummary, vote, pendingSide };
}
