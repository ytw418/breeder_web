import { expect, test } from "@playwright/test";

test("상품 목록 -> 상세 -> 찜 토글이 동작한다", async ({ page }) => {
  let favToggleCount = 0;

  // 로그인된 사용자 상태를 모킹해 찜 버튼이 즉시 활성화되도록 한다.
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
          snsId: "e2e-buyer",
          provider: "kakao",
          phone: null,
          email: "buyer@bredy.local",
          name: "E2E구매자",
          avatar: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
          updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        },
      }),
    });
  });

  // 찜 토글 API 호출 횟수를 추적해 실제 요청이 발생했는지 검증한다.
  await page.route(/\/api\/products\/101-[^/]+\/fav$/, async (route) => {
    favToggleCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        action: "added",
      }),
    });
  });

  // 상세 조회 API를 고정 응답으로 모킹해 테스트 데이터를 안정화한다.
  await page.route(/\/api\/products\/101-[^/]+$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        isLiked: false,
        hasPurchased: false,
        product: {
          id: 101,
          name: "테스트 사슴벌레",
          price: 120000,
          description: "E2E 찜 토글 테스트용 상품 설명입니다.",
          photos: ["e2e-product-image"],
          createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
          updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
          userId: 999,
          category: "곤충",
          tags: [],
          isSold: false,
          isDeleted: false,
          isHidden: false,
          location: null,
          viewCount: 0,
          wishCount: 0,
          status: "판매중",
          condition: null,
          contactCount: 0,
          expireAt: null,
          deliveryType: null,
          priceOfferable: true,
          mainImage: null,
          isFeatured: false,
          reportCount: 0,
          productType: "생물",
          user: {
            id: 999,
            role: "USER",
            status: "ACTIVE",
            snsId: "e2e-seller",
            provider: "kakao",
            phone: null,
            email: "seller@bredy.local",
            name: "테스트 판매자",
            avatar: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
            updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
          },
          _count: { favs: 0 },
        },
        relatedProducts: [],
      }),
    });
  });

  await page.goto("/e2e/product-flow");
  await page.getByTestId("product-link-101").click();

  await expect(page).toHaveURL(/\/e2e\/product-flow\/101-/);
  await expect(page.getByText("테스트 사슴벌레")).toBeVisible();

  // 초기 상태는 미찜이어야 한다.
  const favButton = page.getByTestId("favorite-toggle");
  await expect(favButton).toHaveAttribute("aria-label", "찜 추가");

  await favButton.click();

  // 클릭 후 낙관적 UI 업데이트로 찜 상태가 즉시 반영되는지 확인한다.
  await expect(favButton).toHaveAttribute("aria-label", "찜 취소");
  await expect.poll(() => favToggleCount).toBe(1);
});
