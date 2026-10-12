"use client";
/**
 * 가로 레일(칩·카드·사진 줄) 공용. 터치는 브라우저 기본 가로 스크롤을 그대로 쓰고,
 * 데스크톱 마우스에서도 넘길 수 있게 한다(2026-10-12 사용자 "모바일로는 되는데 웹 브라우저에서 잘 안 되네").
 * - 마우스 끌기: 5px 넘게 끌면 스크롤하고 그 뒤 클릭(카드 이동)은 한 번 막는다. 끌지 않은 클릭은 그대로 간다.
 * - 세로 휠 → 가로 스크롤: 레일이 넘칠 때만. 끝에 닿으면 페이지 세로 스크롤로 넘긴다.
 * - 키보드: 레일에 포커스가 있으면 ←/→ 로 넘긴다.
 * - 스크롤바 숨김, overscroll-x contain, 마우스 기기에서만 grab 커서.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, type HTMLAttributes, type RefObject } from "react";
import { cn } from "@libs/client/utils";

export const RAIL_DRAG_THRESHOLD = 5;

/** 기존 컨테이너(ref)에 마우스 끌기·휠·키보드 가로 스크롤을 붙인다. */
export function useRailScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let moved = false;
    let suppressClick = false;
    let prevSnap = "";
    let prevBehavior = "";

    const canScroll = () => el.scrollWidth > el.clientWidth + 1;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !canScroll()) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startLeft = el.scrollLeft;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      if (!moved) {
        if (Math.abs(dx) <= RAIL_DRAG_THRESHOLD) return;
        moved = true;
        // 끄는 동안엔 스냅·부드러운 스크롤을 끄고(손을 따라오게), 놓으면 되돌린다.
        prevSnap = el.style.scrollSnapType;
        prevBehavior = el.style.scrollBehavior;
        el.style.scrollSnapType = "none";
        el.style.scrollBehavior = "auto";
        el.dataset.dragging = "true";
      }
      el.scrollLeft = startLeft - dx;
      event.preventDefault();
    };
    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        suppressClick = true;
        el.style.scrollSnapType = prevSnap;
        el.style.scrollBehavior = prevBehavior;
        delete el.dataset.dragging;
        // 클릭이 안 오면(레일 밖에서 놓음) 다음 클릭을 막지 않도록 곧 푼다.
        window.setTimeout(() => {
          suppressClick = false;
        }, 0);
      }
    };
    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onDragStart = (event: DragEvent) => event.preventDefault();
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || !canScroll()) return;
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return; // 트랙패드 가로 스와이프는 기본 동작
      const max = el.scrollWidth - el.clientWidth;
      const atStart = el.scrollLeft <= 0 && event.deltaY < 0;
      const atEnd = el.scrollLeft >= max - 1 && event.deltaY > 0;
      if (atStart || atEnd) return; // 끝에 닿으면 페이지를 내린다
      event.preventDefault();
      el.scrollBy({ left: event.deltaY, behavior: "auto" });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      if (!canScroll()) return;
      event.preventDefault();
      const step = Math.max(80, Math.round(el.clientWidth * 0.6));
      el.scrollBy({ left: event.key === "ArrowRight" ? step : -step });
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKeyDown);
    };
  }, [ref]);
}

/** 가로 레일 기본 클래스(스크롤바 숨김·overscroll contain·마우스 기기 grab 커서). 간격·여백은 쓰는 쪽이 붙인다. */
export const RAIL_BASE_CLASS =
  "flex overflow-x-auto overscroll-x-contain scrollbar-hide [-webkit-overflow-scrolling:touch] [@media(hover:hover)]:cursor-grab data-[dragging=true]:cursor-grabbing data-[dragging=true]:select-none focus-visible:outline-none";

export type HorizontalRailProps = HTMLAttributes<HTMLDivElement> & {
  /** 레일 이름(스크린 리더·키보드 포커스용). */
  label?: string;
};

/** 가로 레일 컨테이너. `className` 으로 gap·px·높이 등을 붙인다. */
export const HorizontalRail = forwardRef<HTMLDivElement, HorizontalRailProps>(function HorizontalRail(
  { label, className, children, tabIndex, ...rest },
  forwardedRef
) {
  const ref = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current as HTMLDivElement);
  useRailScroll(ref);
  return (
    <div
      ref={ref}
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={tabIndex ?? (label ? 0 : undefined)}
      className={cn(RAIL_BASE_CLASS, className)}
      {...rest}
    >
      {children}
    </div>
  );
});

export default HorizontalRail;
