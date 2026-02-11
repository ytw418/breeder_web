import { expect, test } from "@playwright/test";

test("/auctions 페이지가 404가 아니고 경매 헤더를 표시한다", async ({ page }) => {
  await page.goto("/auctions");

  await expect(page).toHaveURL(/\/auctions$/);
  await expect(page.getByRole("heading", { name: "카페/밴드 링크형 경매" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "404" })).toHaveCount(0);
});
