import { expect, test } from "@playwright/test";

test.use({
  viewport: {
    width: 390,
    height: 720,
  },
});

test("로그인 페이지는 긴 테스트 계정 목록에서도 상단이 보이고 소개 페이지로 진입할 수 있다", async ({
  page,
}) => {
  await page.route("https://t1.kakaocdn.net/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.Kakao = window.Kakao || { isInitialized: () => true, init: () => undefined, Auth: { authorize: () => undefined } };",
    });
  });

  await page.route("**/api/breeder-programs/founding-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        count: 12,
        limit: 100,
        remaining: 88,
      }),
    });
  });

  await page.route("**/api/users/test-accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        users: Array.from({ length: 18 }, (_, index) => ({
          id: index + 1,
          name: `fake${String(index + 1).padStart(4, "0")}`,
          email: null,
          provider: "test_user",
          createdAt: new Date("2026-03-30T00:00:00.000Z").toISOString(),
        })),
      }),
    });
  });

  await page.goto("/auth/login");

  await expect(page.getByRole("heading", { name: "브리디" })).toBeVisible();
  await expect(page.getByRole("button", { name: "카카오로 계속하기" })).toBeVisible();
  await expect(page.getByText("테스트 로그인 (개발/테스트 환경 전용)")).toBeVisible();
  await expect(page.getByText("잔여 88석")).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(
    page.getByText("서비스 이용시 브리디의", { exact: false })
  ).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole("heading", { name: "브리디" })).toBeVisible();

  await page.getByRole("link", { name: /창립 브리더 100인 한정/ }).click();
  await expect(
    page.getByRole("heading", { name: "브리디의 브리더 프레스티지 프로그램" })
  ).toBeVisible();
});
