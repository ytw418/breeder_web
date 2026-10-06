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

/**
 * 뒤로가기 감지용 history 센티널(같은 URL 한 칸)의 상태.
 * 이탈이 허용되면(leave(fn), 확인 창 나가기, dirty→clean) 이동 전에 센티널을 history.back() 으로 걷어 내야
 * 다음 화면에서 뒤로가기를 눌렀을 때 작성 화면으로 돌아오지 않는다.
 * - present: 센티널이 history 맨 위에 있다
 * - popping: 걷어 내려고 back() 을 불렀고 popstate 를 기다리는 중
 */
export interface SentinelState {
  present: boolean;
  popping: boolean;
}

export const createSentinelState = (): SentinelState => ({ present: false, popping: false });

/** 지금 센티널을 새로 쌓아도 되는지(이미 있거나 걷어 내는 중이면 안 된다). */
export const canPushSentinel = (state: SentinelState): boolean =>
  !state.present && !state.popping;

export const sentinelPushed = (state: SentinelState): SentinelState => ({
  ...state,
  present: true,
});

/**
 * 센티널을 걷어 낸 뒤 이어서 실행할 일이 있을 때의 계획.
 * - "back": history.back() 을 부르고 popstate 뒤에 실행
 * - "wait": 이미 걷어 내는 중 — 같은 popstate 뒤에 실행
 * - "run": 센티널이 없다 — 바로 실행
 */
export function planSentinelRemoval(state: SentinelState): {
  state: SentinelState;
  plan: "back" | "wait" | "run";
} {
  if (state.present) return { state: { present: false, popping: true }, plan: "back" };
  if (state.popping) return { state, plan: "wait" };
  return { state, plan: "run" };
}

/**
 * popstate 를 받았을 때.
 * - removal: 우리가 걷어 낸 back() 의 결과 → 대기 중인 이동을 실행
 * - userBack: 사용자가 뒤로가기로 센티널을 뺐다 → 막아야 하면 확인 창
 * - ignore: 센티널과 무관한 이동
 */
export function sentinelOnPopState(state: SentinelState): {
  state: SentinelState;
  kind: "removal" | "userBack" | "ignore";
} {
  if (state.popping) return { state: { present: false, popping: false }, kind: "removal" };
  if (state.present) return { state: { present: false, popping: false }, kind: "userBack" };
  return { state, kind: "ignore" };
}
