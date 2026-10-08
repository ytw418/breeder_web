/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 카테고리 고정(Pin) API: 목록 /api/categories, 고정 저장 /api/users/me,
 * 범위 필터 /api/posts?categoryPath=, 범위 탑브리더 /api/rankings/breeders?categoryPath=.
 */

const TREE = [
  { id: 5, name: "포유류", slug: "mammal", parentId: null, path: "/mammal/", isVisible: true, sortOrder: 5 },
  { id: 30, name: "햄스터", slug: "hamster", parentId: 5, path: "/mammal/hamster/", isVisible: true, sortOrder: 2 },
  { id: 31, name: "강아지", slug: "dog", parentId: 5, path: "/mammal/dog/", isVisible: false, sortOrder: 7 },
  { id: 3, name: "파충류", slug: "reptile", parentId: null, path: "/reptile/", isVisible: true, sortOrder: 3 },
];

const mockClient = {
  category: { findMany: jest.fn(async () => TREE) },
  user: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  post: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(), create: jest.fn() },
  product: { groupBy: jest.fn() },
  userBlock: { findMany: jest.fn() },
  userBadge: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/adminAccess", () => ({
  hasAdminAccess: jest.fn(async () => false),
}));
jest.mock("@libs/server/notification", () => ({ notifyFollowers: jest.fn() }));
jest.mock("@libs/server/growth", () => ({
  incrementUserMissionProgress: jest.fn(),
  ensureAlertSubscription: jest.fn(),
  ensureCurrentWeeklySeason: jest.fn(),
}));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: () => [],
}));

import categoriesHandler from "../pages/api/categories/index";
import meHandler from "../pages/api/users/me/index";
import postsHandler from "../pages/api/posts/index";
import breedersHandler from "../pages/api/rankings/breeders";
import { invalidateCategoryCache } from "@libs/server/categories";

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
    },
  };
  return res;
}

const me = { id: 7, name: "브리디" } as NextApiRequest["user"];

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: Partial<NextApiRequest>
) {
  const res = createRes();
  await handler(
    { headers: {}, query: {}, body: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  invalidateCategoryCache();
  mockClient.category.findMany.mockResolvedValue(TREE);
  mockClient.user.update.mockResolvedValue({});
  mockClient.user.findMany.mockResolvedValue([]);
  mockClient.post.findMany.mockResolvedValue([]);
  mockClient.post.count.mockResolvedValue(0);
  mockClient.post.groupBy.mockResolvedValue([]);
  mockClient.product.groupBy.mockResolvedValue([]);
  mockClient.userBlock.findMany.mockResolvedValue([]);
  mockClient.userBadge.findMany.mockResolvedValue([]);
});

describe("GET /api/categories", () => {
  it("노출 카테고리만 부모 → 자식 순으로 주고 isVisible 은 내려주지 않는다", async () => {
    const res = await call(categoriesHandler, { method: "GET" });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.categories.map((c: { id: number }) => c.id)).toEqual([3, 5, 30]);
    expect(res.body.categories[0]).not.toHaveProperty("isVisible");
    expect(res.headers["cache-control"]).toContain("s-maxage=300");
  });
});

describe("/api/users/me 관심 카테고리 고정", () => {
  it("POST: 없는 id·숨긴 id 를 빼고 저장한 뒤 저장된 목록을 돌려준다", async () => {
    const res = await call(meHandler, {
      method: "POST",
      user: me,
      body: { pinnedCategoryIds: [30, 31, 999, 3] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, pinnedCategoryIds: [30, 3] });
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { pinnedCategoryIds: [30, 3] },
    });
  });

  it("POST: 빈 배열이면 해제", async () => {
    const res = await call(meHandler, { method: "POST", user: me, body: { pinnedCategoryIds: [] } });
    expect(res.body).toEqual({ success: true, pinnedCategoryIds: [] });
  });

  it("POST: 온보딩을 마쳤다는 표시는 처음 한 번만 기록한다(앱·웹 공유)", async () => {
    const res = await call(meHandler, { method: "POST", user: me, body: { categoryOnboarded: true } });
    expect(res.body).toEqual({ success: true, categoryOnboarded: true });
    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: 7, categoryOnboardedAt: null },
      data: { categoryOnboardedAt: expect.any(Date) },
    });
  });

  it("POST: categoryOnboarded 가 true 가 아니면 기록하지 않는다", async () => {
    const res = await call(meHandler, { method: "POST", user: me, body: { categoryOnboarded: "yes" } });
    expect(res.body).toEqual({ success: true });
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
  });

  it("POST: 배열이 아니거나 정수가 아니면 400", async () => {
    const res = await call(meHandler, { method: "POST", user: me, body: { pinnedCategoryIds: "30" } });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("INVALID_PINNED_CATEGORIES");
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("GET: 고정한 카테고리가 숨겨졌으면 빼서 저장하고 전체 보기로 돌려준다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 7, name: "브리디", pinnedCategoryIds: [31] });
    const res = await call(meHandler, { method: "GET", user: me });
    expect(res.body.profile.pinnedCategoryIds).toEqual([]);
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { pinnedCategoryIds: [] },
    });
  });

  it("GET: 고정 목록이 그대로 유효하면 저장하지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 7, name: "브리디", pinnedCategoryIds: [30] });
    const res = await call(meHandler, { method: "GET", user: me });
    expect(res.body.profile.pinnedCategoryIds).toEqual([30]);
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/posts?categoryPath=", () => {
  const whereOf = () => mockClient.post.findMany.mock.calls[0][0].where;

  it("포유류 고정이면 포유류 하위(숨긴 강아지 제외)만 센다", async () => {
    await call(postsHandler, { method: "GET", query: { categoryPath: "/mammal/" } });
    expect(whereOf().AND).toEqual([{ categoryId: { in: [5, 30] } }]);
  });

  it("복수 고정은 합집합(햄스터의 상위 포유류 자체 포함)", async () => {
    await call(postsHandler, { method: "GET", query: { categoryPath: "/mammal/hamster/,/reptile/" } });
    expect(whereOf().AND).toEqual([{ categoryId: { in: [3, 5, 30] } }]);
  });

  it("범위가 없으면 숨긴 카테고리 글만 뺀다", async () => {
    await call(postsHandler, { method: "GET", query: {} });
    expect(whereOf().AND).toEqual([{ OR: [{ categoryId: null }, { categoryId: { notIn: [31] } }] }]);
  });

  it("종 드롭다운(species=포유류)은 소분류 이름으로 저장된 글까지 카테고리 하위로 찾는다", async () => {
    await call(postsHandler, { method: "GET", query: { species: "포유류" } });
    expect(whereOf().type).toBeUndefined();
    expect(whereOf().AND).toEqual([
      { OR: [{ categoryId: null }, { categoryId: { notIn: [31] } }] },
      { categoryId: { in: [5, 30, 31] } },
    ]);
  });

  it("트리에 없는 종 이름은 예전처럼 이름으로 비교한다", async () => {
    await call(postsHandler, { method: "GET", query: { species: "없는종" } });
    expect(whereOf().type).toEqual({ in: ["없는종"] });
  });

  it("POST: 소분류(강아지) 이름도 그 categoryId 로 저장한다", async () => {
    mockClient.post.create = jest.fn(async () => ({ id: 1 }));
    mockClient.user.findUnique.mockResolvedValue({ name: "브리디" });
    await call(postsHandler, {
      method: "POST",
      user: me,
      body: { title: "제목", description: "내용", image: "img", category: "자유", species: "강아지" },
    });
    expect(mockClient.post.create.mock.calls[0][0].data).toMatchObject({ type: "강아지", categoryId: 31 });
  });

  it("POST: 종(species)에 맞는 categoryId 를 함께 저장한다", async () => {
    mockClient.post.create = jest.fn(async () => ({ id: 1 }));
    mockClient.user.findUnique.mockResolvedValue({ name: "브리디" });
    await call(postsHandler, {
      method: "POST",
      user: me,
      body: { title: "제목", description: "햄스터 키우는 이야기입니다", image: "img", category: "자유", species: "햄스터" },
    });
    expect(mockClient.post.create.mock.calls[0][0].data).toMatchObject({ type: "햄스터", categoryId: 30 });
  });
});

describe("GET /api/rankings/breeders?categoryPath=", () => {
  it("범위 안 게시글 + 상품×3 으로 점수를 매긴다", async () => {
    mockClient.user.findMany.mockResolvedValue([
      { id: 1, name: "가", avatar: null },
      { id: 2, name: "나", avatar: null },
      { id: 3, name: "다", avatar: null },
    ]);
    mockClient.post.groupBy.mockResolvedValue([
      { userId: 1, _count: { _all: 4 } },
      { userId: 2, _count: { _all: 1 } },
    ]);
    mockClient.product.groupBy.mockResolvedValue([{ userId: 2, _count: { _all: 2 } }]);

    const res = await call(breedersHandler, {
      method: "GET",
      // limit 을 비우면 Number("") = 0 → 1 로 잘리는 기존 동작이라 넉넉히 준다.
      query: { limit: "10", period: "all", categoryPath: "/mammal/" },
    });
    expect(res.body.success).toBe(true);
    expect(res.body.items.map((i: any) => [i.user.id, i.score, i.postsCount, i.productsCount])).toEqual([
      [2, 7, 1, 2],
      [1, 4, 4, 0],
    ]);
    // 범위 조건이 게시글·상품 집계 모두에 들어간다.
    expect(mockClient.post.groupBy.mock.calls[0][0].where).toMatchObject({
      categoryId: { in: [5, 30] },
      isHidden: false,
    });
    expect(mockClient.product.groupBy.mock.calls[0][0].where).toMatchObject({
      categoryId: { in: [5, 30] },
      isDeleted: false,
    });
  });

  it("범위에 맞는 카테고리가 없으면 빈 목록", async () => {
    const res = await call(breedersHandler, {
      method: "GET",
      query: { period: "all", categoryPath: "/nope/" },
    });
    expect(res.body.items).toEqual([]);
    expect(mockClient.post.groupBy).not.toHaveBeenCalled();
  });
});
