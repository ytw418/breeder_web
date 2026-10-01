import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  product: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
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
jest.mock("@libs/server/home", () => ({
  fetchProductsResponse: jest.fn(),
}));

import createHandler from "../pages/api/products/index";
import detailHandler from "../pages/api/products/[id]/index";

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
const validData = {
  name: "왕사슴 유충",
  price: 10000,
  description: "건강한 3령 유충입니다.",
  photos: ["img-1"],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.product.findUnique.mockResolvedValue({
    id: 3,
    userId: 7,
    name: "기존 상품",
    status: "판매중",
    user: { id: 7, name: "브리더", avatar: null },
  });
  mockClient.product.update.mockImplementation(({ data }) =>
    Promise.resolve({ id: 3, ...data })
  );
  mockClient.product.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 10, ...data })
  );
  mockClient.user.findUnique.mockResolvedValue(null);
});

const update = (data: Record<string, unknown>) =>
  call(detailHandler, {
    method: "POST",
    user: me,
    query: { id: "3" },
    body: { action: "update", data },
  });

describe("POST /api/products/:id (update)", () => {
  it.each([
    ["상품명 1자", { name: "가" }, "PRODUCT_INVALID_NAME"],
    ["상품명 61자", { name: "가".repeat(61) }, "PRODUCT_INVALID_NAME"],
    ["가격 1원", { price: 1 }, "PRODUCT_INVALID_PRICE"],
    ["가격 99원", { price: 99 }, "PRODUCT_INVALID_PRICE"],
    ["가격 10억+1", { price: 1_000_000_001 }, "PRODUCT_INVALID_PRICE"],
    ["설명 9자", { description: "가".repeat(9) }, "PRODUCT_INVALID_DESCRIPTION"],
    ["설명 3001자", { description: "가".repeat(3001) }, "PRODUCT_INVALID_DESCRIPTION"],
  ])("%s 는 400으로 거절하고 저장하지 않는다", async (_label, patch, code) => {
    const res = await update({ ...validData, ...patch });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe(code);
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });

  it("경계값(2자·100원·10자, 60자·10억·3000자)은 저장한다", async () => {
    let res = await update({ ...validData, name: "가나", price: 100, description: "가".repeat(10) });
    expect(res.statusCode).toBe(200);
    res = await update({
      ...validData,
      name: "가".repeat(60),
      price: 1_000_000_000,
      description: "가".repeat(3000),
    });
    expect(res.statusCode).toBe(200);
    expect(mockClient.product.update).toHaveBeenCalledTimes(2);
  });

  it("상품명은 앞뒤 공백을 지우고 가격은 숫자로 저장한다", async () => {
    const res = await update({ ...validData, name: "  왕사슴 유충  ", price: "10000" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.product.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: {
        name: "왕사슴 유충",
        price: 10000,
        description: validData.description,
        photos: validData.photos,
      },
    });
  });

  it("data 가 없으면 400", async () => {
    const res = await call(detailHandler, {
      method: "POST",
      user: me,
      query: { id: "3" },
      body: { action: "update" },
    });
    expect(res.statusCode).toBe(400);
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/products (create)", () => {
  const create = (body: Record<string, unknown>) =>
    call(createHandler, { method: "POST", user: me, body });

  it("수정과 같은 규칙으로 잘못된 값을 거절한다", async () => {
    const res = await create({ ...validData, price: 99 });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("PRODUCT_INVALID_PRICE");
    expect(mockClient.product.create).not.toHaveBeenCalled();
  });

  it("정상 값은 등록한다", async () => {
    const res = await create(validData);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClient.product.create).toHaveBeenCalled();
  });
});
