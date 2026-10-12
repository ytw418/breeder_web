"use client";

import { useEffect, useRef } from "react";

/**
 * 가로 레일을 마우스로 끌어서 넘기게 한다(터치는 브라우저가 이미 가로 스크롤한다).
 * 5px 넘게 끌었으면 그 뒤 클릭(링크 이동)을 한 번 막는다.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let moved = false;
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startLeft = el.scrollLeft;
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      if (!moved && Math.abs(dx) > 5) moved = true;
      if (moved) {
        el.scrollLeft = startLeft - dx;
        event.preventDefault();
      }
    };
    const onUp = () => {
      dragging = false;
    };
    const onClick = (event: MouseEvent) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      }
    };
    const onDragStart = (event: DragEvent) => event.preventDefault();
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("click", onClick, true);
    el.addEventListener("dragstart", onDragStart);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("dragstart", onDragStart);
    };
  }, []);
  return ref;
}

/** 홈 가로 레일 공통 클래스: 가로 스크롤 · 스크롤바 숨김 · 좌우 16 · 간격 8. */
export const HOME_RAIL_CLASS =
  "flex gap-2 overflow-x-auto overscroll-x-contain px-4 scrollbar-hide [-webkit-overflow-scrolling:touch]";
