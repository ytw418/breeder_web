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
 * 뱃지는 2026-10-01 결정대로 모든 화면에서 중립 회색 pill 하나로 통일한다.
 */
const BREEDER_PROGRAM_META: Record<
  BreederProgramType,
  {
    label: string;
    frameClassName: string;
  }
> = {
  FOUNDING_BREEDER: {
    label: "창립 브리더",
    frameClassName:
      "bg-gradient-to-br from-amber-200 via-white to-amber-100 ring-[3px] ring-amber-400/75 shadow-[0_0_0_6px_rgba(251,191,36,0.12)] dark:from-amber-400/45 dark:via-app-bg dark:to-amber-400/20 dark:ring-amber-300/50 dark:shadow-none",
  },
  PARTNER_BREEDER: {
    label: "파트너 브리더",
    frameClassName:
      "bg-gradient-to-br from-cyan-100 via-white to-slate-100 ring-[3px] ring-cyan-400/70 shadow-[0_0_0_6px_rgba(34,211,238,0.10)] dark:from-cyan-400/40 dark:via-app-bg dark:to-slate-400/20 dark:ring-cyan-300/50 dark:shadow-none",
  },
  VERIFIED_BREEDER: {
    label: "인증 브리더",
    frameClassName:
      "bg-gradient-to-br from-slate-100 via-white to-slate-50 ring-[3px] ring-slate-300 shadow-[0_0_0_6px_rgba(148,163,184,0.10)] dark:from-slate-400/35 dark:via-app-bg dark:to-slate-400/20 dark:ring-slate-400/50 dark:shadow-none",
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
  programs?: BreederProgramSummary[] | null
) => {
  const primaryProgram = getPrimaryBreederProgram(getActiveBreederPrograms(programs));
  if (!primaryProgram) return "";
  return BREEDER_PROGRAM_META[primaryProgram.programType].frameClassName;
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
