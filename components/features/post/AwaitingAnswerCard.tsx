"use client";

import Link from "next/link";
import { InitialAvatar } from "@components/ui/InitialAvatar";
import { toPostPath } from "@libs/post-route";
import useScopeTerms from "@/hooks/useScopeTerms";
import { withBreederWord } from "@libs/shared/scopeTerms";

export type AwaitingQuestion = {
  id: number;
  title: string;
  createdAt: string | Date;
  user?: { id?: number; name: string; avatar?: string | null } | null;
};

/**
 * '2시간째 답을 기다리고 있어요'(앱 PostsHighlights unansweredLine 과 같다). 1시간 안이면 '방금 올라온 질문이에요'.
 * '답'은 질문자가 아닌 사람의 보이는 댓글이다(GET /api/posts?unanswered=1). 질문자 본인 댓글만 있는 질문도 남으므로
 * '답이 없어요'(댓글이 없다는 뜻으로 읽힘) 대신 '답을 기다리고 있어요'로 쓴다(2026-10-21 디자인 리뷰).
 */
export function waitingDurationLabel(createdAt: string | Date, now: number = Date.now()): string {
  const t = (createdAt instanceof Date ? createdAt : new Date(createdAt)).getTime();
  if (Number.isNaN(t)) return "답을 기다리고 있어요";
  const minutes = Math.max(0, Math.floor((now - t) / 60_000));
  if (minutes < 60) return "방금 올라온 질문이에요";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간째 답을 기다리고 있어요`;
  return `${Math.floor(hours / 24)}일째 답을 기다리고 있어요`;
}

/** '답 기다려요' 카드 보조 둘째 줄(첫 답변 소통왕 점수 2배, 앱 UNANSWERED_BONUS_LINE 과 같다). */
export const WAITING_BONUS_LINE = "먼저 답하면 점수 2배";

/** 질문하기 주소: 글쓰기를 '질문' 주제로 연다. */
export const ASK_QUESTION_HREF = `/posts/upload?category=${encodeURIComponent("질문")}`;

/** 빈 상태 카드 제목: 고정한 종이 하나면 "크레스티드 게코 키우며 궁금한 게 있나요?", 아니면 일반 문구(앱과 같다). */
export function askQuestionTitle(speciesName?: string | null): string {
  return speciesName ? `${speciesName} 키우며 궁금한 게 있나요?` : "키우며 궁금한 것 물어보기";
}

type AwaitingAnswerCardProps =
  | { variant?: "question"; question: AwaitingQuestion; className?: string }
  /** 답 없는 질문이 없을 때 같은 자리에 두는 '물어보기' 카드(2026-10-21 감사 #1, 시안 home-ia .wait.empty). */
  | { variant: "empty"; speciesName?: string | null; className?: string };

/**
 * 반려생활 '답 기다려요' 카드(시안 community-vibe .wait, PRD §3.5).
 * app-brand-surface r12(다크 회색 면, 2026-10-21), 아바타 40 · "질문 제목" 15/600 · 보조 12 brand-text-soft 두 줄
 * ('N일째 답을 기다리고 있어요' / '먼저 답하면 점수 2배') · '답하기' 36 주황 → 상세(본문부터).
 * variant="empty": 물음표 원 40(brand-track) · 질문 권유 15/600 · '질문을 올리면 관심 분야 브리더에게 알림이 가요' · '질문하기' 36 주황.
 */
export default function AwaitingAnswerCard(props: AwaitingAnswerCardProps) {
  const { className } = props;
  // 포유류만 고정한 계정은 '집사'로 부른다(scopeTerms, 앱과 같다).
  const { breeder } = useScopeTerms();
  if (props.variant === "empty") {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl bg-app-brand-surface px-3.5 py-3 ${className ?? ""}`}
        data-testid="awaiting-answer-empty"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-app-brand-track text-app-brand" aria-hidden="true">
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </span>
        <Link href={ASK_QUESTION_HREF} className="min-w-0 flex-1">
          <p className="line-clamp-2 break-keep text-[15px] font-semibold leading-5 text-app-text">
            {askQuestionTitle(props.speciesName)}
          </p>
          <p className="mt-0.5 break-keep text-[12px] leading-4 text-app-brand-text-soft">
            {withBreederWord("질문을 올리면 관심 분야 브리더에게 알림이 가요", breeder)}
          </p>
        </Link>
        <Link
          href={ASK_QUESTION_HREF}
          className="flex h-9 shrink-0 items-center rounded-lg bg-app-brand px-3.5 text-[14px] font-semibold text-white"
        >
          질문하기
        </Link>
      </div>
    );
  }
  const { question } = props;
  const href = toPostPath(question.id, question.title);
  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-app-brand-surface px-3.5 py-3 ${className ?? ""}`}
      data-testid="awaiting-answer-card"
    >
      <InitialAvatar name={question.user?.name} avatar={question.user?.avatar} size={40} />
      <Link href={href} className="min-w-0 flex-1">
        <p className="line-clamp-2 break-keep text-[15px] font-semibold leading-5 text-app-text">
          &ldquo;{question.title}&rdquo;
        </p>
        <p className="mt-0.5 break-keep text-[12px] leading-4 text-app-brand-text-soft">
          {waitingDurationLabel(question.createdAt)}
        </p>
        <p className="text-[12px] leading-4 text-app-brand-text-soft">{WAITING_BONUS_LINE}</p>
      </Link>
      <Link
        href={href}
        className="flex h-9 shrink-0 items-center rounded-lg bg-app-brand px-3.5 text-[14px] font-semibold text-white"
      >
        답하기
      </Link>
    </div>
  );
}
