/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/users/:id/on-sale — 프로필 '지금 분양 중' 줄(앱 docs/prd/profile.md v5 F-17).
 * 판매중·예약중 상품 + 진행 중(마감 전) 경매. 경매(마감 임박순) → 상품(최신순), limit 로 자르고 total 은 전체 수.
 */

const mockClient = {
  product: { findMany: jest.fn(), count: jest.fn() },
  auction: { findMany: jest.fn(), count: jest.fn() },
  userBlock: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));

import onSaleHandler from "../pages/api/users/[id]/on-sale";

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

async function call(query: Record<string, string>, user?: { id: number }) {
  const res = createRes();
  await onSaleHandler(
    { method: "GET", headers: {}, query, body: {}, cookies: {}, user } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const at = (d: number) => new Date(Date.UTC(2026, 9, d));
const product = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `상품 ${id}`,
  price: 10000 * id,
  photos: [`p${id}`],
  mainImage: null,
  status: "판매중",
  dealType: "adoption",
  createdAt: at(id),
  ...overrides,
});
const auction = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `경매 ${id}`,
  currentPrice: 5000 * id,
  startPrice: 1000,
  photos: [`a${id}`],
  endAt: at(20 + id),
  createdAt: at(id),
  _count: { bids: id },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.product.findMany.mockResolvedValue([product(3), product(2)]);
  mockClient.product.count.mockResolvedValue(2);
  mockClient.auction.findMany.mockResolvedValue([auction(1)]);
  mockClient.auction.count.mockResolvedValue(1);
});

describe("GET /api/users/:id/on-sale", () => {
  it("판매중·예약중이고 지우거나 숨기지 않은 상품을 최신순으로 찾는다", async () => {
    await call({ id: "5" });
    const args = mockClient.product.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      userId: 5,
      isDeleted: false,
      isHidden: false,
      status: { in: ["판매중", "예약중"] },
    });
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(args.take).toBe(10);
  });

  it("진행 중이고 마감 전인 경매를 마감 임박순으로 찾는다(정산이 늦어도 지난 경매는 빠진다)", async () => {
    await call({ id: "5" });
    const args = mockClient.auction.findMany.mock.calls[0][0];
    expect(args.where.userId).toBe(5);
    expect(args.where.isHidden).toBe(false);
    expect(args.where.status).toBe("진행중");
    expect(args.where.endAt.gt).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual([{ endAt: "asc" }, { id: "asc" }]);
  });

  it("경매를 먼저, 상품을 뒤에 두고 total 은 전체 수", async () => {
    const res = await call({ id: "5" });
    expect(res.body.items.map((item: { kind: string; id: number }) => `${item.kind}:${item.id}`)).toEqual([
      "auction:1",
      "product:3",
      "product:2",
    ]);
    expect(res.body.total).toEqual({ products: 2, auctions: 1 });
    expect(res.body.items[0]).toMatchObject({
      kind: "auction",
      title: "경매 1",
      currentPrice: 5000,
      photo: "a1",
      bidCount: 1,
      endAt: at(21).toISOString(),
    });
    expect(res.body.items[1]).toMatchObject({
      kind: "product",
      name: "상품 3",
      price: 30000,
      status: "판매중",
      dealType: "adoption",
      photo: "p3",
    });
  });

  it("limit 으로 자르되 total 은 그대로, limit 상한은 20", async () => {
    const res = await call({ id: "5", limit: "2" });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toEqual({ products: 2, auctions: 1 });
    await call({ id: "5", limit: "99" });
    expect(mockClient.product.findMany.mock.calls[1][0].take).toBe(20);
  });

  it("대표 이미지가 있으면 그것을, 사진이 없으면 null", async () => {
    mockClient.product.findMany.mockResolvedValue([
      product(4, { mainImage: "main" }),
      product(5, { photos: [] }),
    ]);
    mockClient.auction.findMany.mockResolvedValue([]);
    const res = await call({ id: "5" });
    expect(res.body.items.map((item: { photo: string | null }) => item.photo)).toEqual(["main", null]);
  });

  it("숫자가 아닌 id 는 404", async () => {
    const res = await call({ id: "abc" });
    expect(res.statusCode).toBe(404);
    expect(mockClient.product.findMany).not.toHaveBeenCalled();
  });

  it("비로그인은 짧게 공개 캐시, 로그인 viewer 는 캐시하지 않는다", async () => {
    const anon = await call({ id: "5" });
    expect(anon.headers["cache-control"]).toContain("s-maxage=30");
    const viewer = await call({ id: "5" }, { id: 9 });
    expect(viewer.headers["cache-control"]).toBe("private, no-store, max-age=0");
  });
});
