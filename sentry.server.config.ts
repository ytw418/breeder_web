import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // 공공데이터포털(apis.data.go.kr)은 sentry-trace·baggage 헤더가 붙으면 400 INVALID_REQUEST_PARAMETER_ERROR 로
  // 거절한다(2026-10-24 보호소 동기화에서 재현). 그 주소만 빼고 나머지는 지금처럼 전부 추적 헤더를 붙인다.
  tracePropagationTargets: [/^(?!https?:\/\/apis\.data\.go\.kr\/)/],
  debug: false,
});
