/**
 * 목록 FAB 숨김 규칙(2026-10-21 디자인 리뷰 — "FAB 가 카드 버튼·메타를 가린다").
 * 아래로 내리면 FAB 를 숨기고, 위로 올리거나 맨 위 근처로 돌아오면 다시 보여 준다.
 * 손 떨림 같은 작은 움직임(FAB_SCROLL_STEP 미만)은 방향으로 치지 않고 기준 위치를 그대로 둔다.
 * 앱 bredy_app src/lib/fabScroll.ts 와 같은 파일이다(웹 jest __tests__/fabScroll.test.ts·앱 node --test scripts/test-fab-scroll.mjs).
 */

/** 이 높이 안(맨 위 근처)에서는 항상 보인다. */
export const FAB_TOP_ZONE = 24;
/** 이만큼 움직여야 방향을 바꾼다. */
export const FAB_SCROLL_STEP = 8;

export type FabScrollState = { y: number; hidden: boolean };

export const FAB_SCROLL_INITIAL: FabScrollState = { y: 0, hidden: false };

/**
 * 스크롤 위치 y(바운스를 빼고 0~끝으로 자른 값)를 받아 다음 상태를 돌려준다.
 * 움직임이 작으면 이전 상태 객체를 그대로 돌려준다(기준 위치가 쌓여 천천히 내려도 결국 숨는다).
 */
export function nextFabScroll(prev: FabScrollState, y: number): FabScrollState {
  if (y <= FAB_TOP_ZONE) return { y, hidden: false };
  const dy = y - prev.y;
  if (Math.abs(dy) < FAB_SCROLL_STEP) return prev;
  return { y, hidden: dy > 0 };
}

/** 스크롤 값 y 를 0~(내용 높이 − 보이는 높이)로 자른다(iOS 바운스·당겨서 새로고침에 흔들리지 않게). */
export function clampScrollY(y: number, contentHeight: number, viewportHeight: number): number {
  const max = Math.max(0, contentHeight - viewportHeight);
  return Math.min(Math.max(0, y), max);
}
