import { expect, test } from "@playwright/test";

test("로그인 진입 -> 콜백 -> 안전한 redirect가 동작한다", async ({ page }) => {
  // 카카오 SDK를 페이지 로드 전에 스텁해서 실제 외부 SDK 의존성을 제거한다.
  await page.addInitScript(() => {
    (window as any).__kakaoAuthorizeArgs = null;
    (window as any).Kakao = {
      isInitialized: () => true,
      init: () => undefined,
      Auth: {
        authorize: (options: { state: string }) => {
          (window as any).__kakaoAuthorizeArgs = options;
          window.sessionStorage.setItem(
            "__e2e_kakao_authorize_args",
            JSON.stringify(options)
          );
          window.location.assign(`/login-loading?code=e2e-code&state=${options.state}`);
        },
      },
    };
  });

  await page.route("https://t1.kakaocdn.net/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.Kakao = window.Kakao || {};",
    });
  });

  // 카카오 토큰 교환 API를 모킹해 콜백 플로우만 검증한다.
  await page.route("https://kauth.kakao.com/oauth/token", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "e2e-access-token",
      }),
    });
  });

  // 카카오 사용자 조회 응답을 고정해 로그인 후속 로직을 안정적으로 재현한다.
  await page.route("https://kapi.kakao.com/v2/user/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 123456,
        kakao_account: {
          email: "e2e-user@bredy.local",
          profile: {
            is_default_image: false,
            nickname: "E2E유저",
            thumbnail_image_url: "https://example.com/avatar.png",
          },
        },
      }),
    });
  });

  // 앱 로그인 API를 성공 응답으로 고정해 redirect 검증에 집중한다.
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
      }),
    });
  });

  await page.goto("/auth/login?next=https://evil.example/path");
  await page.getByRole("button", { name: "카카오로 계속하기" }).click();

  // 외부 URL(next)이 들어와도 내부 안전 경로(/)로만 이동해야 한다.
  await expect
    .poll(async () => new URL(page.url()).pathname, { timeout: 10000 })
    .toBe("/");

  // authorize의 state 값이 안전 경로(%2F)로 정규화되었는지 최종 확인한다.
  const encodedState = await page.evaluate(
    () => {
      const raw = window.sessionStorage.getItem("__e2e_kakao_authorize_args");
      if (!raw) return undefined;
      try {
        return JSON.parse(raw)?.state;
      } catch {
        return undefined;
      }
    }
  );
  expect(encodedState).toBe("%2F");
});
