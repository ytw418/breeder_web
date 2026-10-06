"use client";

import type { ReactNode } from "react";
import { cn } from "@libs/client/utils";

/**
 * 공통 필터 칩(앱 FilterChip, 채팅 시안 .chip). h32 r16 px14 13px.
 * - 비선택: app-bg 배경 + app-border 테두리 + app-sub 500 글자
 * - 선택: app-text 채움·테두리 + app-bg 글자 600
 * count 는 라벨 뒤 숫자(같은 색, 굵기 한 단계 위).
 */
export function FilterChip({
  label,
  count,
  selected,
  onClick,
  className,
}: {
  label: string;
  count?: number | string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  const hasCount = count !== undefined && count !== null;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-2xl border px-3.5 text-[13px] transition-colors",
        selected
          ? "border-app-text bg-app-text font-semibold text-app-bg"
          : "border-app-border bg-app-bg font-medium text-app-sub hover:bg-app-surface",
        className
      )}
    >
      <span>{label}</span>
      {hasCount ? (
        <span className={selected ? "font-bold" : "font-semibold"}>{count}</span>
      ) : null}
    </button>
  );
}

/** 칩 가로 레일: h44 px16 gap8 가로 스크롤. sticky 면 헤더(h-14) 아래 고정. */
export function FilterChipRail({
  children,
  sticky = false,
  className,
}: {
  children: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2 overflow-x-auto px-4 scrollbar-hide",
        sticky && "sticky top-14 z-10 bg-app-bg",
        className
      )}
    >
      {children}
    </div>
  );
}

export default FilterChip;
