"use client";

import { cn } from "@libs/client/utils";
import { debateMetaParts, type DebateSummary } from "@libs/shared/debateFormat";
import { DebateResult, DebateVoteButtons, useDebateVote } from "./DebateParts";

/**
 * 목록 토론 카드 아래쪽(앱 docs/prd/live-talk.md §3.3, 시안 ②):
 * open 안 고름 → 선택지 버튼 2개(40 r8) / open 고름 → 결과 라벨 + 막대 6(3표 미만이면 안내) /
 * decided → 막대 + 이긴 쪽 체크 / undecided → 막대 없음.
 * 메타 13 muted: "2분 전 댓글 · 14명 참여 · 2일 남음"(활동 시각만 주황 600).
 * 앱 src/components/features/debate/DebateCardBody.tsx 와 같다.
 */
export default function DebateCardBody({
  postId,
  debate,
  size = "card",
}: {
  postId: number;
  debate: DebateSummary;
  /** feed: 홈 쓰레드 피드(36 채움 버튼, 메타 12, 앱 docs/prd/home-v2.md v2). */
  size?: "card" | "feed";
}) {
  const { summary, vote, pendingSide } = useDebateVote({ postId, initial: debate, source: "feed" });
  if (!summary) return null;
  const meta = debateMetaParts(summary);
  const showVote = summary.state === "open" && !summary.mySide;
  return (
    <>
      {showVote ? (
        <DebateVoteButtons summary={summary} size={size} pendingSide={pendingSide} onVote={vote} className="mt-3" />
      ) : summary.state !== "undecided" ? (
        <DebateResult summary={summary} className="mt-3" />
      ) : null}
      <p
        className={cn(
          "truncate text-app-muted",
          size === "feed" ? "mt-1.5 text-[12px] leading-4" : "mt-2 text-[13px] leading-[18px]"
        )}
      >
        {meta.activity ? (
          <>
            <b className="font-semibold text-app-brand">{meta.activity}</b> {meta.activityWord} ·{" "}
          </>
        ) : null}
        {meta.rest}
      </p>
    </>
  );
}
