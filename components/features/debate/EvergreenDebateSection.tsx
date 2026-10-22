"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import useBlocks from "hooks/useBlocks";
import useCategoryScope from "hooks/useCategoryScope";
import { withoutBlocked } from "@libs/shared/blockFilter";
import { cn } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import {
  DEBATE_RESULT_MIN_VOTES,
  evergreenFieldLabel,
  orderEvergreenFields,
  participantsLabel,
  type DebateSide,
  type DebateSummary,
} from "@libs/shared/debateFormat";
import { useDebateVote } from "./DebateParts";

export type EvergreenPost = {
  id: number;
  title: string;
  user?: { id: number } | null;
  _count?: { comments?: number } | null;
  debate: DebateSummary | null;
};
export type EvergreenResponse = { success?: boolean; posts?: EvergreenPost[]; fields?: string[] };

export const EVERGREEN_KEY = "/api/posts?debateStatus=evergreen";
/** 반려생활 탭에서 분야마다 보이는 줄 수. */
const LIFE_ROWS = 3;

const Chevron = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

/**
 * 반려생활 '상시 토론'(앱 docs/prd/evergreen-debate.md S-3, 시안 evergreen-debate ①②).
 * 제목 16/700 + '결과가 계속 쌓여요' + 모아보기 › → 분야 칩(28, 내 관심 분야 먼저) → 줄 3개.
 * 상시 토론이 하나도 없으면 섹션을 그리지 않는다. 앱 src/components/features/debate/EvergreenDebateSection.tsx 와 같다.
 */
export default function EvergreenDebateSection() {
  const { blockedIds } = useBlocks();
  const scope = useCategoryScope();
  const { data } = useSWR<EvergreenResponse>(EVERGREEN_KEY, { revalidateOnFocus: false });
  const posts = useMemo(
    () => withoutBlocked(data?.posts ?? [], blockedIds, (post) => post.user?.id).filter((post) => post.debate?.evergreen),
    [data, blockedIds]
  );
  const fields = useMemo(
    () => orderEvergreenFields(Array.from(new Set(posts.map((post) => post.debate!.evergreen!.field))), scope.pins),
    [posts, scope.pins]
  );
  const [picked, setPicked] = useState<string | null>(null);
  const field = fields.find((item) => item.key === picked)?.key ?? fields[0]?.key ?? null;
  if (!field) return null;
  const rows = posts.filter((post) => post.debate!.evergreen!.field === field).slice(0, LIFE_ROWS);

  return (
    <section className="px-4 pt-4" data-home-section="evergreen">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[16px] font-bold leading-[22px] tracking-[-0.3px] text-app-text">상시 토론</h2>
        <span className="truncate text-[13px] leading-[18px] text-app-muted">결과가 계속 쌓여요</span>
        <Link href="/debates?tab=evergreen" className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[13px] text-app-muted">
          모아보기
          <Chevron />
        </Link>
      </div>
      <div className="app-rail -mx-4 mt-2 flex gap-1 px-4">
        {fields.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPicked(item.key)}
            className={cn(
              "h-7 shrink-0 rounded-lg px-3 text-[13px]",
              item.key === field ? "bg-app-inverse font-semibold text-app-inverse-text" : "bg-app-surface font-medium text-app-sub"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div>
        {rows.map((post, index) => (
          <EvergreenRow key={post.id} post={post} last={index === rows.length - 1} />
        ))}
      </div>
    </section>
  );
}

/**
 * 상시 토론 한 줄: 질문 14/600 → [A 칩 28 · 막대 4 · B 칩 28] → 메타 11.
 * 쪽 칩을 누르면 화면을 옮기지 않고 투표(고른 쪽 brand-soft + ✓), 줄 나머지는 상세.
 * 결과는 투표 전에도 보인다(3표 미만이면 막대 대신 안내).
 */
export function EvergreenRow({ post, last = false, showField = true }: { post: EvergreenPost; last?: boolean; showField?: boolean }) {
  const { summary: voted, vote, pendingSide } = useDebateVote({ postId: post.id, initial: post.debate, source: "rail" });
  const summary = voted ?? post.debate;
  if (!summary) return null;
  const href = toPostPath(post.id, post.title);
  const result = summary.result;
  const chip = (side: DebateSide) => {
    const mine = summary.mySide === side;
    const label = side === "A" ? summary.optionA : summary.optionB;
    const percent = result ? (side === "A" ? result.a : result.b) : null;
    return (
      <button
        type="button"
        disabled={Boolean(pendingSide)}
        onClick={() => vote(side)}
        aria-pressed={mine}
        className={cn(
          "inline-flex h-7 max-w-[45%] shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold",
          mine ? "bg-app-brand-soft text-app-brand-text" : "bg-app-surface text-app-text"
        )}
      >
        {mine ? "✓ " : null}
        {side === "B" && percent != null ? <b className="tabular-nums">{percent}%</b> : null}
        <span className="truncate">{label}</span>
        {side === "A" && percent != null ? <b className={cn("tabular-nums", !mine && "text-app-brand-text")}>{percent}%</b> : null}
      </button>
    );
  };
  const meta = [
    showField && summary.evergreen ? evergreenFieldLabel(summary.evergreen.field) : null,
    participantsLabel(summary.participants),
    !result && summary.participants > 0 && summary.participants < DEBATE_RESULT_MIN_VOTES
      ? `${DEBATE_RESULT_MIN_VOTES}명부터 결과가 보여요`
      : null,
  ].filter(Boolean);
  return (
    <div className={cn("py-3", !last && "border-b border-app-line")}>
      <Link href={href} className="block truncate text-[14px] font-semibold leading-5 text-app-text">
        {post.title}
      </Link>
      <div className="mt-2 flex items-center gap-2">
        {chip("A")}
        <Link href={href} className="flex h-7 min-w-0 flex-1 items-center" aria-label="토론 보기">
          {result ? (
            <span className="flex h-1 w-full gap-0.5 overflow-hidden rounded-full">
              {result.a > 0 ? <i className="block h-full rounded-full bg-app-brand" style={{ width: `${result.a}%` }} /> : null}
              {result.b > 0 ? <i className="block h-full rounded-full bg-app-text" style={{ width: `${result.b}%` }} /> : null}
            </span>
          ) : (
            <span className="block h-1 w-full rounded-full bg-app-surface" />
          )}
        </Link>
        {chip("B")}
      </div>
      <Link
        href={summary.mySide ? `${href}#live` : href}
        className="mt-1 block text-[11px] leading-4 text-app-muted tabular-nums"
      >
        {meta.join(" · ")}
        {summary.mySide ? " · 라이브 댓글 ›" : ""}
      </Link>
    </div>
  );
}
