import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * 강아지·고양이 공간 E2E (docs/qa/pet-space-e2e-tc.md). 데이터를 쓰는 요청은 모두 page.route 로 가로챈다.
 * 실행: playwright.pet.config.ts (localhost:3010 dev 서버 필요).
 */
const SHOT = "/tmp/pet-e2e";
const PINS_KEY = "bredy:categoryScope:pins";
const ONBOARDED_KEY = "bredy:categoryScope:onboarded";

const DOG = { id: 35, name: "강아지", path: "/mammal/dog/", label: "포유류 > 강아지" };
const CAT = { id: 34, name: "고양이", path: "/mammal/cat/", label: "포유류 > 고양이" };
const REPTILE = { id: 3, name: "파충류", path: "/reptile/", label: "파충류" };
type Pin = typeof DOG;

async function setup(context: BrowserContext, opts: { pins?: Pin[]; onboarded?: boolean } = {}) {
  await context.addInitScript(
    ({ pins, onboarded, PINS_KEY, ONBOARDED_KEY }) => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
      localStorage.setItem("bredy.pushPrompt.welcomeShown", "1");
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      if (pins) localStorage.setItem(PINS_KEY, JSON.stringify(pins));
      if (onboarded || pins) localStorage.setItem(ONBOARDED_KEY, "1");
    },
    { pins: opts.pins, onboarded: opts.onboarded, PINS_KEY, ONBOARDED_KEY }
  );
  // 쓰기 요청 차단(관심 분야 저장 등).
  await context.route("**/api/users/me", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' });
    }
    return route.continue();
  });
}

const baseProduct = (over: Record<string, unknown>) => ({
  id: 9000,
  name: "테스트",
  price: 0,
  description: "",
  photos: [],
  country: "KR",
  createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  updatedAt: new Date().toISOString(),
  userId: 9999,
  category: "포유류",
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
  priceOfferable: false,
  mainImage: null,
  isFeatured: false,
  reportCount: 0,
  productType: "생물",
  categoryId: 35,
  dealType: "sale",
  bloodlineRootId: null,
  pedigreeNote: null,
  petInfo: null,
  regionSido: null,
  regionSigungu: null,
  user: { id: 9999, name: "테스트분양자", avatar: null, breederPrograms: [], titleLabel: null },
  _count: { favs: 0 },
  ...over,
});

const FOSTER = baseProduct({
  id: 9001,
  category: "강아지",
  name: "2개월 믹스견 콩이 임보처 구해요",
  dealType: "foster",
  petInfo: { sex: "male", age: "2개월", health: ["vaccinated"], fosterPeriod: "month", fosterSupport: ["food"] },
  regionSido: "서울",
  regionSigungu: "마포구",
});
const REHOME = baseProduct({
  id: 9002,
  category: "고양이",
  name: "1살 코숏 나비 새 가족 찾아요",
  dealType: "rehoming",
  categoryId: 34,
  petInfo: { sex: "female", age: "1살", health: ["neutered"], reason: "moving" },
});
const SALE_DOG = baseProduct({
  id: 9003,
  category: "강아지",
  name: "2개월 말티즈 분양해요",
  dealType: "adoption",
  petInfo: { sex: "male", age: "2개월", health: ["vaccinated"] },
});

/** /api/products 목록을 dealType 별 가짜 데이터로 돌려준다(GET 만). */
async function mockProducts(page: Page) {
  await page.route(/\/api\/products\?/, async (route) => {
    const url = new URL(route.request().url());
    const deal = url.searchParams.get("dealType");
    const list = deal === "foster" ? [FOSTER] : deal === "rehoming" ? [REHOME] : [SALE_DOG, REHOME, FOSTER];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, products: list, pages: 1, total: list.length }),
    });
  });
}

const promptDialog = (page: Page) => page.getByRole("dialog", { name: "키우는 아이 고르기" });

test.describe("첫 방문 팝업 (AC-1)", () => {
  test("TC-01 고른 분야가 없으면 홈에서 팝업이 뜬다 — 카드 8장+'아직 없어요', '포유류' 말 없음", async ({ page, context }) => {
    await setup(context);
    await page.goto("/");
    const dialog = promptDialog(page);
    await expect(dialog.getByText("어떤 아이를 키우시나요?")).toBeVisible();
    await expect(dialog.getByRole("checkbox")).toHaveCount(9);
    await expect(dialog.getByText("아직 없어요")).toBeVisible();
    await expect(dialog.getByText("포유류")).toHaveCount(0);
    await expect(dialog.getByText("키우고 싶은 아이도, 여러 개도 괜찮아요.")).toBeVisible();
    await page.screenshot({ path: `${SHOT}/01-home-popup.png` });
  });

  test("TC-02 onboarded=1 만 있고 pins 가 비어도 팝업이 뜬다", async ({ page, context }) => {
    await setup(context, { onboarded: true });
    await page.goto("/");
    await expect(promptDialog(page).getByText("어떤 아이를 키우시나요?")).toBeVisible();
  });

  test("TC-03 같은 탭에서 닫으면 새로고침해도 다시 안 뜬다", async ({ page, context }) => {
    await setup(context);
    await page.goto("/");
    await promptDialog(page).getByRole("button", { name: "건너뛰기" }).click();
    await expect(promptDialog(page)).toHaveCount(0);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(promptDialog(page)).toHaveCount(0);
    expect(await page.evaluate((k) => sessionStorage.getItem("bredy:categoryScope:promptDismissed"), "x")).toBeTruthy();
  });

  test("TC-04 강아지·고양이를 고르면 팝업이 닫히고 홈에 남고, 새로고침해도 안 뜬다", async ({ page, context }) => {
    await setup(context);
    await page.goto("/");
    const dialog = promptDialog(page);
    await expect(dialog.getByRole("button", { name: "키우는 아이를 골라 주세요" })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /^강아지/ }).click();
    await dialog.getByRole("checkbox", { name: /^고양이/ }).click();
    await page.screenshot({ path: `${SHOT}/02-popup-picked.png` });
    await dialog.getByRole("button", { name: "2개 고르고 시작하기" }).click();
    await expect(promptDialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(/localhost:3010\/?$/);
    const pins = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), PINS_KEY);
    expect(pins.map((p: Pin) => p.path).sort()).toEqual(["/mammal/cat/", "/mammal/dog/"]);
    await page.screenshot({ path: `${SHOT}/03-home-after-pick.png` });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(promptDialog(page)).toHaveCount(0);
  });

  test("TC-05 고른 분야(pins)가 있으면 팝업이 안 뜬다", async ({ page, context }) => {
    await setup(context, { pins: [DOG] });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(promptDialog(page)).toHaveCount(0);
  });

  test("TC-06 '아직 없어요'를 고르면 다른 선택이 풀리고 '다 둘러볼게요'로 시작", async ({ page, context }) => {
    await setup(context);
    await page.goto("/");
    const dialog = promptDialog(page);
    await dialog.getByRole("checkbox", { name: /^강아지/ }).click();
    await dialog.getByRole("checkbox", { name: /^아직 없어요/ }).click();
    await expect(dialog.getByRole("checkbox", { name: /^강아지/ })).toHaveAttribute("aria-checked", "false");
    await dialog.getByRole("button", { name: "다 둘러볼게요" }).click();
    await expect(promptDialog(page)).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), PINS_KEY)).toBe("[]");
  });
});

test.describe("분양 탭 전환 (AC-2·5)", () => {
  const cases: [string, Pin[], string | null][] = [
    ["TC-07 강아지·고양이만 → 분양 · 입양", [DOG, CAT], "분양 · 입양"],
    ["TC-08 강아지+파충류 → 분양 · 경매 · 입양", [DOG, REPTILE], "분양 · 경매 · 입양"],
    ["TC-09 파충류만 → 분양 · 경매(입양 없음)", [REPTILE], "분양 · 경매"],
  ];
  for (const [title, pins, label] of cases) {
    test(title, async ({ page, context }) => {
      await setup(context, { pins });
      await mockProducts(page);
      await page.goto("/products");
      const nav = page.getByRole("navigation", { name: label! });
      await expect(nav).toBeVisible();
      if (label === "분양 · 경매") await expect(nav.getByText("입양")).toHaveCount(0);
      await page.screenshot({ path: `${SHOT}/04-tabs-${pins.map((p) => p.id).join("-")}.png` });
    });
  }

  test("TC-10 고정 없음(전체 보기)은 분양 · 경매 그대로", async ({ page, context }) => {
    await setup(context, { pins: [], onboarded: true });
    await mockProducts(page);
    await page.goto("/products?x=1");
    await expect(page.getByRole("navigation", { name: "분양 · 경매" })).toBeVisible();
  });
});

test.describe("입양 쪽 (AC-3·16)", () => {
  test("TC-11 /adoption 에 임보 레일·'가족을 기다려요' 목록·종 칩이 보인다", async ({ page, context }) => {
    await setup(context, { pins: [DOG, CAT] });
    await mockProducts(page);
    await page.goto("/adoption");
    const rail = page.getByTestId("foster-rail");
    await expect(rail.getByText("임보해 주실 분 찾아요")).toBeVisible();
    await expect(rail.getByText("2개월 믹스견 콩이 임보처 구해요")).toBeVisible();
    await expect(rail.getByRole("button")).toHaveCount(1); // 카드엔 버튼이 없고 '전체 ›' 하나
    await expect(page.getByRole("heading", { name: "가족을 기다려요" })).toBeVisible();
    await expect(page.getByText("1살 코숏 나비 새 가족 찾아요")).toBeVisible();
    await expect(page.getByRole("button", { name: "강아지", exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOT}/05-adoption.png` });
  });

  test("TC-12 레일 '전체 ›' 는 /adoption/foster(임보 구해요 전체)를 연다", async ({ page, context }) => {
    await setup(context, { pins: [DOG, CAT] });
    await mockProducts(page);
    await page.goto("/adoption");
    await page.getByTestId("foster-rail").getByRole("button", { name: "전체 ›" }).click();
    await expect(page).toHaveURL(/\/adoption\/foster/);
    await expect(page.getByText("2개월 믹스견 콩이 임보처 구해요").first()).toBeVisible();
    await page.screenshot({ path: `${SHOT}/06-foster-all.png` });
  });

  test("TC-13 분양 쪽 강아지·고양이 행: 가격 없이 정보 한 줄, 행 높이 148 (AC-16)", async ({ page, context }) => {
    await setup(context, { pins: [DOG, CAT] });
    await mockProducts(page);
    await page.goto("/products");
    const link = page.locator('a[href*="9003"]').first();
    await expect(link).toBeVisible();
    await expect(page.getByText("무료 분양")).toHaveCount(0); // 가격 줄 없음
    await expect(page.getByText(/남아.*2개월.*접종 완료/).first()).toBeVisible();
    await page.screenshot({ path: `${SHOT}/07-products-dogcat.png` });
    const heights = await link.evaluate((el) => {
      const out: number[] = [];
      for (let n: Element | null = el; n && out.length < 4; n = n.parentElement) out.push(n.getBoundingClientRect().height);
      return out;
    });
    console.log("row heights(link→parents)", JSON.stringify(heights));
    // 링크 147 + 아래 구분선 1 = 행 148
    expect(heights.some((h) => Math.round(h) === 148)).toBe(true);
  });

  test("TC-14 입양 칩이 '분양 · 입양' 에서 입양 칸을 누르면 /adoption 으로 간다", async ({ page, context }) => {
    await setup(context, { pins: [DOG, CAT] });
    await mockProducts(page);
    await page.goto("/products");
    await page.getByRole("navigation", { name: "분양 · 입양" }).getByRole("link", { name: /입양/ }).click();
    await expect(page).toHaveURL(/\/adoption/);
  });
});

test.describe("공간 전환 (AC-6·13)", () => {
  test("TC-15 사이드 메뉴 공간 카드 → 시트 → 소동물·파충류… 선택 시 탭·고정이 바뀐다", async ({ page, context }) => {
    await setup(context, { pins: [DOG, CAT] });
    await mockProducts(page);
    await page.goto("/products");
    await page.getByRole("button", { name: "메뉴", exact: true }).first().click();
    const card = page.getByTestId("pet-space-card");
    await expect(card).toHaveAttribute("aria-label", "지금 공간 강아지·고양이, 바꾸기");
    await page.screenshot({ path: `${SHOT}/08-menu-space-card.png` });
    await card.click();
    const sheet = page.getByRole("dialog", { name: "어떤 공간을 볼까요?" });
    await expect(sheet.getByRole("radio", { name: /^강아지·고양이/ })).toHaveAttribute("aria-checked", "true");
    await page.screenshot({ path: `${SHOT}/09-space-sheet.png` });
    await sheet.getByRole("radio", { name: /^소동물·파충류/ }).click();
    await expect(sheet).toHaveCount(0); // 줄을 누르면 바로 바뀌고 닫힌다
    const paths = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]").map((p: Pin) => p.path), PINS_KEY);
    expect(paths).toContain("/reptile/");
    expect(paths.some((p: string) => p.startsWith("/mammal/dog"))).toBe(false);
    await expect(page.getByRole("navigation", { name: "분양 · 입양" })).toHaveCount(0);
  });

  test("TC-16 /adoption 에서 소동물… 공간으로 바꾸면 /products 로 돌아간다", async ({ page, context }) => {
    await setup(context, { pins: [DOG, CAT] });
    await mockProducts(page);
    await page.goto("/adoption");
    await page.getByRole("button", { name: "메뉴", exact: true }).first().click();
    await page.getByTestId("pet-space-card").click();
    await page.getByRole("dialog", { name: "어떤 공간을 볼까요?" }).getByRole("radio", { name: /^소동물·파충류/ }).click();
    await expect(page).toHaveURL(/\/products/);
  });
});

async function testLogin(page: Page) {
  await page.goto("/auth/login?next=%2F");
  await page.getByRole("button", { name: /초보집사민/ }).click();
  // 토큰은 브라우저 저장소에 들어가므로(page.request 는 못 읽는다) 로그인 화면을 벗어나는지로 확인한다.
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 30_000 });
}

test.describe("글쓰기 (AC-4·14·15)", () => {
  const FOSTER_AGREE = "아이 상태를 숨기지 않고, 임보 뒤에도 책임질게요";
  const TRADE_AGREE = "2개월이 지난 아이만, 돈을 벌려는 목적 없이 분양할게요";

  test("TC-17 ①글 종류 카드 3장·가격 칸 없음, 종 없이/기간 없이 '다음' 은 칸 아래 오류, 뒤로가기는 한 단계 앞", async ({ page, context }) => {
    await setup(context, { pins: [DOG, CAT] });
    await testLogin(page);
    await page.goto("/products/upload");
    const cards = page.getByTestId("pet-kind-cards");
    await expect(cards.getByText("분양해요")).toBeVisible();
    await expect(cards.getByText("가족 찾아요")).toBeVisible();
    await expect(cards.getByText("임보 구해요")).toBeVisible();
    await expect(page.getByText("가격")).toHaveCount(0);
    await page.screenshot({ path: `${SHOT}/10-write-step1.png` });
    await cards.getByText("임보 구해요").click();
    await expect(page.getByText("어떤 아이인가요?")).toBeVisible();
    await expect(page.getByText("가격")).toHaveCount(0);
    // 종 없이 다음
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.screenshot({ path: `${SHOT}/11-write-step2-error-kind.png`, fullPage: true });
    const errs1 = await page.locator("[role=alert], .text-app-danger").allInnerTexts();
    console.log("종 없이 오류:", JSON.stringify(errs1));
    expect(errs1.join(" ")).toMatch(/종|강아지|고양이|골라/);
    // 종 선택 + 기간 없음
    await page.getByRole("button", { name: "강아지", exact: true }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    const errs2 = await page.locator("[role=alert], .text-app-danger").allInnerTexts();
    console.log("기간 없이 오류:", JSON.stringify(errs2));
    expect(errs2.join(" ")).toMatch(/기간/);
    await page.getByRole("button", { name: "한 달", exact: true }).click();
    await page.getByLabel("나이").fill("2개월");
    await page.getByRole("button", { name: "다음", exact: true }).click();
    // ③ 단계
    await expect(page.getByText(FOSTER_AGREE)).toBeVisible();
    console.log("STEP3\n" + (await page.locator("main, body").first().innerText()).slice(0, 900));
    await page.screenshot({ path: `${SHOT}/12-write-step3-foster.png`, fullPage: false });
    // 뒤로가기: 화면을 닫지 않고 ②로, 적은 내용 유지
    await page.goBack();
    await expect(page.getByText("어떤 아이인가요?")).toBeVisible();
    await expect(page).toHaveURL(/\/products\/upload/);
    await expect(page.getByLabel("나이")).toHaveValue("2개월");
    await page.goBack();
    await expect(page.getByTestId("pet-kind-cards")).toBeVisible();
    await expect(page).toHaveURL(/\/products\/upload/);
  });

  test("TC-18 ?kind= 로 열면 ②부터, 동의 문구는 글 종류별(임보/분양해요)", async ({ page, context }) => {
    await setup(context, { pins: [DOG, CAT] });
    await testLogin(page);
    await page.goto("/products/upload?kind=adoption");
    await expect(page.getByText("어떤 아이인가요?")).toBeVisible();
    await page.getByRole("button", { name: "강아지", exact: true }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await expect(page.getByText(TRADE_AGREE)).toBeVisible();
    await expect(page.getByText(FOSTER_AGREE)).toHaveCount(0);
    await page.screenshot({ path: `${SHOT}/13-write-step3-adoption.png`, fullPage: false });
  });
});
