"use client";

import { HorizontalRail } from "@components/ui/HorizontalRail";
import { cn } from "@libs/client/utils";
import { ALL_SUBCATEGORY } from "@libs/shared/subcategoryChips";

/**
 * 대분류 칩 아래 소분류 칩 줄(홈 분양·반려생활 종, 2026-10-12). 앱 SubcategoryChipRow 와 같은 모양.
 * 대분류 칩(검정 채움)보다 한 단계 낮게 h28 r14 surface 채움, 선택은 brand-soft 채움 + brand-text 600.
 */
export default function SubcategoryChipRow({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly string[];
  /** "" = 전체 */
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  if (options.length === 0) return null;
  return (
    <HorizontalRail
      label="소분류"
      className={cn("h-11 items-center gap-1.5 px-4", className)}
      data-testid="subcategory-chips"
    >
      {[ALL_SUBCATEGORY, ...options].map((chip) => {
        const selected = chip === value;
        return (
          <button
            key={chip || "전체"}
            type="button"
            aria-pressed={selected}
            aria-label={chip ? `소분류 ${chip}` : "소분류 전체"}
            onClick={() => onChange(chip)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-[14px] px-3 text-[13px] transition-colors",
              selected
                ? "bg-app-brand-soft font-semibold text-app-brand-text"
                : "bg-app-surface font-medium text-app-sub"
            )}
          >
            {chip || "전체"}
          </button>
        );
      })}
    </HorizontalRail>
  );
}
