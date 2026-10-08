/**
 * @jest-environment node
 */

/**
 * 혈통 일부 고치기 — PATCH /api/bloodline-cards/:id (설계 §3.4, PRD AC-49·54·95)
 * - ownerNameVisible(내 닉네임 공개): 출처 카드(LINE)의 지금 보유자만.
 * - speciesType·description·originSido/originSigungu: 혈통(BLOODLINE)의 만든 사람 = 지금 보유자 = 나 일 때만.
 * - 보낸 필드만 바꾼다. 이름·사진은 보내도 바꾸지 않는다. 오류 응답은 모두 errorCode 를 싣는다.
 */
import type { NextApiRequest, NextApiResponse } from "next";

/* ------------------------------------------------------------------ */
/* 메모리 가짜 DB: where(동등·in·not·OR·AND)·orderBy·take·include 만 해석한다 */
/* ------------------------------------------------------------------ */
type Row = Record<string, any>;
const db = {
  users: [] as Row[],
  cards: [] as Row[],
  transfers: [] as Row[],
  events: [] as Row[],
};
const NOW = new Date("2026-10-08T09:00:00.000Z");

const matches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((w) => matches(row, w));
    if (key === "AND") return (cond as Row[]).every((w) => matches(row, w));
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond && !cond.in.includes(row[key])) return false;
      if ("not" in cond && row[key] === cond.not) return false;
      return true;
    }
    return row[key] === cond;
  });
const comparable = (value: unknown) => (value instanceof Date ? value.getTime() : (value as number));
const sortRows = (rows: Row[], orderBy?: Row | Row[]) => {
  const orders = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const [key, dir] = Object.entries(order)[0];
      const av = comparable(a[key]);
      const bv = comparable(b[key]);
      if (av !== bv) return (av < bv ? -1 : 1) * (dir === "desc" ? -1 : 1);
    }
    return 0;
  });
};
const userRef = (id: number | null | undefined) => {
  const found = db.users.find((user) => user.id === id);
  return found ? { id: found.id, name: found.name } : null;
};
const withCardRelations = (card: Row, args: Row = {}) => {
  const rel = { ...(args.select ?? {}), ...(args.include ?? {}) };
  const out: Row = { ...card };
  if (rel.creator) out.creator = userRef(card.creatorId);
  if (rel.currentOwner) out.currentOwner = userRef(card.currentOwnerId);
  if (rel.transfers) {
    out.transfers = sortRows(
      db.transfers.filter((t) => t.cardId === card.id),
      [{ createdAt: "desc" }]
    )
      .slice(0, rel.transfers.take ?? undefined)
      .map((t) => ({ ...t, fromUser: userRef(t.fromUserId), toUser: userRef(t.toUserId) }));
  }
  return out;
};
const pickRows = (rows: Row[], args: Row = {}) =>
  sortRows(
    rows.filter((row) => matches(row, args.where)),
    args.orderBy
  ).slice(0, args.take ?? undefined);

const mockClient: Row = {
  $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mockClient)),
  bloodlineCard: {
    findMany: jest.fn(async (args: Row) => pickRows(db.cards, args).map((c) => withCardRelations(c, args))),
    findFirst: jest.fn(async (args: Row) => {
      const [card] = pickRows(db.cards, args);
      return card ? withCardRelations(card, args) : null;
    }),
    findUnique: jest.fn(async (args: Row) => {
      const [card] = pickRows(db.cards, args);
      return card ? withCardRelations(card, args) : null;
    }),
    update: jest.fn(async (args: Row) => {
      const row = db.cards.find((c) => matches(c, args.where));
      // Prisma 와 같이 where 에 맞는 행이 없으면 P2025
      if (!row) throw Object.assign(new Error("Record to update not found."), { code: "P2025" });
      Object.assign(row, args.data, { updatedAt: NOW });
      return withCardRelations(row, args);
    }),
    updateMany: jest.fn(async (args: Row) => {
      const rows = db.cards.filter((c) => matches(c, args.where));
      rows.forEach((row) => Object.assign(row, args.data, { updatedAt: NOW }));
      return { count: rows.length };
    }),
  },
  bloodlineCardEvent: {
    findMany: jest.fn(async (args: Row) => pickRows(db.events, args)),
  },
  product: {
    groupBy: jest.fn(async () => []),
  },
};

jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/analytics", () => ({ captureServerEvent: jest.fn() }));
const mockVisibleCategories = jest.fn();
jest.mock("@libs/server/categories", () => ({
  getVisibleCategories: () => mockVisibleCategories(),
}));

import detailHandler from "../pages/api/bloodline-cards/[id]/index";

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

async function patch(cardId: number | string, viewerId: number | null, body: unknown) {
  const res = createRes();
  await (detailHandler as unknown as (req: NextApiRequest, res: NextApiResponse) => unknown)(
    {
      headers: {},
      method: "PATCH",
      query: { id: String(cardId) },
      body,
      user:
        viewerId === null
          ? undefined
          : ({ id: viewerId, name: db.users.find((u) => u.id === viewerId)?.name ?? "" } as NextApiRequest["user"]),
    } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const at = (day: number) => new Date(Date.UTC(2026, 8, day));
const card = (overrides: Row): Row => ({
  cardType: "BLOODLINE",
  speciesType: null,
  bloodlineReferenceId: null,
  parentCardId: null,
  status: "ACTIVE",
  transferPolicy: "NONE",
  issueCount: 0,
  transferCount: 0,
  visualStyle: "noir",
  description: null,
  image: "cf-original",
  originSido: null,
  originSigungu: null,
  ownerNameVisible: false,
  createdAt: at(1),
  updatedAt: at(1),
  ...overrides,
});

/**
 * 20: 강산(1)이 만들고 지금도 보유(종 미지정 레거시). 10: 강산이 만들어 지리(4)에게 넘김.
 * 11: 10 의 출처 카드, 도윤파파(5) 보유. 21: 20 의 출처 카드, 한라(6) 보유. 72: 회수된 혈통.
 */
beforeEach(() => {
  jest.clearAllMocks();
  db.users = [
    { id: 1, name: "강산" },
    { id: 4, name: "지리" },
    { id: 5, name: "도윤파파" },
    { id: 6, name: "한라" },
    { id: 9, name: "구경꾼" },
  ];
  db.cards = [
    card({ id: 20, name: "강산 라인", creatorId: 1, currentOwnerId: 1, description: "예전 소개" }),
    card({ id: 10, name: "백두 혈통", speciesType: "사슴벌레", creatorId: 1, currentOwnerId: 4 }),
    card({ id: 11, name: "백두 혈통", cardType: "LINE", bloodlineReferenceId: 10, parentCardId: 10, creatorId: 1, currentOwnerId: 5 }),
    card({ id: 21, name: "강산 라인", cardType: "LINE", bloodlineReferenceId: 20, parentCardId: 20, creatorId: 1, currentOwnerId: 6 }),
    card({ id: 72, name: "회수 혈통", creatorId: 1, currentOwnerId: 1, status: "REVOKED" }),
  ];
  db.transfers = [];
  db.events = [];
  mockVisibleCategories.mockResolvedValue([
    { id: 1, name: "곤충", slug: "insect", parentId: null, path: "/insect/", sortOrder: 1 },
    { id: 2, name: "사슴벌레", slug: "stag", parentId: 1, path: "/insect/stag/", sortOrder: 1 },
    { id: 5, name: "포유류", slug: "mammal", parentId: null, path: "/mammal/", sortOrder: 5 },
    { id: 7, name: "고양이", slug: "cat", parentId: 5, path: "/mammal/cat/", sortOrder: 2 },
  ]);
});

const updateData = () => mockClient.bloodlineCard.update.mock.calls[0][0].data;
const expectRejected = (res: ReturnType<typeof createRes>, status: number, errorCode: string) => {
  expect(res.statusCode).toBe(status);
  expect(res.body.success).toBe(false);
  expect(res.body.errorCode).toBe(errorCode);
  expect(typeof res.body.error).toBe("string");
  expect(mockClient.bloodlineCard.update).not.toHaveBeenCalled();
};

describe("PATCH /api/bloodline-cards/:id", () => {
  it("닉네임 공개는 출처 카드 보유자만", async () => {
    const res = await patch(11, 5, { ownerNameVisible: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(updateData()).toEqual({ ownerNameVisible: true });
    expect(res.body.card).toMatchObject({
      id: 11,
      cardType: "LINE",
      ownerNameVisible: true,
      isOwnedByMe: true,
      currentOwner: { id: 5, name: "도윤파파" },
    });

    const off = await patch(11, 5, { ownerNameVisible: false });
    expect(off.statusCode).toBe(200);
    expect(off.body.card.ownerNameVisible).toBe(false);
  });

  it("출처 카드 보유자가 아니면 닉네임 공개를 바꿀 수 없다", async () => {
    // 발급자(강산)·혈통 보유자(지리)·제3자
    for (const viewer of [1, 4, 9]) {
      const res = await patch(11, viewer, { ownerNameVisible: true });
      expectRejected(res, 403, "BLOODLINE_FORBIDDEN");
    }
    // 혈통(BLOODLINE)에는 닉네임 공개가 없다
    expectRejected(await patch(20, 1, { ownerNameVisible: true }), 403, "BLOODLINE_FORBIDDEN");
  });

  it("종·소개·산지는 만든 보유자만", async () => {
    const res = await patch(20, 1, {
      speciesType: "고양이",
      description: "  새 소개  ",
      originSido: "충청남도",
      originSigungu: "공주시",
    });
    expect(res.statusCode).toBe(200);
    expect(updateData()).toEqual({
      speciesType: "고양이",
      description: "새 소개",
      originSido: "충청남도",
      originSigungu: "공주시",
    });
    expect(res.body.card).toMatchObject({
      id: 20,
      speciesType: "고양이",
      description: "새 소개",
      originLabel: "충남 공주",
      isOwnedByMe: true,
      receivedCount: 1,
    });

    // 넘긴 뒤의 만든 사람, 넘겨받은 보유자(만든 사람 아님), 출처 카드 보유자는 못 바꾼다
    jest.clearAllMocks();
    expectRejected(await patch(10, 1, { speciesType: "사슴벌레" }), 403, "BLOODLINE_FORBIDDEN");
    expectRejected(await patch(10, 4, { description: "보유자 소개" }), 403, "BLOODLINE_FORBIDDEN");
    expectRejected(await patch(11, 5, { originSido: "충청남도" }), 403, "BLOODLINE_FORBIDDEN");
    expectRejected(await patch(11, 5, { ownerNameVisible: true, speciesType: "고양이" }), 403, "BLOODLINE_FORBIDDEN");
  });

  it("종을 고르면 그 혈통의 출처 카드 종도 같이 바뀐다(출처 카드 종은 뿌리의 복사본)", async () => {
    const res = await patch(20, 1, { speciesType: "고양이" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.$transaction).toHaveBeenCalledTimes(1);
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledWith({
      where: { cardType: "LINE", bloodlineReferenceId: 20 },
      data: { speciesType: "고양이" },
    });
    expect(db.cards.find((c) => c.id === 21)?.speciesType).toBe("고양이");
    // 다른 혈통의 출처 카드는 그대로
    expect(db.cards.find((c) => c.id === 11)?.speciesType).toBeNull();

    // 종을 바꾸지 않으면 출처 카드를 건드리지 않는다
    jest.clearAllMocks();
    await patch(20, 1, { description: "소개만" });
    expect(mockClient.bloodlineCard.updateMany).not.toHaveBeenCalled();
  });

  it("산지를 바꾸면 그 혈통의 출처 카드 산지도 같이 바뀐다(지우면 같이 지운다)", async () => {
    const res = await patch(20, 1, { originSido: "충청남도", originSigungu: "공주시" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.$transaction).toHaveBeenCalledTimes(1);
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledWith({
      where: { cardType: "LINE", bloodlineReferenceId: 20 },
      data: { originSido: "충청남도", originSigungu: "공주시" },
    });
    expect(db.cards.find((c) => c.id === 21)).toMatchObject({ originSido: "충청남도", originSigungu: "공주시" });
    // 다른 혈통의 출처 카드는 그대로
    expect(db.cards.find((c) => c.id === 11)?.originSido).toBeNull();

    jest.clearAllMocks();
    await patch(20, 1, { originSido: null, originSigungu: null });
    expect(db.cards.find((c) => c.id === 21)).toMatchObject({ originSido: null, originSigungu: null });

    // 종과 산지를 함께 바꾸면 한 번에 맞춘다
    jest.clearAllMocks();
    await patch(20, 1, { speciesType: "고양이", originSido: "제주특별자치도" });
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledTimes(1);
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledWith({
      where: { cardType: "LINE", bloodlineReferenceId: 20 },
      data: { speciesType: "고양이", originSido: "제주특별자치도", originSigungu: null },
    });
  });

  it("읽은 뒤 카드가 넘어갔으면 쓰지 않는다(새 보유자의 닉네임 공개가 켜지지 않는다)", async () => {
    // 도윤파파(5)가 읽은 시점에는 보유자였지만 쓰기 전에 한라(6)에게 넘어갔다(넘기기가 공개를 끔)
    const row = db.cards.find((c) => c.id === 11) as Row;
    const stale = { ...row };
    row.currentOwnerId = 6;
    row.ownerNameVisible = false;
    mockClient.bloodlineCard.findUnique.mockImplementationOnce(async (args: Row) => withCardRelations(stale, args));

    const res = await patch(11, 5, { ownerNameVisible: true });
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ success: false, errorCode: "BLOODLINE_FORBIDDEN", card: null });
    expect(row.ownerNameVisible).toBe(false);
    // 쓰기 조건에 보유자가 들어간다
    expect(mockClient.bloodlineCard.update.mock.calls[0][0].where).toEqual({
      id: 11,
      status: "ACTIVE",
      currentOwnerId: 5,
      cardType: "LINE",
    });
  });

  it("읽은 뒤 혈통을 넘겼거나 회수됐으면 종·소개·산지를 쓰지 않는다", async () => {
    // 강산(1)이 읽은 뒤 혈통 20 을 지리(4)에게 넘겼다
    const root = db.cards.find((c) => c.id === 20) as Row;
    const stale = { ...root };
    root.currentOwnerId = 4;
    mockClient.bloodlineCard.findUnique.mockImplementationOnce(async (args: Row) => withCardRelations(stale, args));
    const moved = await patch(20, 1, { speciesType: "고양이", description: "넘긴 뒤 소개" });
    expect(moved.statusCode).toBe(403);
    expect(moved.body.errorCode).toBe("BLOODLINE_FORBIDDEN");
    expect(root).toMatchObject({ speciesType: null, description: "예전 소개" });
    // 트랜잭션이 되돌려지므로 출처 카드 종도 그대로다(첫 쓰기에서 실패해 맞추기까지 가지 않는다)
    expect(mockClient.bloodlineCard.updateMany).not.toHaveBeenCalled();
    expect(db.cards.find((c) => c.id === 21)?.speciesType).toBeNull();

    // 읽은 뒤 운영 회수가 끝났다
    jest.clearAllMocks();
    root.currentOwnerId = 1;
    const fresh = { ...root };
    root.status = "REVOKED";
    mockClient.bloodlineCard.findUnique.mockImplementationOnce(async (args: Row) => withCardRelations(fresh, args));
    const revoked = await patch(20, 1, { description: "회수 중 소개" });
    expect(revoked.statusCode).toBe(404);
    expect(revoked.body.errorCode).toBe("BLOODLINE_REVOKED");
    expect(root.description).toBe("예전 소개");
  });

  it("보낸 필드만 바꾸고 null 은 지운다", async () => {
    const res = await patch(20, 1, { description: null });
    expect(res.statusCode).toBe(200);
    expect(updateData()).toEqual({ description: null });
    expect(res.body.card.description).toBeNull();

    jest.clearAllMocks();
    db.cards[0].originSido = "충청남도";
    db.cards[0].originSigungu = "공주시";
    const cleared = await patch(20, 1, { originSido: null, originSigungu: null });
    expect(updateData()).toEqual({ originSido: null, originSigungu: null });
    expect(cleared.body.card.originLabel).toBeNull();

    jest.clearAllMocks();
    const sidoOnly = await patch(20, 1, { originSido: "제주특별자치도" });
    expect(updateData()).toEqual({ originSido: "제주특별자치도", originSigungu: null });
    expect(sidoOnly.body.card.originLabel).toBe("제주");

    jest.clearAllMocks();
    await patch(20, 1, { description: "가".repeat(400) });
    expect(updateData().description).toHaveLength(300);
  });

  it("이름·사진은 바꾸지 않는다", async () => {
    const res = await patch(20, 1, { name: "바꾼 이름", image: "cf-new", description: "소개" });
    expect(res.statusCode).toBe(200);
    expect(updateData()).toEqual({ description: "소개" });
    expect(res.body.card).toMatchObject({ name: "강산 라인", image: "cf-original" });

    // 바꿀 수 있는 필드가 없으면 저장하지 않고 지금 카드를 돌려준다
    jest.clearAllMocks();
    const nothing = await patch(20, 1, { name: "바꾼 이름" });
    expect(nothing.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.update).not.toHaveBeenCalled();
    expect(nothing.body.card.name).toBe("강산 라인");
    // 보유자가 아니면 그래도 403
    expectRejected(await patch(20, 9, { name: "바꾼 이름" }), 403, "BLOODLINE_FORBIDDEN");
  });

  it("종·산지 값이 잘못되면 400", async () => {
    expectRejected(await patch(20, 1, { speciesType: "왕사슴벌레" }), 400, "BLOODLINE_INVALID_SPECIES");
    expectRejected(await patch(20, 1, { speciesType: "" }), 400, "BLOODLINE_SPECIES_REQUIRED");
    expectRejected(await patch(20, 1, { speciesType: null }), 400, "BLOODLINE_SPECIES_REQUIRED");
    expectRejected(await patch(20, 1, { originSigungu: "공주시" }), 400, "BLOODLINE_INVALID_ORIGIN");
    expectRejected(
      await patch(20, 1, { originSido: "충청남도", originSigungu: "강남구" }),
      400,
      "BLOODLINE_INVALID_ORIGIN"
    );
  });

  it("비로그인은 401, 없는 카드 404, 회수된 카드 404 BLOODLINE_REVOKED", async () => {
    const anonymous = await patch(20, null, { description: "x" });
    expectRejected(anonymous, 401, "BLOODLINE_AUTH_REQUIRED");

    expectRejected(await patch(999, 1, { description: "x" }), 404, "BLOODLINE_NOT_FOUND");
    expectRejected(await patch("abc", 1, { description: "x" }), 404, "BLOODLINE_NOT_FOUND");
    expectRejected(await patch(72, 1, { description: "x" }), 404, "BLOODLINE_REVOKED");
  });

  it("저장이 실패하면 errorCode 를 준다", async () => {
    mockClient.bloodlineCard.update.mockRejectedValueOnce(new Error("db down"));
    const res = await patch(20, 1, { description: "x" });
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, errorCode: "BLOODLINE_SERVER_ERROR" });
  });
});
