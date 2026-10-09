import {
  ALL_SCOPE_LABEL,
  CATEGORY_SCOPE_ONBOARDED_KEY,
  CATEGORY_SCOPE_PINS_KEY,
  adoptServerPins,
  categoryLabel,
  formatScopeLabel,
  getCategoryScopeState,
  markCategoryOnboardingDone,
  normalizePins,
  parseStoredPins,
  planInitialScopeSync,
  planOnboardedSync,
  readStoredCategoryScope,
  reconcilePinsWithCategories,
  resetCategoryScopeForTest,
  restoreCategoryScope,
  setPinnedCategories,
  toCategoryPath,
  type PinnedCategory,
} from "@libs/client/categoryScope";
import type { CategoryItem } from "@libs/shared/categories";

const cat = (id: number, name: string, slug: string, parentId: number | null, path: string): CategoryItem => ({
  id,
  name,
  slug,
  parentId,
  path,
  sortOrder: id,
});

const CATEGORIES: CategoryItem[] = [
  cat(1, "포유류", "mammal", null, "/mammal/"),
  cat(2, "햄스터", "hamster", 1, "/mammal/hamster/"),
  cat(3, "파충류", "reptile", null, "/reptile/"),
  cat(4, "거북", "tortoise", 3, "/reptile/tortoise/"),
];

const pin = (id: number, path: string, label = `p${id}`): PinnedCategory => ({
  id,
  name: label,
  path,
  label,
});

beforeEach(() => {
  window.localStorage.clear();
  resetCategoryScopeForTest();
});

describe("고정 목록 규칙", () => {
  it("조상이 함께 있으면 하위를 빼고 중복을 없앤다", () => {
    const result = normalizePins([
      pin(2, "/mammal/hamster/"),
      pin(1, "/mammal/"),
      pin(1, "/mammal/"),
      pin(4, "/reptile/tortoise/"),
    ]);
    expect(result.map((p) => p.id)).toEqual([1, 4]);
  });

  it("최대 10개까지만 남긴다", () => {
    const many = Array.from({ length: 12 }, (_, i) => pin(i + 1, `/c${i + 1}/`));
    expect(normalizePins(many)).toHaveLength(10);
  });

  it("범위 쿼리 값과 라벨을 만든다", () => {
    expect(toCategoryPath([])).toBeUndefined();
    expect(toCategoryPath([pin(1, "/mammal/"), pin(4, "/reptile/tortoise/")])).toBe(
      "/mammal/,/reptile/tortoise/"
    );
    expect(formatScopeLabel([])).toBe(ALL_SCOPE_LABEL);
    expect(formatScopeLabel([pin(1, "/mammal/", "포유류")])).toBe("포유류");
    expect(formatScopeLabel([pin(1, "/mammal/", "포유류"), pin(3, "/reptile/", "파충류")])).toBe(
      "포유류 외 1"
    );
    expect(categoryLabel(CATEGORIES[1], CATEGORIES)).toBe("포유류 > 햄스터");
  });

  it("깨진 저장값은 빈 목록으로 복원한다", () => {
    expect(parseStoredPins("{bad")).toEqual([]);
    expect(parseStoredPins(JSON.stringify([{ id: "x" }]))).toEqual([]);
    expect(parseStoredPins(null)).toEqual([]);
  });
});

describe("브라우저 저장·복원", () => {
  it("복원 전에는 hydrated 가 false 이고, 복원하면 저장값을 읽는다", () => {
    window.localStorage.setItem(CATEGORY_SCOPE_PINS_KEY, JSON.stringify([pin(1, "/mammal/", "포유류")]));
    window.localStorage.setItem(CATEGORY_SCOPE_ONBOARDED_KEY, "1");
    expect(getCategoryScopeState().hydrated).toBe(false);
    const restored = restoreCategoryScope();
    expect(restored.hydrated).toBe(true);
    expect(restored.onboarded).toBe(true);
    expect(restored.pins.map((p) => p.id)).toEqual([1]);
  });

  it("고정·온보딩 표시를 저장한다", () => {
    setPinnedCategories([pin(2, "/mammal/hamster/"), pin(1, "/mammal/")]);
    markCategoryOnboardingDone();
    expect(readStoredCategoryScope().pins.map((p) => p.id)).toEqual([1]);
    expect(readStoredCategoryScope().onboarded).toBe(true);
  });

  it("목록에서 사라진 고정은 빼고 그 이름을 돌려준다", () => {
    setPinnedCategories([pin(2, "/mammal/hamster/", "포유류 > 햄스터"), pin(99, "/gone/", "없어진 분류")]);
    const dropped = reconcilePinsWithCategories(CATEGORIES);
    expect(dropped).toEqual(["없어진 분류"]);
    expect(getCategoryScopeState().pins).toEqual([
      { id: 2, name: "햄스터", path: "/mammal/hamster/", label: "포유류 > 햄스터" },
    ]);
  });

  it("서버 고정을 받으면 이름·path 를 만들고 온보딩을 마친 것으로 본다", () => {
    restoreCategoryScope();
    adoptServerPins([4, 1], CATEGORIES);
    const state = getCategoryScopeState();
    expect(state.pins.map((p) => p.label)).toEqual(["파충류 > 거북", "포유류"]);
    expect(state.onboarded).toBe(true);
  });
});

describe("온보딩 마침 표시(계정 ↔ 브라우저)", () => {
  it("계정이 마쳤으면 브라우저도 마친 것으로, 브라우저만 마쳤으면 계정에 올린다", () => {
    expect(planOnboardedSync(false, "2026-10-09T00:00:00.000Z")).toBe("adopt");
    expect(planOnboardedSync(true, null)).toBe("push");
    expect(planOnboardedSync(true, "2026-10-09T00:00:00.000Z")).toBe("none");
    expect(planOnboardedSync(false, undefined)).toBe("none");
  });
});

describe("계정별 첫 동기화 방향(앱과 같은 규칙)", () => {
  it("브라우저가 비어 있고 서버에 있으면 받는다(목록이 없으면 기다린다)", () => {
    expect(planInitialScopeSync([], [3], true)).toBe("adopt");
    expect(planInitialScopeSync([], [3], false)).toBe("wait-categories");
  });

  it("같으면 할 일이 없다", () => {
    expect(planInitialScopeSync([1, 3], [1, 3], true)).toBe("in-sync");
    expect(planInitialScopeSync([], [], true)).toBe("in-sync");
  });

  it("브라우저에 고정이 있으면 서버에 올린다", () => {
    expect(planInitialScopeSync([1], [3], true)).toBe("push");
    expect(planInitialScopeSync([1], undefined, true)).toBe("push");
  });
});
