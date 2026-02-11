import { expect, test } from "@playwright/test";

const hasStorageState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE);

test.skip(!hasStorageState, "PLAYWRIGHT_STORAGE_STATE를 설정해야 @auth 테스트를 실행할 수 있습니다.");

test("@auth 저장된 로그인 상태로 마이페이지 접근이 가능하다", async ({ page }) => {
  await page.goto("/myPage");

  await expect(page).toHaveURL(/\/myPage$/);
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
});
