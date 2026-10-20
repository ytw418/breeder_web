"use client";

import { useCallback, useEffect, useRef } from "react";

const LONG_PRESS_MS = 500;
/** 손가락이 이만큼 움직이면 스크롤로 보고 길게 누르기를 취소한다. */
const MOVE_TOLERANCE_PX = 10;

/**
 * 목록 행 길게 누르기(터치)·우클릭(마우스). 길게 누른 직후의 click 은 막아 행이 열리지 않게 한다.
 * 반환한 핸들러를 행(Link)에 그대로 펼친다.
 */
export function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  return {
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") return;
      firedRef.current = false;
      startRef.current = { x: event.clientX, y: event.clientY };
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        clear();
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: React.PointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      if (Math.abs(event.clientX - start.x) > MOVE_TOLERANCE_PX || Math.abs(event.clientY - start.y) > MOVE_TOLERANCE_PX) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault();
      if (firedRef.current) return;
      // 안드로이드 크롬은 길게 누르면 contextmenu 가 먼저 올 수 있다. 그때도 뒤따르는 click 을 막는다.
      const fromTouch = startRef.current !== null;
      clear();
      if (fromTouch) firedRef.current = true;
      onLongPress();
    },
    onClick: (event: React.MouseEvent) => {
      if (!firedRef.current) return;
      firedRef.current = false;
      event.preventDefault();
    },
  };
}
