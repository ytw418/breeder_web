"use client";

import Link from "next/link";

import { CardOverlayLink } from "@components/app/AuthorLink";
import { toPostPath } from "@libs/post-route";
import { participantsLabel, remainingLabel, type DebateSummary } from "@libs/shared/debateFormat";
import { DebateResult, DebateVoteButtons, useDebateVote } from "./DebateParts";

export type HomeDebatePost = { id: number; title: string; type: string | null; debate: DebateSummary };

/**
 * 홈 '실시간 TOP 토론' 맨 위 토론 카드(앱 docs/prd/live-talk.md §3.2, 시안 ① .dbt.c — 약 170).
 * gap 배경 r16 패딩 16: 질문 18/700 2줄 → 선택지 버튼 2개(48 r12) → 메타 13 muted "{종} · N명 참여 · 18시간 남음".
 * 고르면 버튼 자리가 결과(막대 6)로 바뀌고 메타 끝에 '라이브 댓글 ›'. 종 이름은 분양 탭을 그 종 칩으로 연다.
 * 카드 나머지를 누르면 토론 상세. 앱 src/components/features/debate/HomeDebateCard.tsx 와 같다.
 */
export default function HomeDebateCard({ post, onClosed }: { post: HomeDebatePost; onClosed?: () => void }) {
  const { summary, vote, pendingSide } = useDebateVote({
    postId: post.id,
    initial: post.debate,
    source: "home",
    onClosed,
  });
  if (!summary) return null;
  const href = toPostPath(post.id, post.title);
  const voted = Boolean(summary.mySide) || summary.state !== "open";
  return (
    <div className="relative mx-4 rounded-2xl bg-app-gap p-4" data-testid="home-debate-card">
      <CardOverlayLink href={href} label={post.title} />
      <p className="line-clamp-2 break-keep text-[18px] font-bold leading-[25px] tracking-[-0.4px] text-app-text">
        {post.title}
      </p>
      {voted ? (
        <DebateResult summary={summary} className="mt-3" />
      ) : (
        <DebateVoteButtons summary={summary} size="home" pendingSide={pendingSide} onVote={vote} className="mt-3" />
      )}
      <p className="mt-2.5 flex min-w-0 items-center text-[13px] leading-[18px] text-app-muted">
        <span className="min-w-0 truncate">
          {post.type ? (
            <>
              <Link
                href={`/products?category=${encodeURIComponent(post.type)}`}
                className="relative z-[2] font-semibold text-app-text"
              >
                {post.type}
              </Link>
              {" · "}
            </>
          ) : null}
          {participantsLabel(summary.participants)} · {remainingLabel(summary.endsAt)}
        </span>
        {summary.mySide ? (
          <Link href={`${href}#live`} className="relative z-[2] ml-auto shrink-0 pl-2 font-semibold text-app-text">
            라이브 댓글 ›
          </Link>
        ) : null}
      </p>
    </div>
  );
}

/** 불러오는 동안 맨 위 토론 카드 자리(앱 HomeDebateCardSkeleton 과 같은 모양). 카드가 들어올 때 아래 레일이 밀리지 않게 한다. */
export function HomeDebateCardSkeleton() {
  return (
    <div aria-hidden="true" className="mx-4 flex flex-col gap-2 rounded-2xl bg-app-gap p-4">
      <div className="h-[18px] w-[90%] animate-pulse rounded bg-app-placeholder" />
      <div className="h-[18px] w-[60%] animate-pulse rounded bg-app-placeholder" />
      <div className="mt-1 flex gap-2">
        <div className="h-12 flex-1 animate-pulse rounded-xl bg-app-placeholder" />
        <div className="h-12 flex-1 animate-pulse rounded-xl bg-app-placeholder" />
      </div>
      <div className="h-[13px] w-1/2 animate-pulse rounded bg-app-placeholder" />
    </div>
  );
}
