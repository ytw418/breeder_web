"use client";
/**
 * 프로필 탭(앱 UnderlineTabs, 2026-10-09 v4 — 인스타그램·토스 참고): 같은 너비 칸, 높이 46, 15px.
 * 선택은 text 700 + 칸 너비 2px 밑줄, 비선택은 muted 500. 아래 1px line.
 * 스크롤하면 헤더(h-14) 바로 아래에 붙는다(sticky top-14).
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
}: {
  tabs: readonly UnderlineTab<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="sticky top-14 z-20 flex border-b border-app-line bg-app-bg">
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
              "relative h-[46px] min-w-0 flex-1 text-[15px] transition-colors",
              selected ? "font-bold text-app-text" : "font-medium text-app-muted hover:text-app-text"
            )}
          >
            {/* 말줄임은 라벨에만 건다. 버튼에 overflow 를 걸면 아래선에 겹치는 2px 밑줄이 1px 로 잘린다. */}
            <span className="block truncate px-1">{tab.label}</span>
            {selected ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-app-text" /> : null}
          </button>
        );
      })}
    </div>
  );
}
