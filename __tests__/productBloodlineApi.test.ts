/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";

/**
 * 상품에 혈통 붙이기(설계 §3.5, PRD AC-97·AC-98).
 * - 등록: 혈통 필드가 없으면(구 앱) bloodlineRootId null. 보유 혈통·받은 출처 카드의 뿌리는 붙일 수 있다.
 *   남의 혈통 403 PRODUCT_BLOODLINE_FORBIDDEN, 없거나 회수된 혈통 400 PRODUCT_INVALID_BLOODLINE_ROOT,
 *   부모 정보만 오면 400 PRODUCT_PEDIGREE_WITHOUT_BLOODLINE. 붙이면 product_bloodline_attached 1회.
 * - 수정: 보낸 때만 갱신. bloodlineRootId:null 이면 부모 정보도 지운다.
 * - 상세: product.bloodline 요약(뷰어와 무관), 회수된 혈통이면 null.
 * - 목록: ?bloodlineRootId= 로 그 혈통 상품만.
 *
 * 혈통 권한·요약은 실제 libs/server/bloodline-link 를 쓰고, Prisma 만 메모리 행으로 흉내 낸다.
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test";

type CardRow = {
  id: number;
  cardType: "BLOODLINE" | "LINE";
  status: "ACTIVE" | "INACTIVE" | "REVOKED";
  name: string;
  speciesType: string | null;
  originSido: string | null;
  originSigungu: string | null;
  creatorId: number;
  currentOwnerId: number;
  bloodlineReferenceId: number | null;
  transferCount: number;
  createdAt: Date;
  creator: { id: number; name: string };
};

let cards: CardRow[] = [];

/** where 의 값이 모두 같은 행 중 첫 번째(orderBy createdAt asc 는 배열 순서와 같게 둔다). */
const findCard = jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
  const row = cards.find((card) =>
    Object.entries(where).every(([key, value]) => (card as Record<string, unknown>)[key] === value)
  );
  return row ?? null;
});

const mockClient = {
  category: { findMany: jest.fn(async () => []) },
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  purchase: { findFirst: jest.fn() },
  fav: { findFirst: jest.fn() },
  userBlock: { findMany: jest.fn(async () => []) },
  bloodlineCard: { findFirst: findCard },
  bloodlineCardTransfer: { findFirst: jest.fn() },
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
  createNotification: jest.fn(),
}));
const mockCapture = jest.fn();
jest.mock("@libs/server/analytics", () => ({
  captureServerEvent: (...args: unknown[]) => mockCapture(...args),
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
    { headers: {}, query: {}, body: {}, cookies: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const ME = 7;
const me = { id: ME, name: "브리더" } as NextApiRequest["user"];
const KANGSAN = { id: 1, name: "강산" };

const validData = {
  name: "왕사슴 유충",
  price: 10000,
  description: "건강한 3령 유충입니다.",
  photos: ["img-1"],
  category: "구피",
  productType: "생물",
};

const root = (patch: Partial<CardRow> = {}): CardRow => ({
  id: 10,
  cardType: "BLOODLINE",
  status: "ACTIVE",
  name: "강산 라인",
  speciesType: "왕사슴벌레",
  originSido: "충청남도",
  originSigungu: "공주시",
  creatorId: KANGSAN.id,
  currentOwnerId: KANGSAN.id,
  bloodlineReferenceId: null,
  transferCount: 0,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  creator: KANGSAN,
  ...patch,
});

/** 강산 혈통(10)의 출처 카드를 ownerId 가 받았다. */
const sourceCard = (ownerId: number, patch: Partial<CardRow> = {}): CardRow => ({
  ...root(),
  id: 20,
  cardType: "LINE",
  currentOwnerId: ownerId,
  bloodlineReferenceId: 10,
  createdAt: new Date("2026-09-12T03:00:00.000Z"),
  ...patch,
});

const existingProduct = (patch: Record<string, unknown> = {}) => ({
  id: 3,
  userId: ME,
  name: "기존 상품",
  status: "판매중",
  isDeleted: false,
  isHidden: false,
  bloodlineRootId: null,
  pedigreeNote: null,
  user: { id: ME, name: "브리더", avatar: null },
  _count: { favs: 0 },
  ...patch,
});

beforeEach(() => {
  jest.clearAllMocks();
  cards = [];
  mockClient.product.findUnique.mockResolvedValue(existingProduct());
  mockClient.product.findMany.mockResolvedValue([]);
  mockClient.product.count.mockResolvedValue(0);
  mockClient.product.update.mockImplementation(({ data }) => Promise.resolve({ id: 3, ...data }));
  mockClient.product.create.mockImplementation(({ data }) => Promise.resolve({ id: 30, ...data }));
  mockClient.user.findUnique.mockResolvedValue(null);
  mockClient.purchase.findFirst.mockResolvedValue(null);
  mockClient.fav.findFirst.mockResolvedValue(null);
  mockClient.bloodlineCardTransfer.findFirst.mockResolvedValue(null);
});

const create = (body: Record<string, unknown>) =>
  call(createHandler, { method: "POST", user: me, body: { ...validData, ...body } });

const update = (data: Record<string, unknown>) =>
  call(detailHandler, {
    method: "POST",
    user: me,
    query: { id: "3" },
    body: { action: "update", data },
  });

const createdData = () => mockClient.product.create.mock.calls[0][0].data;
const updatedData = () => mockClient.product.update.mock.calls[0][0].data;

describe("POST /api/products 혈통 붙이기(등록)", () => {
  it("구 앱 등록은 혈통 없이 저장한다", async () => {
    const res = await create({});
    expect(res.statusCode).toBe(200);
    expect(createdData().bloodlineRootId).toBeNull();
    expect(createdData()).not.toHaveProperty("pedigreeNote");
    expect(findCard).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("지금 보유한 혈통을 붙이고 부모 정보를 저장한다", async () => {
    cards = [root({ creatorId: ME, currentOwnerId: ME, creator: { id: ME, name: "브리더" } })];
    const res = await create({
      bloodlineRootId: 10,
      pedigreeNote: { generation: "F3", sireMm: 81.2, damMm: "47.5" },
    });
    expect(res.statusCode).toBe(200);
    expect(createdData().bloodlineRootId).toBe(10);
    expect(createdData().pedigreeNote).toEqual({ generation: "F3", sireMm: 81.2, damMm: 47.5 });
  });

  it("출처 카드를 받은 혈통도 붙일 수 있다", async () => {
    cards = [root(), sourceCard(ME)];
    const res = await create({ bloodlineRootId: 10 });
    expect(res.statusCode).toBe(200);
    expect(createdData().bloodlineRootId).toBe(10);
  });

  it("붙이면 계측을 1회 보낸다", async () => {
    cards = [root(), sourceCard(ME)];
    await create({ bloodlineRootId: 10, pedigreeNote: { generation: "F2" } });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(ME, "product_bloodline_attached", {
      product_id: 30,
      bloodline_id: 10,
      relation: "received",
      has_pedigree: true,
      generation: "F2",
    });
  });

  it("남의 혈통은 403", async () => {
    cards = [root()];
    const res = await create({ bloodlineRootId: 10 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("PRODUCT_BLOODLINE_FORBIDDEN");
    expect(mockClient.product.create).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("만든 사람이라도 혈통을 넘긴 뒤에는 403", async () => {
    cards = [root({ creatorId: ME, currentOwnerId: 2 })];
    const res = await create({ bloodlineRootId: 10 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("PRODUCT_BLOODLINE_FORBIDDEN");
  });

  it("회수된 혈통은 400", async () => {
    cards = [root({ status: "REVOKED", currentOwnerId: ME })];
    const res = await create({ bloodlineRootId: 10 });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("PRODUCT_INVALID_BLOODLINE_ROOT");
    expect(mockClient.product.create).not.toHaveBeenCalled();
  });

  it("출처 카드 id(LINE)를 뿌리 대신 보내면 400", async () => {
    cards = [root(), sourceCard(ME)];
    const res = await create({ bloodlineRootId: 20 });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("PRODUCT_INVALID_BLOODLINE_ROOT");
  });

  it.each([["abc"], [-1], [0], [1.5], [{}]])("혈통 id %p 는 400", async (value) => {
    const res = await create({ bloodlineRootId: value });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("PRODUCT_INVALID_BLOODLINE_ROOT");
    expect(mockClient.product.create).not.toHaveBeenCalled();
  });

  it("혈통 없이 부모 정보만 오면 400", async () => {
    const res = await create({ pedigreeNote: { generation: "F3" } });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("PRODUCT_PEDIGREE_WITHOUT_BLOODLINE");
    expect(mockClient.product.create).not.toHaveBeenCalled();
  });

  it.each([
    ["소수 둘째 자리", { sireMm: 81.25 }],
    ["범위 밖", { damMm: 501 }],
    ["모르는 누대", { generation: "F10" }],
    ["객체가 아님", "F3"],
  ])("부모 정보가 규칙 밖(%s)이면 400", async (_label, pedigreeNote) => {
    cards = [root({ currentOwnerId: ME })];
    const res = await create({ bloodlineRootId: 10, pedigreeNote });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("PRODUCT_INVALID_PEDIGREE_NOTE");
    expect(mockClient.product.create).not.toHaveBeenCalled();
  });

  it("모르는 키는 버리고, 세 값이 모두 비면 부모 정보를 저장하지 않는다", async () => {
    cards = [root({ currentOwnerId: ME })];
    await create({ bloodlineRootId: 10, pedigreeNote: { sireMm: "81.2", color: "red" } });
    expect(createdData().pedigreeNote).toEqual({ sireMm: 81.2 });

    mockClient.product.create.mockClear();
    await create({ bloodlineRootId: 10, pedigreeNote: { sireMm: "", generation: null } });
    expect(createdData().bloodlineRootId).toBe(10);
    expect(createdData()).not.toHaveProperty("pedigreeNote");
  });
});

describe("POST /api/products/:id 혈통 수정(보낸 때만 갱신)", () => {
  it("보내지 않은 혈통 필드는 건드리지 않는다", async () => {
    mockClient.product.findUnique.mockResolvedValue(
      existingProduct({ bloodlineRootId: 10, pedigreeNote: { generation: "F3" } })
    );
    const res = await update({ name: "새 이름" });
    expect(res.statusCode).toBe(200);
    expect(updatedData()).not.toHaveProperty("bloodlineRootId");
    expect(updatedData()).not.toHaveProperty("pedigreeNote");
    expect(findCard).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("혈통을 해제하면 부모 정보도 지운다", async () => {
    mockClient.product.findUnique.mockResolvedValue(
      existingProduct({ bloodlineRootId: 10, pedigreeNote: { generation: "F3" } })
    );
    const res = await update({ bloodlineRootId: null, pedigreeNote: { generation: "F3" } });
    expect(res.statusCode).toBe(200);
    expect(updatedData().bloodlineRootId).toBeNull();
    expect(updatedData().pedigreeNote).toBe(Prisma.DbNull);
  });

  it("혈통 해제만 보내도 부모 정보를 지운다", async () => {
    mockClient.product.findUnique.mockResolvedValue(existingProduct({ bloodlineRootId: 10 }));
    await update({ bloodlineRootId: null });
    expect(updatedData()).toMatchObject({ bloodlineRootId: null, pedigreeNote: Prisma.DbNull });
  });

  it("혈통이 없던 상품에 붙이면 저장하고 계측을 1회 보낸다", async () => {
    cards = [root({ currentOwnerId: ME })];
    const res = await update({ bloodlineRootId: 10, pedigreeNote: { damMm: 47.5 } });
    expect(res.statusCode).toBe(200);
    expect(updatedData()).toMatchObject({ bloodlineRootId: 10, pedigreeNote: { damMm: 47.5 } });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(ME, "product_bloodline_attached", {
      product_id: 3,
      bloodline_id: 10,
      relation: "mine",
      has_pedigree: true,
      generation: null,
    });
  });

  it("남의 혈통으로 바꾸면 403 이고 저장하지 않는다", async () => {
    cards = [root({ creatorId: ME, currentOwnerId: 2 })];
    const res = await update({ bloodlineRootId: 10 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("PRODUCT_BLOODLINE_FORBIDDEN");
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });

  it("이미 붙어 있던 혈통을 그대로 보내면 권한을 다시 보지 않고 계측도 하지 않는다", async () => {
    // 붙인 뒤 혈통을 넘겼거나 회수됐어도 가격·설명 수정이 막히지 않아야 한다.
    cards = [root({ status: "REVOKED" })];
    mockClient.product.findUnique.mockResolvedValue(existingProduct({ bloodlineRootId: 10 }));
    const res = await update({ name: "새 이름", bloodlineRootId: 10 });
    expect(res.statusCode).toBe(200);
    expect(updatedData().bloodlineRootId).toBe(10);
    expect(findCard).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("부모 정보만 바꾸면 기존 혈통을 유지한다", async () => {
    mockClient.product.findUnique.mockResolvedValue(
      existingProduct({ bloodlineRootId: 10, pedigreeNote: { generation: "F3" } })
    );
    const res = await update({ pedigreeNote: { generation: "F4", sireMm: 80 } });
    expect(res.statusCode).toBe(200);
    expect(updatedData()).not.toHaveProperty("bloodlineRootId");
    expect(updatedData().pedigreeNote).toEqual({ generation: "F4", sireMm: 80 });
  });

  it("부모 정보를 null 로 보내면 지운다", async () => {
    mockClient.product.findUnique.mockResolvedValue(
      existingProduct({ bloodlineRootId: 10, pedigreeNote: { generation: "F3" } })
    );
    await update({ pedigreeNote: null });
    expect(updatedData().pedigreeNote).toBe(Prisma.DbNull);
  });

  it("혈통이 없는 상품에 부모 정보만 보내면 400", async () => {
    const res = await update({ pedigreeNote: { generation: "F3" } });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("PRODUCT_PEDIGREE_WITHOUT_BLOODLINE");
    expect(mockClient.product.update).not.toHaveBeenCalled();
  });

  it("부모 정보가 규칙 밖이면 400", async () => {
    mockClient.product.findUnique.mockResolvedValue(existingProduct({ bloodlineRootId: 10 }));
    const res = await update({ pedigreeNote: { sireMm: 0 } });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("PRODUCT_INVALID_PEDIGREE_NOTE");
  });
});

describe("GET /api/products/:id 혈통 요약", () => {
  const get = (user?: NextApiRequest["user"]) =>
    call(detailHandler, { method: "GET", user, query: { id: "3" } });

  it("상세는 혈통 요약을 준다(출처 카드를 받은 판매자)", async () => {
    cards = [root(), sourceCard(ME)];
    mockClient.product.findUnique.mockResolvedValue(
      existingProduct({
        bloodlineRootId: 10,
        pedigreeNote: { generation: "F3", sireMm: 81.2, damMm: 47.5 },
      })
    );
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.product.bloodline).toEqual({
      id: 10,
      name: "강산 라인",
      speciesType: "왕사슴벌레",
      originLabel: "충남 공주",
      creator: KANGSAN,
      sellerRelation: "received",
      receivedAt: "2026-09-12T03:00:00.000Z",
    });
    expect(res.body.product.pedigreeNote).toEqual({ generation: "F3", sireMm: 81.2, damMm: 47.5 });
  });

  it("뷰어와 무관하게 같은 요약을 준다(웹 SSR 비로그인 fetch 와 같다)", async () => {
    cards = [root({ creatorId: ME, currentOwnerId: ME, creator: { id: ME, name: "브리더" } })];
    mockClient.product.findUnique.mockResolvedValue(existingProduct({ bloodlineRootId: 10 }));
    const anonymous = await get();
    const other = await get({ id: 99, name: "남" } as NextApiRequest["user"]);
    expect(anonymous.body.product.bloodline).toEqual(other.body.product.bloodline);
    expect(anonymous.body.product.bloodline).toMatchObject({ sellerRelation: "creator", receivedAt: null });
  });

  it("회수된 혈통은 요약이 null", async () => {
    cards = [root({ status: "REVOKED" })];
    mockClient.product.findUnique.mockResolvedValue(existingProduct({ bloodlineRootId: 10 }));
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.product.bloodline).toBeNull();
  });

  it("혈통 요약 조회가 실패해도 상세는 200 이고 요약만 null", async () => {
    mockClient.product.findUnique.mockResolvedValue(existingProduct({ bloodlineRootId: 10 }));
    findCard.mockRejectedValueOnce(new Error("db down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await get();
    spy.mockRestore();
    expect(res.statusCode).toBe(200);
    expect(res.body.product.bloodline).toBeNull();
  });

  it("혈통이 없으면 요약 null, 혈통 조회도 하지 않는다", async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.product.bloodline).toBeNull();
    expect(res.body.product.pedigreeNote).toBeNull();
    expect(findCard).not.toHaveBeenCalled();
  });
});

describe("GET /api/products?bloodlineRootId= (이 혈통 분양글)", () => {
  const list = (query: Record<string, string>) =>
    call(createHandler, { method: "GET", query });
  const lastWhere = () => mockClient.product.findMany.mock.calls.at(-1)[0].where;

  it("목록을 혈통으로 거른다(삭제·숨김 제외는 그대로)", async () => {
    const res = await list({ bloodlineRootId: "10" });
    expect(res.statusCode).toBe(200);
    expect(lastWhere()).toMatchObject({ bloodlineRootId: 10, isDeleted: false, isHidden: false });
    expect(mockClient.product.count.mock.calls.at(-1)[0].where).toMatchObject({ bloodlineRootId: 10 });
  });

  it.each([["abc"], ["0"], ["-3"], ["1.5"]])("잘못된 값 %p 는 필터를 붙이지 않는다", async (value) => {
    await list({ bloodlineRootId: value });
    expect(lastWhere()).not.toHaveProperty("bloodlineRootId");
  });
});
