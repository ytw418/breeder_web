type PostHogLike = {
  capture?: (eventName: string, properties?: Record<string, unknown>) => void;
  identify?: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset?: () => void;
  get_distinct_id?: () => string;
};

type EventProperties = Record<string, unknown>;

const MAX_STACK_LENGTH = 2000;

/**
 * app/layout.tsx 스니펫의 stub 메서드 목록. array.js 가 뜨기 전에 부른 메서드는 여기 있어야 큐에 쌓였다가 실행된다.
 * identify 가 빠져 있으면 스크립트보다 먼저 끝난 로그인 사용자 조회의 identify 가 사라진다.
 */
export const POSTHOG_STUB_METHODS =
  "init capture identify register register_once register_for_session unregister unregister_for_session reset alias set_config set_persistence opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_session_replay_url";

/**
 * posthog.init 옵션(api_host 제외). capture_pageview 를 true 로 두면 첫 로드만 세고
 * 웹 안 화면 이동(router.push)은 페이지뷰로 남지 않는다 — 'history_change' 로 둔다.
 */
export const POSTHOG_INIT_OPTIONS = {
  capture_pageview: "history_change",
  capture_pageleave: true,
  defaults: "2026-01-30",
} as const;

/**
 * posthog.init 의 before_send. app/layout.tsx 인라인 스크립트에 그대로 넣어야 해서 함수가 아니라 JS 원문이다
 * (빌드가 바꾸지 않게 바깥 변수·문법 변환에 기대지 않는다). 테스트는 이 원문을 평가해 확인한다.
 * 자동 수집 오류($exception)를 진짜 버그와 아닌 것으로 나눈다:
 * - 버림: 인스타·페북·네이버 앱 안 브라우저가 심은 스크립트 오류(우리 코드가 아님), 정보 없는 교차 출처 'Script error.'
 * - 남기되 bredy_error_kind 표시: hydration(React #418·#423·#425, 앱 안 브라우저가 DOM 을 고치거나 시간 글자가 달라
 *   생긴다 — 화면은 다시 그려져 멀쩡하다), third_party(Firebase 로그인 내부 단언), 나머지는 app(= 진짜 버그 후보)
 */
export const POSTHOG_BEFORE_SEND_SOURCE = `function (event) {
  if (!event || event.event !== "$exception") return event;
  var props = event.properties || {};
  var list = props.$exception_list || [];
  var text = "";
  for (var i = 0; i < list.length; i++) text += " " + (list[i] && list[i].value || "");
  if (props.$exception_values) text += " " + [].concat(props.$exception_values).join(" ");
  if (/Java object is gone|window\\.webkit\\.messageHandlers|_pcmBridgeCallbackHandler/.test(text)) return null;
  if (/^\\s*Script error\\.?\\s*$/.test(text)) return null;
  var kind = "app";
  if (/Minified React error #(418|423|425)\\b|Hydration failed|did not match/.test(text)) kind = "hydration";
  else if (/INTERNAL ASSERTION FAILED: Pending promise was never set/.test(text)) kind = "third_party";
  props.bredy_error_kind = kind;
  event.properties = props;
  return event;
}`;

/** 비로그인 방문자의 401 은 정상 흐름이라 오류 이벤트로 보내지 않는다(오류 지표가 묻힌다). */
export const isExpectedAuthStatus = (status: number | undefined) => status === 401;

const getPostHog = (): PostHogLike | null => {
  if (typeof window === "undefined") return null;
  return ((window as Window & { posthog?: PostHogLike }).posthog || null) as PostHogLike | null;
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: (error.stack || "").slice(0, MAX_STACK_LENGTH) || null,
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
      stack: null,
    };
  }

  return {
    name: "UnknownError",
    message: "Unknown client error",
    stack: null,
  };
};

export const capturePosthogEvent = (
  eventName: string,
  properties: EventProperties = {}
) => {
  const posthog = getPostHog();
  if (!posthog?.capture) return false;

  try {
    posthog.capture(eventName, properties);
    return true;
  } catch (captureError) {
    console.error("[posthog][capture-failed]", captureError);
    return false;
  }
};

/** 로그인 사용자를 DB 사용자 id 로 묶는다. 연락처·이메일 같은 개인정보는 넘기지 않는다. */
export const identifyPosthogUser = (userId: number | string, properties: EventProperties = {}) => {
  const posthog = getPostHog();
  if (!posthog?.identify) return false;
  const distinctId = String(userId);
  // 이미 이 사용자로 묶여 있으면 다시 보내지 않는다(페이지를 열 때마다 $set 이 쌓이지 않게).
  // 스크립트가 뜨기 전 stub 에는 get_distinct_id 가 없어 그대로 큐에 넣는다.
  if (posthog.get_distinct_id?.() === distinctId) return true;

  try {
    posthog.identify(distinctId, properties);
    return true;
  } catch (identifyError) {
    console.error("[posthog][identify-failed]", identifyError);
    return false;
  }
};

/** 로그아웃 때 부른다. 같은 브라우저의 다음 방문자가 이전 사용자로 기록되지 않게 한다. */
export const resetPosthogUser = () => {
  const posthog = getPostHog();
  try {
    posthog?.reset?.();
  } catch (resetError) {
    console.error("[posthog][reset-failed]", resetError);
  }
};

export const capturePosthogError = ({
  source,
  error,
  context = {},
}: {
  source: string;
  error: unknown;
  context?: EventProperties;
}) => {
  const normalized = normalizeError(error);
  return capturePosthogEvent("client_error_captured", {
    source,
    error_name: normalized.name,
    error_message: normalized.message,
    error_stack: normalized.stack,
    path: typeof window !== "undefined" ? window.location.pathname : null,
    href: typeof window !== "undefined" ? window.location.href : null,
    ...context,
  });
};

