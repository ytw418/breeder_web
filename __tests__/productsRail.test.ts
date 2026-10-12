/**
 * @jest-environment node
 */
/**
 * GET /api/products?rail=1 (AC-8): 최신 10 + 24시간 안 isNew, 조회자의 첫 분양글(24시간 안)은 맨 앞 고정.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-12T12:00:00.000Z");
const ago = (h: number) => new Date(NOW.getTime() - h * HOUR);
const product = (id: number, hoursAgo: number, userId = 1) => ({
  id,
  name: `개체 ${id}`,
  createdAt: ago(hoursAgo),
  userId,
  user: { id: userId, name: `u${userId}`, avatar: null, breederPrograms: [] },
  _count: { favs: 0 },
});

const mockClient = {
  category: { findMany: jest.fn(async () => []) },
  userBlock: { findMany: jest.fn(async (): Promise<any[]> => []) },
  product: { findMany: jest.fn(), findFirst: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
jest.mock("@libs/server/notification", () => ({ notifyFollowers: jest.fn() }));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: (rows: unknown[]) => rows,
}));

import productsHandler from "../pages/api/products/index";

async function getRail(query: Record<string, string>, user?: { id: number }) {
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
  await productsHandler(
    { method: "GET", headers: {}, query, body: {}, cookies: {}, user } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  mockClient.product.findMany.mockResolvedValue([product(10, 1), product(9, 30), product(8, 50)]);
  mockClient.product.findFirst.mockResolvedValue(null);
});
afterEach(() => jest.useRealTimers());

describe("GET /api/products?rail=1", () => {
  it("최신순, 24시간 안 글만 isNew, 비로그인은 고정 없음·공개 캐시", async () => {
    const res = await getRail({ rail: "1" });
    expect(res.body.items.map((p: any) => [p.id, p.isNew, p.pinnedFirst])).toEqual([
      [10, true, false],
      [9, false, false],
      [8, false, false],
    ]);
    const args = mockClient.product.findMany.mock.calls[0][0];
    expect(args.take).toBe(10);
    expect(args.where).toMatchObject({ isHidden: false, isDeleted: false, status: { not: "판매완료" } });
    expect(mockClient.product.findFirst).not.toHaveBeenCalled();
    expect(res.headers["cache-control"]).toContain("public");
  });

  it("조회자의 첫 분양글이 24시간 안이면 맨 앞 고정(목록 밖이어도 가져온다)", async () => {
    mockClient.product.findFirst
      .mockResolvedValueOnce({ id: 3, createdAt: ago(20) }) // 첫 분양글
      .mockResolvedValueOnce(product(3, 20, 7)); // 보이는 글
    const res = await getRail({ rail: "1", limit: "3" }, { id: 7 });
    expect(res.body.items.map((p: any) => [p.id, p.pinnedFirst, p.isNew])).toEqual([
      [3, true, true],
      [10, false, true],
      [9, false, false],
    ]);
    expect(res.headers["cache-control"]).toContain("private");
  });

  it("목록 안에 있으면 중복 없이 앞으로만 옮긴다", async () => {
    mockClient.product.findFirst.mockResolvedValueOnce({ id: 9, createdAt: ago(23) });
    mockClient.product.findMany.mockResolvedValue([product(10, 1), product(9, 23, 7), product(8, 50)]);
    const res = await getRail({ rail: "1" }, { id: 7 });
    expect(res.body.items.map((p: any) => p.id)).toEqual([9, 10, 8]);
    expect(mockClient.product.findFirst).toHaveBeenCalledTimes(1);
  });

  it("첫 분양글이 24시간 지났으면 고정하지 않는다", async () => {
    mockClient.product.findFirst.mockResolvedValueOnce({ id: 2, createdAt: ago(25) });
    const res = await getRail({ rail: "1" }, { id: 7 });
    expect(res.body.items.every((p: any) => !p.pinnedFirst)).toBe(true);
  });

  it("limit 은 최대 20", async () => {
    await getRail({ rail: "1", limit: "99" });
    expect(mockClient.product.findMany.mock.calls[0][0].take).toBe(20);
  });
});
