import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 앱 상품 목록 화면의 정렬·가격 범위 필터.
 * - sort: latest(기본) | popular(관심 수) | priceAsc | priceDesc
 * - minPrice / maxPrice: 0 이상의 정수만 받는다. 뒤바뀌어 오면 바로잡는다.
 * - 정렬이 같은 상품끼리는 최신순 → id 순으로 이어 붙여 페이지가 넘어가도 순서가 흔들리지 않게 한다.
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test";

const mockClient = {
  product: { findMany: jest.fn(), count: jest.fn() },
  userBlock: { findMany: jest.fn() },
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

  it("정확한 price 가 있으면 범위보다 우선한다(무료나눔 링크 유지)", async () => {
    await list({ price: "0", minPrice: "1000" });
    expect(lastFindMany().where.price).toBe(0);
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
});
