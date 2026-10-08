"use client";
/**
 * 밑줄 탭(앱 UnderlineTabs, 시안 `.tabs`): 높이 48, 15px, 간격 24, 선택은 text 700 + 2px 밑줄, 아래 1px line.
 * scrollable 이면 가로 스크롤(마이페이지처럼 탭이 많을 때).
 */
import { cn } from "@libs/client/utils";

export interface UnderlineTab<T extends string> {
  id: T;
  label: string;
}

export default function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  scrollable = false,
}: {
  tabs: readonly UnderlineTab<T>[];
  active: T;
  onChange: (id: T) => void;
  scrollable?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-6 border-b border-app-line px-4",
        scrollable && "overflow-x-auto whitespace-nowrap scrollbar-hide"
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px h-12 shrink-0 border-b-2 text-[15px] transition-colors",
              selected
                ? "border-app-text font-bold text-app-text"
                : "border-transparent font-normal text-app-muted hover:text-app-text"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
