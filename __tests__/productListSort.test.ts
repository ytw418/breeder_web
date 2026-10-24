import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 앱 상품 목록 화면의 정렬·가격 범위 필터.
 * - sort: latest(기본) | popular(관심 수) | priceAsc | priceDesc
 * - minPrice / maxPrice: 0 이상의 정수만 받는다. 뒤바뀌어 오면 바로잡는다.
 * - 정렬이 같은 상품끼리는 최신순 → id 순으로 이어 붙여 페이지가 넘어가도 순서가 흔들리지 않게 한다.
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test";

const mockClient = {
  // 카테고리 고정 범위 헬퍼(libs/server/categories)가 읽는 트리. 비우면 범위 조건을 붙이지 않는다.
  category: { findMany: jest.fn(async () => []) },
  product: { findMany: jest.fn(), count: jest.fn() },
  userBlock: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/notification", () => ({
  notifyFollowers: jest.fn(),
}));
jest.mock("@libs/server/growth", () => ({
  incrementUserMissionProgress: jest.fn(),
  ensureAlertSubscription: jest.fn(),
  ensureCurrentWeeklySeason: jest.fn(),
  getUserMissionSummary: jest.fn(),
}));
jest.mock("@libs/server/ranking", () => ({}));
jest.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

import productsHandler from "../pages/api/products/index";
import { getProductsResponse } from "@libs/server/home";

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

async function list(query: Record<string, string>) {
  const res = createRes();
  await productsHandler(
    { method: "GET", headers: {}, query, body: {}, cookies: {} } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const lastFindMany = () => mockClient.product.findMany.mock.calls.at(-1)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.product.findMany.mockResolvedValue([]);
  mockClient.product.count.mockResolvedValue(0);
  mockClient.userBlock.findMany.mockResolvedValue([]);
});

describe("GET /api/products 정렬", () => {
  it("sort 가 없으면 기존처럼 최신순이다", async () => {
    await list({});
    expect(lastFindMany().orderBy).toEqual({ createdAt: "desc" });
  });

  it("sort=popular 는 관심(찜) 수가 많은 순, 같으면 최신순", async () => {
    const res = await list({ sort: "popular" });
    expect(res.statusCode).toBe(200);
    expect(lastFindMany().orderBy).toEqual([
      { favs: { _count: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("sort=priceAsc 는 가격 낮은 순, 가격 없는 상품은 맨 뒤", async () => {
    await list({ sort: "priceAsc" });
    expect(lastFindMany().orderBy).toEqual([
      { price: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("sort=priceDesc 는 가격 높은 순, 가격 없는 상품은 맨 뒤", async () => {
    await list({ sort: "priceDesc" });
    expect(lastFindMany().orderBy).toEqual([
      { price: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("모르는 sort 값은 최신순으로 처리한다", async () => {
    await list({ sort: "random" });
    expect(lastFindMany().orderBy).toEqual({ createdAt: "desc" });
  });

  it("정렬을 바꾸면 필터 목록 캐시(30초)를 쓴다", async () => {
    const res = await list({ sort: "popular" });
    expect(res.headers["cache-control"]).toMatch(/s-maxage=30,/);
  });
});

describe("GET /api/products 가격 범위", () => {
  it("minPrice·maxPrice 를 gte·lte 로 건다", async () => {
    await list({ minPrice: "10000", maxPrice: "50000" });
    expect(lastFindMany().where).toEqual({
      isHidden: false,
      isDeleted: false,
      externalSource: null,
      price: { gte: 10000, lte: 50000 },
    });
    expect(mockClient.product.count.mock.calls.at(-1)[0].where).toEqual(
      lastFindMany().where
    );
  });

  it("한쪽만 오면 그쪽만 건다", async () => {
    await list({ minPrice: "5000" });
    expect(lastFindMany().where.price).toEqual({ gte: 5000 });
    await list({ maxPrice: "0" });
    expect(lastFindMany().where.price).toEqual({ lte: 0 });
  });

  it("min 이 max 보다 크면 서로 바꿔 건다", async () => {
    await list({ minPrice: "50000", maxPrice: "10000" });
    expect(lastFindMany().where.price).toEqual({ gte: 10000, lte: 50000 });
  });

  it("0 이상의 정수가 아니면 무시한다", async () => {
    for (const bad of ["abc", "-1", "1.5", ""]) {
      await list({ minPrice: bad, maxPrice: bad });
      expect(lastFindMany().where.price).toBeUndefined();
    }
  });

  it("정확한 price 가 있으면 범위보다 우선한다(무료 분양 링크 유지)", async () => {
    await list({ price: "0", minPrice: "1000" });
    expect(lastFindMany().where.price).toBe(0);
  });

  // price 컬럼은 INT4 라 그보다 큰 값을 넘기면 Prisma 오류로 500 이 났다.
  it("INT4 최대값보다 큰 가격은 INT4 최대값으로 잘라 건다(500 이 나지 않는다)", async () => {
    let res = await list({ maxPrice: "9999999999" });
    expect(res.statusCode).toBe(200);
    expect(lastFindMany().where.price).toEqual({ lte: 2147483647 });

    res = await list({ minPrice: "99999999999999999999999", maxPrice: "1000" });
    expect(res.statusCode).toBe(200);
    expect(lastFindMany().where.price).toEqual({ gte: 1000, lte: 2147483647 });

    res = await list({ price: "9999999999" });
    expect(res.statusCode).toBe(200);
    expect(lastFindMany().where.price).toBe(2147483647);
  });
});

describe("GET /api/products 보호소 글(externalSource)", () => {
  // 앱 docs/prd/shelter-animals.md AC-6·AC-7
  it("기본 목록·가족을 기다려요는 보호소 글을 빼고, source=shelter 는 보호소 글만 같은 시/도 먼저 준다", async () => {
    for (const query of [{}, { dealType: "rehoming" }, { dealGroup: "adoption" }] as Record<string, string>[]) {
      await list(query);
      expect(lastFindMany().where.externalSource).toBeNull();
    }

    // 비로그인: 시/도 순서 없이 보호소 글만 최신순.
    await list({ source: "shelter" });
    expect(lastFindMany().where.externalSource).toEqual({ not: null });
    // 보호소 목록은 최신순에 id 로 동점을 정리한다(공고 시작일이 같은 글이 많다).
    expect(lastFindMany().orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);

    // 로그인(서울): 서울 묶음 → 나머지 묶음 순으로 이어 페이지 창을 맞춘다. 서울 3건 + 나머지 5건, size 2 의 2번째 페이지 = 서울 마지막 1건 + 나머지 1건.
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "서울" });
    const isSeoul = (where: unknown) => JSON.stringify(where).includes('"regionSido":"서울"');
    mockClient.product.count.mockImplementation(async ({ where }: any) => (isSeoul(where) ? 3 : 5));
    mockClient.product.findMany.mockImplementation(async ({ where, skip, take }: any) =>
      Array.from({ length: take }, (_, i) => ({ id: (isSeoul(where) ? 10 : 100) + skip + i, user: { breederPrograms: [] } }))
    );
    const res = createRes();
    await productsHandler(
      { method: "GET", headers: {}, query: { source: "shelter", page: "2", size: "2" }, body: {}, cookies: {}, user: { id: 7 } } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );
    expect(res.body.products.map((p: any) => p.id)).toEqual([12, 100]);
    expect(res.body).toMatchObject({ total: 8, pages: 4 });
    expect(res.headers["cache-control"]).toMatch(/private/);
  });
});

describe("GET /api/products 보호소 필터(지역·품종·크기·마감순)", () => {
  it("지역·품종·크기는 AND 로 걸고(크기 키는 dogSize), 고양이에는 크기를 걸지 않으며, sort=deadline 은 마감 안 지난 공고를 마감 임박순으로 먼저 준다", async () => {
    const res = await list({ source: "shelter", sido: "경기도", sigungu: "수원시,화성시", breed: "말티즈", dogSize: "medium", size: "12" });
    expect(lastFindMany().where.AND).toEqual([
      { regionSido: { in: ["경기도"] } },
      { regionSigungu: { in: ["수원시", "화성시"] } },
      { externalBreed: { in: ["말티즈"] } },
      { externalWeightKg: { gt: 7, lte: 15 } },
    ]);
    expect(lastFindMany().take).toBe(12);
    expect(res.headers["cache-control"]).toContain("s-maxage=30");

    await list({ source: "shelter", category: "고양이", dogSize: "large" });
    expect(JSON.stringify(lastFindMany().where)).not.toContain("externalWeightKg");

    // 마감 안 지난 공고 3건(마감 임박순) 뒤에 마감을 모르거나 지난 공고. size 2 의 2번째 쪽 = A 마지막 1건 + B 1건.
    const ongoing = (where: unknown) => JSON.stringify(where).includes('"externalNoticeEnd":{"gte"');
    mockClient.product.count.mockImplementation(async ({ where }: any) => (ongoing(where) ? 3 : 4));
    mockClient.product.findMany.mockImplementation(async ({ where, orderBy, skip, take }: any) =>
      Array.from({ length: take }, (_, i) => ({
        id: (ongoing(where) ? 10 : 100) + skip + i,
        order: orderBy,
        user: { breederPrograms: [] },
      }))
    );
    const deadline = await list({ source: "shelter", sort: "deadline", page: "2", size: "2" });
    expect(deadline.body.products.map((p: any) => p.id)).toEqual([12, 100]);
    expect(deadline.body.products[0].order).toEqual([{ externalNoticeEnd: "asc" }, { id: "desc" }]);
    expect(deadline.body).toMatchObject({ total: 7 });
  });
});

describe("GET /api/products 전체 개수", () => {
  it("조건에 맞는 전체 상품 수를 total 로 함께 준다", async () => {
    mockClient.product.count.mockResolvedValue(37);
    const res = await list({ category: "어류" });
    expect(res.body).toMatchObject({ success: true, total: 37, pages: 4 });
  });

  it("상품이 없으면 total 0", async () => {
    const res = await list({});
    expect(res.body).toMatchObject({ total: 0, pages: 0 });
  });
});

describe("getProductsResponse 기본 첫 페이지 캐시", () => {
  it("정렬·가격 범위가 있으면 캐시된 기본 목록을 쓰지 않는다", async () => {
    await getProductsResponse({ page: 1, size: 10, sort: "priceAsc" });
    expect(lastFindMany().orderBy).toEqual([
      { price: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
      { id: "desc" },
    ]);

    await getProductsResponse({ page: 1, size: 10, minPrice: 1000 });
    expect(lastFindMany().where.price).toEqual({ gte: 1000 });
  });

  it("다른 호출자가 INT4 를 넘는 가격을 넘겨도 INT4 최대값으로 자른다", async () => {
    await getProductsResponse({ maxPrice: 9_999_999_999 });
    expect(lastFindMany().where.price).toEqual({ lte: 2147483647 });

    await getProductsResponse({ price: 9_999_999_999 });
    expect(lastFindMany().where.price).toBe(2147483647);
  });
});
