import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  purchase: { findMany: jest.fn() },
  fav: { findMany: jest.fn() },
  sale: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  review: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import favsHandler from "../pages/api/users/[id]/favs";
import purchasesHandler from "../pages/api/users/[id]/purchases";
import salesHandler from "../pages/api/users/[id]/sales";

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader() {},
  };
  return res;
}

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

const me = { id: 7, name: "브리더" } as NextApiRequest["user"];
const other = { id: 99, name: "남" } as NextApiRequest["user"];

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.purchase.findMany.mockResolvedValue([]);
  mockClient.fav.findMany.mockResolvedValue([]);
  mockClient.sale.findMany.mockResolvedValue([]);
  mockClient.user.findMany.mockResolvedValue([]);
  mockClient.review.findMany.mockResolvedValue([]);
});

describe("GET /api/users/:id/favs (관심목록) 는 본인만 볼 수 있다", () => {
  const findMany = mockClient.fav.findMany;

  it("비로그인이면 401 로 막고 조회하지 않는다", async () => {
    const res = await call(favsHandler, { method: "GET", query: { id: "7" } });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toEqual(expect.any(String));
    expect(findMany).not.toHaveBeenCalled();
  });

  it("다른 사용자의 기록이면 403 으로 막고 조회하지 않는다", async () => {
    const res = await call(favsHandler, { method: "GET", user: other, query: { id: "7" } });
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/본인/);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("숫자가 아닌 id 는 본인이 아니므로 403 이다", async () => {
    const res = await call(favsHandler, { method: "GET", user: me, query: { id: "abc" } });
    expect(res.statusCode).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("본인이면 200 으로 주고 삭제·숨김 상품은 뺀다", async () => {
    const res = await call(favsHandler, { method: "GET", user: me, query: { id: "7" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, mySellHistoryData: [] });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toEqual({
      userId: 7,
      product: { isDeleted: false, isHidden: false },
    });
  });
});

describe("GET /api/users/:id/purchases (구매내역) 는 공개다", () => {
  const findMany = mockClient.purchase.findMany;

  it.each([
    ["비로그인", undefined],
    ["다른 사용자", other],
  ])("%s 도 200 으로 볼 수 있다(삭제·숨김 상품은 뺀다)", async (_who, user) => {
    const res = await call(purchasesHandler, { method: "GET", user, query: { id: "7" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, mySellHistoryData: [] });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toEqual({
      userId: 7,
      status: { not: "cancelled" },
      product: { isDeleted: false, isHidden: false },
    });
  });

  it("본인에게는 삭제·숨김 상품도 기록으로 남긴다(historyWhere 본인 규칙, 되돌린 기록만 뺀다)", async () => {
    const res = await call(purchasesHandler, { method: "GET", user: me, query: { id: "7" } });
    expect(res.statusCode).toBe(200);
    expect(findMany.mock.calls[0][0].where).toEqual({ userId: 7, status: { not: "cancelled" } });
  });
});

describe("GET /api/users/:id/sales (판매내역) 는 공개를 유지한다", () => {
  it.each([
    ["비로그인", undefined],
    ["다른 사용자", other],
  ])("%s 도 200 으로 볼 수 있다(삭제·숨김 상품은 뺀다)", async (_who, user) => {
    const res = await call(salesHandler, { method: "GET", user, query: { id: "7" } });
    expect(res.statusCode).toBe(200);
    expect(mockClient.sale.findMany.mock.calls[0][0].where).toEqual({
      userId: 7,
      status: { not: "cancelled" },
      product: { isDeleted: false, isHidden: false },
    });
  });

  it("본인에게만 입양자·입양 확정·받은 거래 후기를 붙이고, 다른 사람에게는 입양자 칸을 빼고 준다", async () => {
    mockClient.sale.findMany.mockResolvedValue([
      { id: 1, userId: 7, productId: 3, buyerId: 8, buyerSource: "bredy", buyerAssignedAt: new Date(), product: { id: 3 } },
    ]);
    mockClient.user.findMany.mockResolvedValue([{ id: 8, name: "입양자", avatar: null }]);
    mockClient.purchase.findMany.mockResolvedValue([{ productId: 3, userId: 8 }]);
    mockClient.review.findMany.mockResolvedValue([{ id: 5, productId: 3, reply: null, isHidden: false }]);

    const mine = await call(salesHandler, { method: "GET", user: me, query: { id: "7" } });
    expect(mine.body.mySellHistoryData[0]).toMatchObject({
      buyer: { id: 8, name: "입양자", avatar: null },
      buyerSource: "bredy",
      purchaseConfirmed: true,
      tradeReview: { id: 5, hasReply: false, hidden: false },
    });
    expect(mine.body.mySellHistoryData[0]).not.toHaveProperty("buyerId");
    expect(mockClient.review.findMany.mock.calls[0][0].where).toEqual({
      productId: { in: [3] },
      createdForId: 7,
    });

    const theirs = await call(salesHandler, { method: "GET", user: other, query: { id: "7" } });
    const row = theirs.body.mySellHistoryData[0];
    for (const key of ["buyer", "buyerId", "buyerSource", "buyerAssignedAt", "purchaseConfirmed", "tradeReview"]) {
      expect(row).not.toHaveProperty(key);
    }
  });
});
