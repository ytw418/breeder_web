import { expect, test } from "@playwright/test";

// 모바일 터치로 누른다. 아바타 줄이 커버 아래쪽 40px 를 덮어 커버 칩 터치를 가로채던 회귀를 막는다.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const COVER_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"><rect width="900" height="300" fill="#d7e6dd"/></svg>'
);

test.beforeEach(async ({ page }) => {
  // 로그인된 사용자 상태를 모킹한다. 저장 요청은 보내지 않는다.
  await page.addInitScript(() => {
    localStorage.setItem("bredy:accessToken", "e2e-only");
    localStorage.setItem("bredy:refreshToken", "e2e-only");
  });
  await page.route("**/api/users/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        profile: {
          id: 7,
          role: "USER",
          status: "ACTIVE",
          name: "E2E브리더",
          avatar: null,
          bio: "커버 사진 테스트",
          profileBanner: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
          updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        },
      }),
    });
  });
  await page.goto("/editProfile");
});

test("커버 칩을 터치하면 사진 선택창이 열리고 변경·삭제할 수 있다", async ({ page }) => {
  const addCover = page.getByRole("button", { name: "커버 추가", exact: true });
  await expect(addCover).toBeVisible({ timeout: 60_000 });

  const chooserPromise = page.waitForEvent("filechooser");
  await addCover.tap({ timeout: 5_000 });
  await (await chooserPromise).setFiles({ name: "cover.svg", mimeType: "image/svg+xml", buffer: COVER_SVG });
  await expect(page.getByRole("img", { name: "커버 사진", exact: true })).toBeVisible();

  const changePromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "커버 변경", exact: true }).tap({ timeout: 5_000 });
  await (await changePromise).setFiles([]);

  await page.getByRole("button", { name: "커버 삭제", exact: true }).tap({ timeout: 5_000 });
  await expect(addCover).toBeVisible();
});

test("360 폭(갤럭시 S24)에서도 커버 칩이 아바타에 가리지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const addCover = page.getByRole("button", { name: "커버 추가", exact: true });
  await expect(addCover).toBeVisible({ timeout: 60_000 });

  const chooserPromise = page.waitForEvent("filechooser");
  await addCover.tap({ timeout: 5_000 });
  await (await chooserPromise).setFiles({ name: "cover.svg", mimeType: "image/svg+xml", buffer: COVER_SVG });

  const avatarBox = await page.getByRole("button", { name: "프로필 이미지 변경", exact: true }).locator("..").boundingBox();
  expect(avatarBox).not.toBeNull();
  for (const name of ["커버 삭제", "커버 변경"]) {
    const chipBox = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(chipBox).not.toBeNull();
    const overlaps =
      chipBox!.x < avatarBox!.x + avatarBox!.width &&
      avatarBox!.x < chipBox!.x + chipBox!.width &&
      chipBox!.y < avatarBox!.y + avatarBox!.height &&
      avatarBox!.y < chipBox!.y + chipBox!.height;
    expect(overlaps, `${name} 칩이 아바타와 겹친다`).toBe(false);
  }
});

test("아바타 카메라를 터치하면 사진 선택창이 열린다", async ({ page }) => {
  const avatarCamera = page.getByRole("button", { name: "프로필 이미지 변경", exact: true });
  await expect(avatarCamera).toBeVisible({ timeout: 60_000 });

  const chooserPromise = page.waitForEvent("filechooser");
  await avatarCamera.tap({ timeout: 5_000 });
  await chooserPromise;
});
