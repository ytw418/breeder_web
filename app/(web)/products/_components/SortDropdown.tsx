"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@libs/client/utils";

export interface SortDropdownOption {
  value: string;
  label: string;
}

/**
 * 당근 톤 텍스트 드롭다운(앱 PostFilterDropdown): "라벨 13/500 + 화살표" 트리거, 아래로 150px 메뉴, 선택 체크.
 * 바깥 클릭·Escape 로 닫힌다.
 */
export function SortDropdown({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SortDropdownOption[];
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // 칩 줄이 가로 스크롤(overflow)이라 메뉴는 fixed 로 띄운다. 페이지든 칩 줄이든 어디가 스크롤되거나
    // 창 크기가 바뀌면 위치가 어긋나니 닫는다(캡처 단계라 요소 스크롤도 받는다).
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({ top: rect.bottom + 4, left: rect.left });
          setOpen((v) => !v);
        }}
        className="flex h-8 items-center gap-0.5 whitespace-nowrap text-[13px] font-medium text-app-text"
      >
        {selectedLabel}
        <svg
          className={cn("h-3 w-3 text-app-muted transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="fixed z-[60] w-[150px] overflow-hidden rounded-lg border border-app-border bg-app-elevated py-1 shadow-popover"
          style={{ top: anchor.top, left: anchor.left }}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setOpen(false);
                    if (!selected) onChange(option.value);
                  }}
                  className={cn(
                    "flex h-11 w-full items-center justify-between px-4 text-left text-[14px] hover:bg-app-surface",
                    selected ? "font-semibold text-app-text" : "text-app-sub"
                  )}
                >
                  {option.label}
                  {selected ? (
                    <svg className="h-4 w-4 text-app-text" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default SortDropdown;
