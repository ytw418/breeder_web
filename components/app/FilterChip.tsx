"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HorizontalRail } from "@components/ui/HorizontalRail";
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

/**
 * 칩 가로 레일: h44 px16 gap8 가로 스크롤. sticky 면 헤더(h-14) 아래 고정.
 * scrollHint: 오른쪽으로 더 넘길 수 있는 동안에만 오른쪽 끝에 배경색으로 흐려지는 32px 띠를 덮는다(터치 통과, 다크는 --app-bg 를 따른다).
 * 끝까지 넘기거나 칩이 다 들어가면 사라진다. 홈 칩 줄이 쓴다(2026-10-25 "칩이 더 있는 줄 모른다").
 */
export function FilterChipRail({
  children,
  sticky = false,
  className,
  scrollHint = false,
}: {
  children: ReactNode;
  sticky?: boolean;
  className?: string;
  scrollHint?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollMore, setCanScrollMore] = useState(false);

  useEffect(() => {
    if (!scrollHint) return;
    const el = railRef.current;
    if (!el) return;
    const update = () => setCanScrollMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // 칩 너비는 선택(굵기)·글꼴 로드로 바뀌므로 레일과 칩 크기 변화를 따라간다.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (observer) {
      observer.observe(el);
      Array.from(el.children).forEach((child) => observer.observe(child));
    }
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [scrollHint]);

  const railClassName = cn(
    "h-11 items-center gap-2 px-4",
    sticky && !scrollHint && "sticky top-14 z-10 bg-app-bg",
    className
  );
  if (!scrollHint) return <HorizontalRail className={railClassName}>{children}</HorizontalRail>;
  return (
    <div className={cn("relative", sticky && "sticky top-14 z-10 bg-app-bg")}>
      <HorizontalRail ref={railRef} className={railClassName}>
        {children}
      </HorizontalRail>
      <span
        aria-hidden="true"
        data-testid="chip-rail-fade"
        data-visible={canScrollMore ? "true" : "false"}
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-app-bg transition-opacity duration-150",
          canScrollMore ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

export default FilterChip;
