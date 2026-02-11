import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
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
      "ENABLE_E2E_ROUTES=true NEXT_PUBLIC_DOMAIN_URL=http://127.0.0.1:3000 NEXT_PUBLIC_KAKAO_API_KEY=e2e-kakao-key NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=e2e-kakao-js-key COOKIE_PASSWORD=01234567890123456789012345678901 npx next dev -p 3000",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

