/**
 * 작성 화면 이탈 확인(useConfirmLeave)의 순수 상태 머신.
 * DOM·라우터와 분리해 테스트한다.
 *
 * - dirty 이고 bypass 가 아니면 이탈을 막는다(shouldBlockLeave).
 * - 막힌 이탈 시도(attempt)는 prompt 에 대상을 담아 확인 창을 띄운다.
 * - 확인 창에서 "나가기"(confirm)를 누르면 bypass 를 켜고 대상을 돌려준다 — 호출부가 실제 이동을 한다.
 * - leave(fn)(allow)는 저장 성공 후 이동처럼 확인 없이 나가야 할 때 bypass 를 켠다.
 */

export type LeaveTarget =
  | { kind: "href"; href: string }
  | { kind: "back" }
  | { kind: "custom"; run: () => void };

export interface LeaveGuardState {
  dirty: boolean;
  bypass: boolean;
  prompt: LeaveTarget | null;
}

export type LeaveGuardEvent =
  | { type: "setDirty"; dirty: boolean }
  | { type: "attempt"; target: LeaveTarget }
  | { type: "cancel" }
  | { type: "confirm" }
  | { type: "allow" };

export const createLeaveGuardState = (dirty = false): LeaveGuardState => ({
  dirty,
  bypass: false,
  prompt: null,
});

export const shouldBlockLeave = (state: LeaveGuardState): boolean =>
  state.dirty && !state.bypass;

export interface LeaveGuardTransition {
  state: LeaveGuardState;
  /** 지금 바로 실행할 이동(막지 않았거나 확인 창에서 나가기를 눌렀을 때). */
  proceed: LeaveTarget | null;
}

export function leaveGuardTransition(
  state: LeaveGuardState,
  event: LeaveGuardEvent
): LeaveGuardTransition {
  switch (event.type) {
    case "setDirty":
      // 다시 작성을 시작하면(dirty false→true) 이전 bypass 는 풀지 않는다 — leave() 이후 이동 중이다.
      return { state: { ...state, dirty: event.dirty }, proceed: null };
    case "attempt":
      if (!shouldBlockLeave(state)) {
        return { state, proceed: event.target };
      }
      return { state: { ...state, prompt: event.target }, proceed: null };
    case "cancel":
      return { state: { ...state, prompt: null }, proceed: null };
    case "confirm":
      if (!state.prompt) return { state, proceed: null };
      return {
        state: { ...state, bypass: true, prompt: null },
        proceed: state.prompt,
      };
    case "allow":
      return { state: { ...state, bypass: true, prompt: null }, proceed: null };
    default:
      return { state, proceed: null };
  }
}

/** 같은 문서 안 이동으로 가로챌 a[href] 인지(새 탭·다운로드·외부·해시 이동은 제외). */
export function isInterceptableHref(
  href: string | null | undefined,
  currentHref: string,
  options: { target?: string | null; download?: boolean; modifier?: boolean } = {}
): boolean {
  if (!href) return false;
  if (options.modifier || options.download) return false;
  if (options.target && options.target !== "_self") return false;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
  let next: URL;
  let current: URL;
  try {
    current = new URL(currentHref);
    next = new URL(href, current);
  } catch {
    return false;
  }
  if (next.origin !== current.origin) return false;
  // 같은 페이지 안 해시 이동은 이탈이 아니다.
  if (
    next.pathname === current.pathname &&
    next.search === current.search &&
    next.hash !== current.hash
  ) {
    return false;
  }
  return true;
}
