import { expect, test } from "@playwright/test";

const hasStorageState = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE);

test.skip(!hasStorageState, "PLAYWRIGHT_STORAGE_STATE를 설정해야 @auth 테스트를 실행할 수 있습니다.");

test("@auth 저장된 로그인 상태로 마이페이지 접근이 가능하다", async ({ page }) => {
  await page.goto("/myPage");

  await expect(page).toHaveURL(/\/myPage$/);
  // 로그아웃은 2026-10-09 프로필 v4 부터 사이드 메뉴에만 있다(마이페이지 메뉴 행 제거). 본인 프로필 블록 버튼으로 확인한다.
  await expect(page.getByRole("link", { name: "프로필 수정" })).toBeVisible();
});
