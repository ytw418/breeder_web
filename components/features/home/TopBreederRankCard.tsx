"use client";
/**
 * 홈 '이번 주 TOP 브리더' 카드 + 내 순위 줄(community-vibe §3.2 F-2·F-13, 시안 .rank).
 * 1위 행: 아바타 44 · 이름 16/600 + 칭호 pill · "분양글 1개로 이번 주 1위" · 오른쪽 "1위" 24/700(숫자 주황) + "42점 · 기준 ⓘ"(점수 기준 시트).
 * 1px line 뒤 내 행: 아바타 40 · "나는 지금 **7위** · 3위까지 글 2개" 15/600 · "26점 · 내 순위 ›"(→ /ranking?focus=me) ·
 * 진행 바 6 주황 · 오른쪽 36 r8 검정 버튼(다음 활동이 글이면 글쓰기, 댓글이면 답 기다리는 질문, 입찰이면 경매).
 * 비로그인은 "로그인하면 내 순위가 보여요" 한 줄 + 로그인.
 */
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toLoginHref } from "@components/features/MainLayout";
import BreederScoreSheet from "@components/features/post/BreederScoreSheet";
import { InitialAvatar } from "@components/ui/InitialAvatar";
import { toPostPath } from "@libs/post-route";
import type { BreederKeyword } from "@libs/shared/breederKeywords";
import type { RankingMe, RankingNextActionKind } from "@libs/shared/communityVibe";
import type { BreederRankingItem } from "@libs/shared/ranking";

export const RANKING_ME_KEY = "/api/rankings/me?period=weekly";
const UNANSWERED_KEY = "/api/posts?unanswered=1&limit=1";
export const MY_RANK_HREF = "/ranking?focus=me";

/** 받침이 있으면(ㄹ 제외) '으로', 아니면 '로'. 숫자로 끝나면 읽는 소리 기준. */
export function withRo(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return `${word}${jong === 0 || jong === 8 ? "로" : "으로"}`;
  }
  // 0 1 3 6 7 8 → 받침 있음(영·일·삼·육·칠·팔), 일·칠·팔은 ㄹ 받침이라 '로'.
  if (/[036]$/.test(last)) return `${word}으로`;
  return `${word}로`;
}

const ACTION_UNIT: Record<RankingNextActionKind, (n: number) => string> = {
  post: (n) => `글 ${n}개`,
  comment: (n) => `댓글 ${n}개`,
  bid: (n) => `입찰 ${n}번`,
};
const ACTION_BUTTON: Record<RankingNextActionKind, string> = {
  post: "글쓰기",
  comment: "답하기",
  bid: "입찰하기",
};

/** 서버 응답 모양이 바뀌어도 읽게 한다: `{ me }` · `{ item }` · 평평한 RankingMe · 옛 RankingMeSummary(currentRank). */
export function normalizeRankingMe(raw: unknown): RankingMe | null {
  if (!raw || typeof raw !== "object") return null;
  const box = raw as Record<string, unknown>;
  const inner = (box.me ?? box.item ?? box) as Record<string, unknown> | null;
  if (!inner || typeof inner !== "object") return null;
  const rank = (inner.rank ?? inner.currentRank ?? null) as number | null;
  const score = typeof inner.score === "number" ? inner.score : 0;
  return {
    rank: typeof rank === "number" ? rank : null,
    score,
    delta: (inner.delta ?? inner.rankDelta ?? null) as number | null,
    nextRank: (inner.nextRank ?? null) as number | null,
    nextScore: (inner.nextScore ?? null) as number | null,
    nextAction: (inner.nextAction ?? null) as RankingMe["nextAction"],
    gapToSecond: (inner.gapToSecond ?? null) as number | null,
  };
}

/** 내 행 첫 줄 문구와 강조할 순위. */
export function myRankHeadline(me: RankingMe): { lead: string; rank: string | null; tail: string } {
  if (me.rank === 1) {
    return {
      lead: "이번 주 ",
      rank: "1위",
      tail: me.gapToSecond != null ? `예요 · 2위와 ${me.gapToSecond}점 차이` : "예요",
    };
  }
  const action = me.nextAction ? ACTION_UNIT[me.nextAction.kind](me.nextAction.count) : null;
  if (me.rank == null) {
    return { lead: "", rank: null, tail: action ? `${action}면 이번 주 순위에 올라요` : "글을 쓰면 이번 주 순위에 올라요" };
  }
  const target = me.nextRank ?? (me.rank <= 3 ? me.rank - 1 : 3);
  let goal: string | null = null;
  if (me.rank <= 3 && me.nextScore != null) goal = `${target}위까지 ${Math.max(1, me.nextScore - me.score)}점`;
  else if (action) goal = `${target}위까지 ${action}`;
  return { lead: "나는 지금 ", rank: `${me.rank}위`, tail: goal ? ` · ${goal}` : "" };
}

/** 진행 바 비율(0~1). 목표가 없으면(1위) 가득. */
export function myRankProgress(me: RankingMe): number {
  if (me.rank === 1 || !me.nextScore) return 1;
  return Math.max(0.04, Math.min(1, me.score / me.nextScore));
}

const InfoIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="inline align-[-2px]">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01M11 12h1v4h1" />
  </svg>
);
const CheckIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="m5 12 5 5L20 7" />
  </svg>
);

function MyRankRow({
  me,
  user,
}: {
  me: RankingMe;
  user: { name: string; avatar: string | null };
}) {
  const kind = me.nextAction?.kind ?? "post";
  const { data: unanswered } = useSWR<{ posts?: { id: number; title: string }[] }>(
    kind === "comment" ? UNANSWERED_KEY : null
  );
  const question = unanswered?.posts?.[0];
  const ctaHref =
    kind === "bid"
      ? "/auctions"
      : kind === "comment"
        ? question
          ? `${toPostPath(question.id, question.title)}#comment`
          : "/"
        : "/posts/upload";
  const headline = myRankHeadline(me);
  const progress = myRankProgress(me);
  return (
    <div className="mt-3 flex items-center gap-3 border-t border-app-line pt-3" data-testid="my-rank-row">
      <InitialAvatar name={user.name} avatar={user.avatar} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-[22px] text-app-text">
          {headline.lead}
          {headline.rank ? <em className="not-italic text-app-brand">{headline.rank}</em> : null}
          {headline.tail}
        </p>
        <Link href={MY_RANK_HREF} className="block text-[13px] leading-[18px] text-app-muted tabular-nums">
          {me.score.toLocaleString()}점 · 내 순위 ›
        </Link>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-app-border" aria-hidden="true">
          <i className="block h-full rounded-full bg-app-brand" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
      <Link
        href={ctaHref}
        className="flex h-9 shrink-0 items-center rounded-lg bg-app-inverse px-3.5 text-[14px] font-semibold text-app-inverse-text"
      >
        {ACTION_BUTTON[kind]}
      </Link>
    </div>
  );
}

export default function TopBreederRankCard({
  hero,
  keyword,
  period,
  scoped,
  viewer,
  viewerLoading,
}: {
  hero: BreederRankingItem;
  keyword: BreederKeyword | null;
  period: "weekly" | "all";
  scoped: boolean;
  viewer: { id: number; name: string; avatar: string | null } | null;
  viewerLoading: boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: meRaw } = useSWR<unknown>(viewer ? RANKING_ME_KEY : null, { shouldRetryOnError: false });
  const me = normalizeRankingMe(meRaw);
  const when = period === "weekly" ? "이번 주" : "전체";
  const reason = keyword?.parts?.[0] ?? keyword?.detail ?? null;
  return (
    <div className="rounded-2xl bg-app-gap p-4" data-testid="top-breeder-card">
      <div className="flex items-center gap-3">
        <Link href={`/profiles/${hero.user.id}`} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`${hero.rank}위 ${hero.user.name} 프로필 보기`}>
          <InitialAvatar name={hero.user.name} avatar={hero.user.avatar} size={44} />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[16px] font-semibold leading-[22px] text-app-text">{hero.user.name}</span>
              {keyword ? (
                <span className="app-title-pill">
                  <CheckIcon />
                  {keyword.label}
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-app-muted">
              {reason ? `${withRo(reason)} ${when} 1위` : `${when} 1위`}
            </span>
          </span>
        </Link>
        <div className="shrink-0 text-right">
          <p className="text-[24px] font-bold leading-7 tracking-[-0.5px] text-app-text">
            <em className="not-italic text-app-brand">{hero.rank}</em>위
          </p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="text-[12px] leading-4 text-app-muted tabular-nums"
            aria-label={`${hero.score}점, 점수 기준 보기`}
          >
            {hero.score.toLocaleString()}점 · 기준 <InfoIcon />
          </button>
        </div>
      </div>

      {viewer ? (
        me ? (
          <MyRankRow me={me} user={viewer} />
        ) : null
      ) : !viewerLoading ? (
        <div className="mt-3 flex items-center gap-3 border-t border-app-line pt-3" data-testid="my-rank-login">
          <p className="min-w-0 flex-1 text-[14px] text-app-sub">로그인하면 내 순위가 보여요</p>
          <Link
            href={toLoginHref("/")}
            className="flex h-9 shrink-0 items-center rounded-lg bg-app-inverse px-3.5 text-[14px] font-semibold text-app-inverse-text"
          >
            로그인
          </Link>
        </div>
      ) : null}

      <BreederScoreSheet open={sheetOpen} scoped={scoped} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
