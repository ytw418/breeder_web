import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${port}`;
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    storageState,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      `ENABLE_E2E_ROUTES=true NEXT_PUBLIC_DOMAIN_URL=${baseURL} NEXT_PUBLIC_KAKAO_API_KEY=e2e-kakao-key NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=e2e-kakao-js-key COOKIE_PASSWORD=01234567890123456789012345678901 npx next dev -p ${port}`,
    url: baseURL,
    // 로컬에서 기존 dev 서버를 재사용하면 ENABLE_E2E_ROUTES 값이 누락되어
    // /e2e 경로가 404가 될 수 있어 항상 전용 서버를 띄운다.
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
