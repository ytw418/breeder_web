import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  product: { findUnique: jest.fn(), update: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import viewHandler from "../pages/api/products/[id]/view";

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

async function call(req: Partial<NextApiRequest>) {
  const res = createRes();
  await viewHandler(
    { headers: {}, query: {}, body: {}, method: "POST", ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const seller = { id: 7, name: "판매자" } as NextApiRequest["user"];
const viewer = { id: 8, name: "구경꾼" } as NextApiRequest["user"];

const liveProduct = { id: 3, userId: 7, isDeleted: false, isHidden: false, viewCount: 4 };

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.product.findUnique.mockResolvedValue(liveProduct);
  mockClient.product.update.mockResolvedValue({ viewCount: 5 });
});

describe("POST /api/products/:id/view (조회수)", () => {
  it.each([
    ["비로그인", undefined],
    ["다른 사용자", viewer],
  ])("%s 가 보면 조회수를 1 올린다", async (_who, user) => {
    const res = await call({ user, query: { id: "3" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, counted: true, viewCount: 5 });
    expect(mockClient.product.update).toHaveBeenCalledTimes(1);
    expect(mockClient.product.update.mock.calls[0][0]).toMatchObject({
      where: { id: 3 },
      data: { viewCount: { increment: 1 } },
    });
  });

  it("슬러그가 붙은 id(3-상품명)도 상품 id 로 읽는다", async () => {
    const res = await call({ user: viewer, query: { id: "3-왕사슴-유충" } });
    expect(res.statusCode).toBe(200);
    expect(mockClient.product.findUnique.mock.calls[0][0].where).toEqual({ id: 3 });
    expect(mockClient.product.update.mock.calls[0][0].where).toEqual({ id: 3 });
  });

  it("판매자 본인이 보면 올리지 않고 200 으로 끝낸다", async () => {
    const res = await call({ user: seller, query: { id: "3" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, counted: false, viewCount: 4 });
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });

  it.each([
    ["삭제된", { isDeleted: true, isHidden: false }],
    ["숨김", { isDeleted: false, isHidden: true }],
  ])("%s 상품은 404 이고 올리지 않는다", async (_label, flags) => {
    mockClient.product.findUnique.mockResolvedValue({ ...liveProduct, ...flags });
    const res = await call({ user: viewer, query: { id: "3" } });
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });

  it("없는 상품은 404 다", async () => {
    mockClient.product.findUnique.mockResolvedValue(null);
    const res = await call({ query: { id: "404" } });
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });

  it("숫자가 아닌 id 는 400 이고 조회하지 않는다", async () => {
    const res = await call({ query: { id: "abc" } });
    expect(res.statusCode).toBe(400);
    expect(mockClient.product.findUnique).not.toHaveBeenCalled();
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });

  it("GET 은 405 다", async () => {
    const res = await call({ method: "GET", query: { id: "3" } });
    expect(res.statusCode).toBe(405);
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });
});
