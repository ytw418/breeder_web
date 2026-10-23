"use client";

import type { ReactNode } from "react";
import {
  PET_POST_KINDS,
  PET_WRITE_STEP_COUNT,
  petWriteProgress,
  type PetPostKind,
  type PetWriteStep,
} from "@libs/shared/petSpace";

/**
 * 강아지·고양이 단계 글쓰기 조각(앱 docs/prd/pet-space.md §5.11, 시안 pet-space/B-toss.html ④ — 토스 리뷰 결정 A).
 * 헤더 바로 아래 3px 단계 막대, 단계 제목(작은 글 종류 + 질문 24), ① 글 종류 카드 3장. 앱 src/components/features/pet/PetWriteSteps.tsx 와 같다.
 */

/** 헤더 아래 붙는 단계 막대(바탕 surface, 채움 text). */
export function PetWriteProgress({ step }: { step: PetWriteStep }) {
  return (
    <div
      role="progressbar"
      aria-label="글쓰기 단계"
      aria-valuemin={1}
      aria-valuemax={PET_WRITE_STEP_COUNT}
      aria-valuenow={step}
      className="sticky top-14 z-20 h-[3px] w-full bg-app-surface"
    >
      <div
        className="h-full bg-app-text transition-[width] duration-200"
        style={{ width: `${petWriteProgress(step) * 100}%` }}
      />
    </div>
  );
}

/** 단계 제목: 고른 글 종류(15/600 brandText, ②·③만) + 질문 한 줄(24/32/700). */
export function PetWriteHeading({ caption, title }: { caption?: string | null; title: string }) {
  return (
    <div className="mb-1">
      {caption ? <p className="text-[15px] font-semibold leading-[22px] text-app-brand-text">{caption}</p> : null}
      <h1 className={caption ? "app-t-question mt-1 break-keep" : "app-t-question break-keep"}>{title}</h1>
    </div>
  );
}

/** 시안 ④-1 아이콘(선 24): 분양해요 집, 가족 찾아요 하트, 임보 구해요 손. */
const KIND_ICONS: Record<PetPostKind, ReactNode> = {
  adoption: <path d="M4 10.5 12 4l8 6.5V20h-5v-6h-6v6H4z" strokeLinejoin="round" />,
  rehoming: (
    <path
      d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"
      strokeLinejoin="round"
    />
  ),
  foster: (
    <path
      d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L4 14a1.5 1.5 0 0 1 2.5-1.6L8 14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

/**
 * ① 어떤 글인가요 카드 3장(높이 98 이상 r12, 회색 면 + 흰 아이콘 칸 44 + 이름 16/600 · 뜻 13 muted + ›).
 * 누르면 그 글 종류로 ②에 간다(고르는 표시·'다음' 버튼 없음).
 */
export function PetKindCards({ onPick, disabled }: { onPick: (kind: PetPostKind) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-3" data-testid="pet-kind-cards">
      {PET_POST_KINDS.map((kind) => (
        <button
          key={kind.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(kind.id)}
          className="flex min-h-[98px] w-full items-center gap-3.5 rounded-xl bg-app-gap p-4 text-left disabled:opacity-50"
        >
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-app-bg text-app-brand-text"
          >
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              {KIND_ICONS[kind.id]}
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold leading-[22px] text-app-text">{kind.label}</span>
            <span className="mt-0.5 block break-keep text-[13px] leading-[18px] text-app-muted">{kind.hint}</span>
          </span>
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0 text-app-caption"
          >
            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
