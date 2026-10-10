import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  // 카테고리 고정 범위 헬퍼(libs/server/categories)가 읽는 트리. 비우면 범위 조건을 붙이지 않는다.
  category: { findMany: jest.fn(async () => []) },
  product: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  user: { findUnique: jest.fn() },
  purchase: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  fav: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
  sale: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
const mockCreateNotification = jest.fn();
jest.mock("@libs/server/notification", () => ({
  notifyFollowers: jest.fn(),
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));
jest.mock("@libs/server/home", () => ({
  fetchProductsResponse: jest.fn(),
}));

import createHandler from "../pages/api/products/index";
import detailHandler from "../pages/api/products/[id]/index";
import favsHandler from "../pages/api/users/[id]/favs";
import salesHandler from "../pages/api/users/[id]/sales";
import purchasesHandler from "../pages/api/users/[id]/purchases";
import favToggleHandler from "../pages/api/products/[id]/fav";

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
  category: "구피",
  productType: "생물",
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
    ["가격 -1원", { price: -1 }, "PRODUCT_INVALID_PRICE"],
    ["가격 1.5원", { price: 1.5 }, "PRODUCT_INVALID_PRICE"],
    ["가격 10억+1", { price: 1_000_000_001 }, "PRODUCT_INVALID_PRICE"],
    ["설명 9자", { description: "가".repeat(9) }, "PRODUCT_INVALID_DESCRIPTION"],
    ["설명 3001자", { description: "가".repeat(3001) }, "PRODUCT_INVALID_DESCRIPTION"],
    ["모르는 카테고리", { category: "강아지" }, "PRODUCT_INVALID_CATEGORY"],
    ["모르는 상품 타입", { productType: "기타" }, "PRODUCT_INVALID_PRODUCT_TYPE"],
  ])("%s 는 400으로 거절하고 저장하지 않는다", async (_label, patch, code) => {
    const res = await update({ ...validData, ...patch });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe(code);
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });

  it("경계값(2자·0원·10자, 60자·10억·3000자)은 저장한다", async () => {
    let res = await update({ ...validData, name: "가나", price: 0, description: "가".repeat(10) });
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
        category: "구피",
        // 테스트 트리가 비어 있어 종 → Category.id 매핑은 null 이다.
        categoryId: null,
        productType: "생물",
        mainImage: "img-1",
      },
    });
  });

  it("카테고리·상품 타입을 바꿔 저장한다", async () => {
    const res = await update({ category: "어류", productType: "용품" });
    expect(res.statusCode).toBe(200);
    const data = mockClient.product.update.mock.calls[0][0].data;
    expect(data.category).toBe("어류");
    expect(data.productType).toBe("용품");
  });

  it("보내지 않은 카테고리·상품 타입·사진은 건드리지 않는다", async () => {
    const res = await update({ name: "새 이름" });
    expect(res.statusCode).toBe(200);
    const data = mockClient.product.update.mock.calls[0][0].data;
    expect(data.category).toBeUndefined();
    expect(data.productType).toBeUndefined();
    expect(data.photos).toBeUndefined();
    expect(data).not.toHaveProperty("mainImage");
  });

  it("사진 순서를 바꾸면 대표 이미지도 첫 장으로 바뀐다", async () => {
    await update({ photos: ["img-2", "img-1"] });
    expect(mockClient.product.update.mock.calls[0][0].data).toMatchObject({
      photos: ["img-2", "img-1"],
      mainImage: "img-2",
    });
  });

  it("사진을 모두 지우면 대표 이미지도 비운다", async () => {
    await update({ photos: [] });
    expect(mockClient.product.update.mock.calls[0][0].data).toMatchObject({
      photos: [],
      mainImage: null,
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
    const res = await create({ ...validData, price: -1 });
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

  it("0원은 무료나눔으로 등록한다", async () => {
    const res = await create({ ...validData, price: 0 });
    expect(res.statusCode).toBe(200);
    expect(mockClient.product.create.mock.calls[0][0].data.price).toBe(0);
  });

  it.each([
    ["카테고리 없음", { category: undefined }, "PRODUCT_INVALID_CATEGORY"],
    ["빈 카테고리", { category: "" }, "PRODUCT_INVALID_CATEGORY"],
    ["모르는 카테고리", { category: "강아지" }, "PRODUCT_INVALID_CATEGORY"],
    ["상품 타입 없음", { productType: undefined }, "PRODUCT_INVALID_PRODUCT_TYPE"],
    ["모르는 상품 타입", { productType: "기타" }, "PRODUCT_INVALID_PRODUCT_TYPE"],
  ])("%s 는 400으로 거절한다", async (_label, patch, code) => {
    const res = await create({ ...validData, ...patch });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe(code);
    expect(mockClient.product.create).not.toHaveBeenCalled();
  });

  it("검사한 카테고리·상품 타입을 저장한다(레거시 별칭 포함)", async () => {
    const res = await create({ ...validData, category: " 기타곤충 ", productType: "용품" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.product.create.mock.calls[0][0].data).toMatchObject({
      category: "기타곤충",
      productType: "용품",
    });
  });
});

describe("상품 사진 최대 10장", () => {
  const photos = (n: number) => Array.from({ length: n }, (_, i) => `img-${i + 1}`);
  const create = (body: Record<string, unknown>) =>
    call(createHandler, { method: "POST", user: me, body });

  it("등록: 10장은 저장하고 대표 이미지는 첫 장", async () => {
    const res = await create({ ...validData, photos: photos(10) });
    expect(res.statusCode).toBe(200);
    const data = mockClient.product.create.mock.calls[0][0].data;
    expect(data.photos).toEqual(photos(10));
    expect(data.mainImage).toBe("img-1");
  });

  it("등록: 11장은 400 PRODUCT_TOO_MANY_PHOTOS", async () => {
    const res = await create({ ...validData, photos: photos(11) });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("PRODUCT_TOO_MANY_PHOTOS");
    expect(mockClient.product.create).not.toHaveBeenCalled();
  });

  it("등록: 사진 0장도 허용", async () => {
    const res = await create({ ...validData, photos: [] });
    expect(res.statusCode).toBe(200);
    const data = mockClient.product.create.mock.calls[0][0].data;
    expect(data.photos).toEqual([]);
    expect(data.mainImage).toBeNull();
  });

  it("수정: 10장은 저장, 11장은 400", async () => {
    let res = await update({ ...validData, photos: photos(10) });
    expect(res.statusCode).toBe(200);
    expect(mockClient.product.update.mock.calls[0][0].data.photos).toEqual(photos(10));

    res = await update({ ...validData, photos: photos(11) });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("PRODUCT_TOO_MANY_PHOTOS");
    expect(mockClient.product.update).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/products/:id (delete)", () => {
  const remove = (user = me) =>
    call(detailHandler, {
      method: "POST",
      user,
      query: { id: "3" },
      body: { action: "delete" },
    });

  it("행을 지우지 않고 isDeleted 로 표시한다(판매·구매 기록 보존)", async () => {
    const res = await remove();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockClient.product.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isDeleted: true },
    });
    expect(mockClient.product.delete).not.toHaveBeenCalled();
  });

  it("판매자가 아니면 403", async () => {
    const res = await remove({ id: 99, name: "남" } as NextApiRequest["user"]);
    expect(res.statusCode).toBe(403);
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });
});

describe("삭제한 상품에 대한 POST", () => {
  beforeEach(() => {
    mockClient.product.findUnique.mockResolvedValue({
      id: 3,
      userId: 7,
      name: "기존 상품",
      status: "판매완료",
      isDeleted: true,
      user: { id: 7, name: "브리더", avatar: null },
    });
  });

  it.each([
    ["update", { action: "update", data: validData }, me],
    ["delete", { action: "delete" }, me],
    ["status_change", { action: "status_change", data: { status: "예약중" } }, me],
    ["purchase", { action: "purchase" }, { id: 8, name: "구매자" } as NextApiRequest["user"]],
  ])("%s 는 404 로 막고 아무것도 바꾸지 않는다", async (_label, body, user) => {
    const res = await call(detailHandler, { method: "POST", user, query: { id: "3" }, body });
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockClient.product.update).not.toHaveBeenCalled();
    expect(mockClient.product.delete).not.toHaveBeenCalled();
    expect(mockClient.purchase.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/users/:id/favs (관심목록)", () => {
  it("삭제·숨김 상품은 관심목록에서 뺀다", async () => {
    mockClient.fav.findMany.mockResolvedValue([]);
    const res = await call(favsHandler, { method: "GET", user: me, query: { id: "7" } });
    expect(res.statusCode).toBe(200);
    expect(mockClient.fav.findMany.mock.calls[0][0].where).toEqual({
      userId: 7,
      product: { isDeleted: false, isHidden: false },
    });
  });
});

describe.each([
  ["sales", "판매내역", salesHandler, mockClient.sale.findMany],
  ["purchases", "구매내역", purchasesHandler, mockClient.purchase.findMany],
] as const)("GET /api/users/:id/%s (%s)", (_kind, _label, handler, findMany) => {
  beforeEach(() => {
    findMany.mockResolvedValue([]);
  });

  it("본인에게는 삭제·숨김 상품도 기록으로 남긴다(상품 상태로 거르지 않는다)", async () => {
    const res = await call(handler, { method: "GET", user: me, query: { id: "7" } });
    expect(res.statusCode).toBe(200);
    expect(findMany.mock.calls[0][0].where).toEqual({ userId: 7 });
  });

  it.each([
    ["비로그인", undefined],
    ["다른 사용자", { id: 99, name: "남" } as NextApiRequest["user"]],
  ])("%s 에게는 삭제·숨김 상품을 빼고 준다", async (_who, user) => {
    const res = await call(handler, { method: "GET", user, query: { id: "7" } });
    expect(res.statusCode).toBe(200);
    expect(findMany.mock.calls[0][0].where).toEqual({
      userId: 7,
      product: { isDeleted: false, isHidden: false },
    });
  });
});

describe("POST /api/products/:id/fav (찜 토글)", () => {
  const buyer = { id: 8, name: "구매자" } as NextApiRequest["user"];
  const toggle = () =>
    call(favToggleHandler, { method: "POST", user: buyer, query: { id: "3" } });

  it.each([
    ["삭제된", { isDeleted: true, isHidden: false }],
    ["숨김", { isDeleted: false, isHidden: true }],
  ])("%s 상품은 새로 찜하지 못하고(404) 판매자에게 알림도 가지 않는다", async (_label, flags) => {
    mockClient.product.findUnique.mockResolvedValue({ id: 3, userId: 7, ...flags });
    mockClient.fav.findFirst.mockResolvedValue(null);
    mockClient.user.findUnique.mockResolvedValue({ name: "구매자" });

    const res = await toggle();
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: "삭제된 분양글입니다." });
    expect(mockClient.fav.create).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("삭제된 상품이라도 이미 찜한 것은 해제할 수 있다", async () => {
    mockClient.product.findUnique.mockResolvedValue({ id: 3, userId: 7, isDeleted: true, isHidden: false });
    mockClient.fav.findFirst.mockResolvedValue({ id: 55 });

    const res = await toggle();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, action: "removed" });
    expect(mockClient.fav.delete).toHaveBeenCalledWith({ where: { id: 55 } });
  });

  it("살아 있는 상품은 찜하고 판매자에게 알린다", async () => {
    mockClient.product.findUnique.mockResolvedValue({ id: 3, userId: 7, isDeleted: false, isHidden: false });
    mockClient.fav.findFirst.mockResolvedValue(null);
    mockClient.user.findUnique.mockResolvedValue({ name: "구매자" });

    const res = await toggle();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, action: "added" });
    expect(mockClient.fav.create).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "FAV", userId: 7, senderId: 8, targetId: 3 })
    );
  });
});
