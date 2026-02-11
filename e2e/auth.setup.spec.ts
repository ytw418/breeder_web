import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const authFile = process.env.PLAYWRIGHT_AUTH_FILE ?? "playwright/.auth/user.json";
const shouldRunSetup = process.env.PLAYWRIGHT_AUTH_SETUP === "1";

test.skip(!shouldRunSetup, "PLAYWRIGHT_AUTH_SETUP=1일 때만 수동 로그인 setup을 실행합니다.");

test("카카오 수동 로그인 후 storageState를 저장한다", async ({ page, context }) => {
  test.setTimeout(10 * 60 * 1000);

  console.log("[auth-setup] 브라우저에서 카카오 로그인을 완료해 주세요. 최대 10분 대기합니다.");
  await page.goto("/auth/login?next=%2F");

  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/users/me");
        if (!response.ok()) {
          return false;
        }

        const body = await response.json().catch(() => null);
        return Boolean(body?.success && body?.profile?.id);
      },
      {
        timeout: 10 * 60 * 1000,
        intervals: [2000],
      }
    )
    .toBe(true);

  const resolvedAuthFile = path.resolve(authFile);
  fs.mkdirSync(path.dirname(resolvedAuthFile), { recursive: true });
  await context.storageState({ path: resolvedAuthFile });

  console.log(`[auth-setup] 로그인 상태 저장 완료: ${resolvedAuthFile}`);
});
