"use client";

import { cn } from "@libs/client/utils";
import {
  getBreederProgramBenefitLabel,
  getPrimaryBreederProgram,
  sortBreederPrograms,
  type BreederProgramSummary,
  type BreederProgramType,
} from "@libs/shared/breeder-program";

const BREEDER_PROGRAM_META: Record<
  BreederProgramType,
  {
    label: string;
    frameClassName: string;
    badgeClassName: string;
  }
> = {
  FOUNDING_BREEDER: {
    label: "창립 브리더",
    frameClassName:
      "bg-gradient-to-br from-amber-200 via-white to-amber-100 ring-[3px] ring-amber-400/75 shadow-[0_0_0_6px_rgba(251,191,36,0.12)]",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
  },
  PARTNER_BREEDER: {
    label: "파트너 브리더",
    frameClassName:
      "bg-gradient-to-br from-cyan-100 via-white to-slate-100 ring-[3px] ring-cyan-400/70 shadow-[0_0_0_6px_rgba(34,211,238,0.10)]",
    badgeClassName: "border-cyan-200 bg-cyan-50 text-cyan-800",
  },
  VERIFIED_BREEDER: {
    label: "인증 브리더",
    frameClassName:
      "bg-gradient-to-br from-slate-100 via-white to-slate-50 ring-[3px] ring-slate-300 shadow-[0_0_0_6px_rgba(148,163,184,0.10)]",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
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

type BreederProgramBadgeListProps = {
  programs?: BreederProgramSummary[] | null;
  className?: string;
  compact?: boolean;
};

export const BreederProgramBadgeList = ({
  programs,
  className,
  compact = false,
}: BreederProgramBadgeListProps) => {
  const activePrograms = getActiveBreederPrograms(programs);
  if (!activePrograms.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {activePrograms.map((program) => {
        const meta = BREEDER_PROGRAM_META[program.programType];
        return (
          <span
            key={program.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-semibold",
              compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
              meta.badgeClassName
            )}
          >
            <span>{meta.label}</span>
            {program.programType === "FOUNDING_BREEDER" && program.foundingNo ? (
              <span className="opacity-80">{formatFoundingNo(program.foundingNo)}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
};
