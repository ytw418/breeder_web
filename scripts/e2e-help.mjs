const lines = [
  "",
  "E2E 실행 가이드",
  "----------------",
  "1) 브라우저 설치",
  "   npm run test:e2e:install",
  "",
  "2) 기본(headless) 실행",
  "   npm run test:e2e",
  "",
  "3) 브라우저를 보면서 실행",
  "   npm run test:e2e:headed",
  "",
  "4) Playwright UI 모드 실행",
  "   npm run test:e2e:ui",
  "",
  "참고",
  "- playwright.config.ts에서 Next dev 서버를 자동 기동합니다.",
  "- 실패 시 리포트: playwright-report/index.html",
  "",
];

console.log(lines.join("\n"));

