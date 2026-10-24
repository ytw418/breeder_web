import { defineConfig, devices } from "@playwright/test";

// 이미 떠 있는 dev 서버(localhost:3010)에 붙는 QA 전용 설정. webServer 를 띄우지 않는다.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /pet-space\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3010", ...devices["iPhone 13"] },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
