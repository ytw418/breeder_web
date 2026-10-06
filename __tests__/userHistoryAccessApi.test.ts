import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  purchase: { findMany: jest.fn() },
  fav: { findMany: jest.fn() },
  sale: { findMany: jest.fn() },
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
});

describe.each([
  ["purchases", "구매내역", purchasesHandler, mockClient.purchase.findMany],
  ["favs", "관심목록", favsHandler, mockClient.fav.findMany],
] as const)("GET /api/users/:id/%s (%s) 는 본인만 볼 수 있다", (_kind, _label, handler, findMany) => {
  it("비로그인이면 401 로 막고 조회하지 않는다", async () => {
    const res = await call(handler, { method: "GET", query: { id: "7" } });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toEqual(expect.any(String));
    expect(findMany).not.toHaveBeenCalled();
  });

  it("다른 사용자의 기록이면 403 으로 막고 조회하지 않는다", async () => {
    const res = await call(handler, { method: "GET", user: other, query: { id: "7" } });
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/본인/);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("숫자가 아닌 id 는 본인이 아니므로 403 이다", async () => {
    const res = await call(handler, { method: "GET", user: me, query: { id: "abc" } });
    expect(res.statusCode).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("본인이면 200 으로 기록을 준다", async () => {
    const res = await call(handler, { method: "GET", user: me, query: { id: "7" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, mySellHistoryData: [] });
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});

describe("본인 조회의 where 는 기존 규칙을 유지한다", () => {
  it("구매내역은 삭제·숨김 상품도 기록으로 남긴다(historyWhere 본인 규칙)", async () => {
    await call(purchasesHandler, { method: "GET", user: me, query: { id: "7" } });
    expect(mockClient.purchase.findMany.mock.calls[0][0].where).toEqual({ userId: 7 });
  });

  it("관심목록은 삭제·숨김 상품을 뺀다", async () => {
    await call(favsHandler, { method: "GET", user: me, query: { id: "7" } });
    expect(mockClient.fav.findMany.mock.calls[0][0].where).toEqual({
      userId: 7,
      product: { isDeleted: false, isHidden: false },
    });
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
      product: { isDeleted: false, isHidden: false },
    });
  });
});
