"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@libs/client/utils";

export interface PostFilterOption {
  value: string;
  label: string;
}

/**
 * 반려생활 탭 종·정렬 텍스트 드롭다운(앱 PostFilterDropdown).
 * 트리거: 라벨 13/500 + 12px 화살표. 메뉴: 폭 150, 트리거 오른쪽 끝에 맞춰 아래 8px, 행 44, 선택 행 700 + 주황 체크.
 */
export function PostFilterDropdown({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: PostFilterOption[];
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="-m-2 flex items-center gap-0.5 p-2 text-[13px] font-medium text-app-text"
      >
        <span className="truncate">{selectedLabel}</span>
        <svg
          className={cn("h-3 w-3 text-app-muted transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={ariaLabel}
          className="absolute right-0 top-full z-30 mt-2 max-h-[260px] w-[150px] overflow-y-auto rounded-lg border border-app-border bg-app-elevated py-1 shadow-popover"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex h-11 w-full items-center gap-1.5 px-3.5 text-left transition-colors hover:bg-app-surface"
              >
                <span
                  className={cn(
                    "flex-1 truncate text-[14px]",
                    selected ? "font-bold text-app-text" : "font-medium text-app-muted"
                  )}
                >
                  {option.label}
                </span>
                {selected ? (
                  <svg
                    className="h-3.5 w-3.5 text-app-brand"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default PostFilterDropdown;
