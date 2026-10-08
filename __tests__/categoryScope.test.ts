import type { CategoryRecord } from "@libs/server/categories";

const mockClient = {
  category: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

import {
  categoryScopeWhere,
  getVisibleCategories,
  invalidateCategoryCache,
  resolveCategoryIdByName,
  resolveScopeCategoryIds,
  sanitizePinnedCategoryIds,
} from "@libs/server/categories";
import { parseCategoryPathParam } from "@libs/shared/categories";

const row = (
  id: number,
  name: string,
  path: string,
  parentId: number | null,
  isVisible = true,
  sortOrder = id
): CategoryRecord => ({
  id,
  name,
  slug: path.split("/").filter(Boolean).pop() ?? "",
  path,
  parentId,
  isVisible,
  sortOrder,
});

// 포유류(햄스터·강아지) / 파충류(육지거북) / 기타. 강아지는 숨김.
const ROWS: CategoryRecord[] = [
  row(5, "포유류", "/mammal/", null),
  row(3, "파충류", "/reptile/", null),
  row(8, "기타", "/etc/", null, true, 99),
  row(30, "햄스터", "/mammal/hamster/", 5),
  row(31, "강아지", "/mammal/dog/", 5, false),
  row(20, "육지거북", "/reptile/tortoise/", 3),
];

beforeEach(() => {
  invalidateCategoryCache();
  mockClient.category.findMany.mockReset();
  mockClient.category.findMany.mockResolvedValue(ROWS);
});

describe("parseCategoryPathParam", () => {
  it("쉼표로 이은 path 를 풀고 형식이 틀린 값은 버린다", () => {
    expect(parseCategoryPathParam("/mammal/,/reptile/tortoise/,bad,/x y/")).toEqual([
      "/mammal/",
      "/reptile/tortoise/",
    ]);
  });
  it("조상이 함께 있으면 하위는 뺀다", () => {
    expect(parseCategoryPathParam("/mammal/hamster/,/mammal/")).toEqual(["/mammal/"]);
  });
  it("유효한 값이 없으면 null", () => {
    expect(parseCategoryPathParam(undefined)).toBeNull();
    expect(parseCategoryPathParam("")).toBeNull();
    expect(parseCategoryPathParam("mammal")).toBeNull();
  });
});

describe("getVisibleCategories", () => {
  it("숨긴 카테고리를 빼고 부모 → 자식 순으로 준다", async () => {
    const visible = await getVisibleCategories();
    expect(visible.map((c) => c.id)).toEqual([3, 20, 5, 30, 8]);
    expect(visible[0]).not.toHaveProperty("isVisible");
  });
  it("부모가 숨겨지면 하위도 숨긴다", async () => {
    mockClient.category.findMany.mockResolvedValue([
      row(5, "포유류", "/mammal/", null, false),
      row(30, "햄스터", "/mammal/hamster/", 5),
    ]);
    expect(await getVisibleCategories()).toEqual([]);
  });
  it("60초 안에는 DB 를 다시 읽지 않는다", async () => {
    await getVisibleCategories();
    await getVisibleCategories();
    expect(mockClient.category.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("resolveScopeCategoryIds / categoryScopeWhere", () => {
  it("햄스터 고정이면 햄스터 + 대분류(포유류)에만 단 글. 다른 소분류는 뺀다", async () => {
    mockClient.category.findMany.mockResolvedValue([
      ...ROWS,
      row(32, "고슴도치", "/mammal/hedgehog/", 5),
    ]);
    expect(await resolveScopeCategoryIds("/mammal/hamster/")).toEqual([5, 30]);
  });
  it("포유류 고정이면 포유류 하위 전부(숨긴 강아지 제외)", async () => {
    expect(await resolveScopeCategoryIds("/mammal/")).toEqual([5, 30]);
    expect(await categoryScopeWhere("/mammal/")).toEqual({ categoryId: { in: [5, 30] } });
  });
  it("복수 고정은 합집합", async () => {
    expect(await resolveScopeCategoryIds("/mammal/hamster/,/reptile/")).toEqual([3, 20, 5, 30]);
  });
  it("범위에 맞는 카테고리가 없으면 빈 배열(아무것도 안 보인다)", async () => {
    // 숨긴 강아지를 고정해도 상위(포유류)를 끌어오지 않는다.
    expect(await resolveScopeCategoryIds("/mammal/dog/")).toEqual([]);
    expect(await categoryScopeWhere("/nope/")).toEqual({ categoryId: { in: [] } });
  });
  it("범위가 없으면 숨긴 카테고리 글만 뺀다(categoryId 없는 글은 보인다)", async () => {
    expect(await categoryScopeWhere(undefined)).toEqual({
      OR: [{ categoryId: null }, { categoryId: { notIn: [31] } }],
    });
  });
  it("숨긴 카테고리가 없으면 조건을 붙이지 않는다", async () => {
    mockClient.category.findMany.mockResolvedValue(ROWS.filter((r) => r.isVisible));
    expect(await categoryScopeWhere(undefined)).toEqual({});
  });
});

describe("sanitizePinnedCategoryIds", () => {
  it("없는 id·숨긴 id 를 빼고 중복을 없앤다", async () => {
    expect(await sanitizePinnedCategoryIds([30, 31, 999, 30, 3])).toEqual([30, 3]);
  });
});

describe("resolveCategoryIdByName", () => {
  it("이름이 같은 카테고리 id", async () => {
    expect(await resolveCategoryIdByName("햄스터")).toBe(30);
    expect(await resolveCategoryIdByName(" 파충류 ")).toBe(3);
  });
  it("레거시 별칭은 곤충 → 없으면 기타, 빈 값은 null", async () => {
    expect(await resolveCategoryIdByName("기타곤충")).toBe(8);
    expect(await resolveCategoryIdByName("알 수 없음")).toBe(8);
    expect(await resolveCategoryIdByName("")).toBeNull();
    expect(await resolveCategoryIdByName(null)).toBeNull();
  });
  it("숨긴 카테고리 이름도 id 를 준다(쓰기는 막지 않는다)", async () => {
    expect(await resolveCategoryIdByName("강아지")).toBe(31);
  });
});
