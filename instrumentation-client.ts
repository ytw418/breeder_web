import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  debug: false,
  // 인앱 브라우저(카카오톡·네이버·인스타 등)가 페이지에 심는 브리지 오류와 Firebase 팝업 내부 단언.
  // 우리 코드가 아니라 고칠 수 없다. PostHog 는 libs/client/posthog.ts 에서 같은 기준으로 거른다.
  ignoreErrors: [
    /Java object is gone/,
    /window\.webkit\.messageHandlers/,
    /_pcmBridgeCallbackHandler/,
    /INTERNAL ASSERTION FAILED: Pending promise was never set/,
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
