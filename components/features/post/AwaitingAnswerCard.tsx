"use client";

import Link from "next/link";
import { InitialAvatar } from "@components/ui/InitialAvatar";
import { toPostPath } from "@libs/post-route";

export type AwaitingQuestion = {
  id: number;
  title: string;
  createdAt: string | Date;
  user?: { id?: number; name: string; avatar?: string | null } | null;
};

/** '2시간째 답이 없어요'. 1시간 안이면 분, 하루 넘으면 일. */
export function waitingDurationLabel(createdAt: string | Date, now: number = Date.now()): string {
  const t = (createdAt instanceof Date ? createdAt : new Date(createdAt)).getTime();
  if (Number.isNaN(t)) return "답을 기다리고 있어요";
  const minutes = Math.max(1, Math.floor((now - t) / 60_000));
  if (minutes < 60) return `${minutes}분째 답이 없어요`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간째 답이 없어요`;
  return `${Math.floor(hours / 24)}일째 답이 없어요`;
}

/**
 * 반려생활 '답 기다려요' 카드(시안 community-vibe .wait, PRD §3.5).
 * app-brand-soft r12, 아바타 40 · "질문 제목" 15/600 · 보조 12 brand-text-soft · '답하기' 36 주황 → 상세 #comment.
 */
export default function AwaitingAnswerCard({
  question,
  className,
}: {
  question: AwaitingQuestion;
  className?: string;
}) {
  const href = `${toPostPath(question.id, question.title)}#comment`;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-app-brand-soft px-3.5 py-3 ${className ?? ""}`}
      data-testid="awaiting-answer-card"
    >
      <InitialAvatar name={question.user?.name} avatar={question.user?.avatar} size={40} />
      <Link href={href} className="min-w-0 flex-1">
        <p className="line-clamp-2 break-keep text-[15px] font-semibold leading-5 text-app-text">
          &ldquo;{question.title}&rdquo;
        </p>
        <p className="mt-0.5 text-[12px] leading-4 text-app-brand-text-soft">
          {waitingDurationLabel(question.createdAt)} · 첫 답변은 소통왕 점수 2배
        </p>
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
