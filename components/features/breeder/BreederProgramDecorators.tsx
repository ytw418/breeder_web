"use client";

import { cn } from "@libs/client/utils";
import {
  getBreederProgramBenefitLabel,
  getPrimaryBreederProgram,
  sortBreederPrograms,
  type BreederProgramSummary,
  type BreederProgramType,
} from "@libs/shared/breeder-program";

/*
 * 아바타 프레임은 앱(bredy_app BreederProgramDecorators)처럼 유지한다: 라이트는 웹 원본 그라데이션 + 3px 링 + 6px 헤일로,
 * 다크는 가운데를 app-bg 로, 양 끝·링을 반투명으로 낮추고 헤일로를 끈다(다크 shadow none 규칙).
 * 뱃지는 2026-10-01 결정대로 목록·카드·상세에서 중립 회색 pill 하나로 통일하고,
 * 프로필 블록만 BreederProgramProfileBadges(컬러)를 쓴다(2026-10-09, 앱과 같은 색).
 */
const BREEDER_PROGRAM_META: Record<
  BreederProgramType,
  {
    label: string;
    frameClassName: string;
    /** 목록 카드의 16~20px 아바타용(앱 BreederProgramAvatar): 3px 링 없이 그라데이션 + 옅은 빛. */
    compactFrameClassName: string;
  }
> = {
  FOUNDING_BREEDER: {
    label: "창립 브리더",
    frameClassName:
      "bg-gradient-to-br from-amber-200 via-white to-amber-100 ring-[3px] ring-amber-400/75 shadow-[0_0_0_6px_rgba(251,191,36,0.12)] dark:from-amber-400/45 dark:via-app-bg dark:to-amber-400/20 dark:ring-amber-300/50 dark:shadow-none",
    compactFrameClassName:
      "bg-gradient-to-br from-amber-200 via-white to-amber-100 shadow-[0_0_0_6px_rgba(251,191,36,0.12)] dark:from-amber-400/45 dark:via-app-bg dark:to-amber-400/20 dark:shadow-none",
  },
  PARTNER_BREEDER: {
    label: "파트너 브리더",
    frameClassName:
      "bg-gradient-to-br from-cyan-100 via-white to-slate-100 ring-[3px] ring-cyan-400/70 shadow-[0_0_0_6px_rgba(34,211,238,0.10)] dark:from-cyan-400/40 dark:via-app-bg dark:to-slate-400/20 dark:ring-cyan-300/50 dark:shadow-none",
    compactFrameClassName:
      "bg-gradient-to-br from-cyan-100 via-white to-slate-100 shadow-[0_0_0_6px_rgba(34,211,238,0.10)] dark:from-cyan-400/40 dark:via-app-bg dark:to-slate-400/20 dark:shadow-none",
  },
  VERIFIED_BREEDER: {
    label: "인증 브리더",
    frameClassName:
      "bg-gradient-to-br from-slate-100 via-white to-slate-50 ring-[3px] ring-slate-300 shadow-[0_0_0_6px_rgba(148,163,184,0.10)] dark:from-slate-400/35 dark:via-app-bg dark:to-slate-400/20 dark:ring-slate-400/50 dark:shadow-none",
    compactFrameClassName:
      "bg-gradient-to-br from-slate-100 via-white to-slate-50 shadow-[0_0_0_6px_rgba(148,163,184,0.10)] dark:from-slate-400/35 dark:via-app-bg dark:to-slate-400/20 dark:shadow-none",
  },
};

export const getActiveBreederPrograms = (
  programs?: BreederProgramSummary[] | null
) =>
  sortBreederPrograms((programs || []).filter((program) => program.status === "ACTIVE"));

export const getPrimaryBreederBenefitLabel = (
  programs?: BreederProgramSummary[] | null
) => {
  const primaryProgram = getPrimaryBreederProgram(getActiveBreederPrograms(programs));
  return primaryProgram ? getBreederProgramBenefitLabel(primaryProgram) : null;
};

export const getBreederProgramFrameClassName = (
  programs?: BreederProgramSummary[] | null,
  { compact = false }: { compact?: boolean } = {}
) => {
  const primaryProgram = getPrimaryBreederProgram(getActiveBreederPrograms(programs));
  if (!primaryProgram) return "";
  const meta = BREEDER_PROGRAM_META[primaryProgram.programType];
  return compact ? meta.compactFrameClassName : meta.frameClassName;
};

export const hasBreederProgramFrame = (programs?: BreederProgramSummary[] | null) =>
  Boolean(getPrimaryBreederProgram(getActiveBreederPrograms(programs)));

const formatFoundingNo = (value?: number | null) => {
  if (!value) return "";
  return `No.${String(value).padStart(3, "0")}`;
};

/** 뱃지 라벨. 창립 브리더는 번호를 붙인다("창립 브리더 No.001"). */
export const getBreederProgramLabel = (
  program: Pick<BreederProgramSummary, "programType" | "foundingNo">
) => {
  const label = BREEDER_PROGRAM_META[program.programType].label;
  if (program.programType !== "FOUNDING_BREEDER") return label;
  const no = formatFoundingNo(program.foundingNo);
  return no ? `${label} ${no}` : label;
};

const NEUTRAL_PILL_CLASS =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded bg-app-surface px-1.5 py-0.5 text-[12px] font-normal leading-4 text-app-muted";

type BreederProgramBadgeProps = {
  programs?: BreederProgramSummary[] | null;
  className?: string;
};

/**
 * 브리더 프로그램 뱃지(파트너·창립·인증). 중립 회색 pill(app-surface 배경 · app-muted 12px · r4 · 6/2).
 * 활성 프로그램이 없으면 아무것도 그리지 않는다. 여러 개면 우선순위 순으로 나란히 그린다.
 */
export const BreederProgramBadge = ({ programs, className }: BreederProgramBadgeProps) => {
  const activePrograms = getActiveBreederPrograms(programs);
  if (!activePrograms.length) return null;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {activePrograms.map((program) => (
        <span key={program.id} className={NEUTRAL_PILL_CLASS}>
          {getBreederProgramLabel(program)}
        </span>
      ))}
    </span>
  );
};

type BreederProgramBadgeListProps = {
  programs?: BreederProgramSummary[] | null;
  className?: string;
  /** 호환용. 중립 pill 통일 이후 크기 차이는 없다. */
  compact?: boolean;
};

/** 기존 호출부 호환용. BreederProgramBadge 와 같은 중립 pill 이다. */
export const BreederProgramBadgeList = ({ programs, className }: BreederProgramBadgeListProps) => (
  <BreederProgramBadge programs={programs} className={className} />
);

/*
 * 프로필 블록 전용 컬러 뱃지(2026-10-09 사용자 결정: "창립·파트너 브리더 뱃지가 멋져 보이게").
 * 앱 BreederProgramProfileBadges 와 같은 값: 라이트 amber·cyan·slate 50/200/800 + 글리프 500,
 * 다크 반투명 배경·테두리 + 300 글자 + 400 글리프.
 */
const PROFILE_BADGE_META: Record<
  BreederProgramType,
  { pillClassName: string; glyphClassName: string; glyph: "star" | "check" }
> = {
  FOUNDING_BREEDER: {
    pillClassName:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/[0.38] dark:bg-amber-400/[0.14] dark:text-amber-300",
    glyphClassName: "text-amber-500 dark:text-amber-400",
    glyph: "star",
  },
  PARTNER_BREEDER: {
    pillClassName:
      "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-400/[0.34] dark:bg-cyan-400/[0.12] dark:text-cyan-300",
    glyphClassName: "text-cyan-500 dark:text-cyan-400",
    glyph: "check",
  },
  VERIFIED_BREEDER: {
    pillClassName:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-400/[0.32] dark:bg-slate-400/[0.14] dark:text-slate-300",
    glyphClassName: "text-slate-500 dark:text-slate-400",
    glyph: "check",
  },
};

// heroicons v2 solid star / check-badge(evenodd 로 체크를 뚫는다). 앱과 같은 path.
const GLYPH_PATHS = {
  star: "M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z",
  check:
    "M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z",
} as const;

/** 프로필 블록 컬러 뱃지: 높이 24 · rounded-full · 1px 테두리 · 글리프 14 + 12/700. */
export const BreederProgramProfileBadges = ({
  programs,
}: {
  programs?: BreederProgramSummary[] | null;
}) => {
  const activePrograms = getActiveBreederPrograms(programs);
  if (!activePrograms.length) return null;
  return (
    <>
      {activePrograms.map((program) => {
        const meta = PROFILE_BADGE_META[program.programType];
        return (
          <span
            key={program.id}
            className={cn(
              "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border pl-[7px] pr-[9px] text-[12px] font-bold leading-none",
              meta.pillClassName
            )}
          >
            <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden className={meta.glyphClassName}>
              <path d={GLYPH_PATHS[meta.glyph]} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
            </svg>
            {getBreederProgramLabel(program)}
          </span>
        );
      })}
    </>
  );
};
