/**
 * @jest-environment node
 */

/**
 * 받은 사람 목록·프로필 혈통 목록(설계 §3.4, PRD AC-94)
 * - GET /api/bloodline-cards/:id/recipients (공개): total = receivedCount, 사람별 via(direct/rehomed)·receivedAt·lineCardId,
 *   상세와 같은 닉네임 비공개 규칙. 출처 카드 id 로 열어도 뿌리 기준이다.
 * - GET /api/users/:id/bloodline-cards (공개): currentOwnerId = id 기준(만든 사람·이전 보유자 아님).
 *   출처 카드는 ownerNameVisible = true 이거나 본인이 볼 때만 나온다.
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
  products: [] as Row[],
};

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
  $queryRaw: jest.fn(),
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
  },
  bloodlineCardEvent: {
    findMany: jest.fn(async (args: Row) => pickRows(db.events, args)),
  },
  bloodlineCardTransfer: {
    findMany: jest.fn(async (args: Row) => pickRows(db.transfers, args)),
    findFirst: jest.fn(async (args: Row) => pickRows(db.transfers, args)[0] ?? null),
  },
  product: {
    groupBy: jest.fn(async () => []),
  },
  // 프로필(GET /api/users/:id) 뱃지 수 테스트용(post.groupBy 는 주력 종 getTopSpecies)
  post: { groupBy: jest.fn(async () => []) },
  user: { findUnique: jest.fn() },
  // 프로필 신뢰 줄 거래 완료 수(_count.completedSales)
  sale: { count: jest.fn(async () => 0) },
  userBadge: { findMany: jest.fn(async () => []) },
  follow: { findFirst: jest.fn(async () => null) },
  userBlock: { findFirst: jest.fn(async () => null) },
};

jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/breeder-programs", () => ({
  getSortedActiveBreederProgramSummaries: () => [],
  getActiveBreederProgramsByUserId: () => Promise.resolve([]),
}));

import recipientsHandler from "../pages/api/bloodline-cards/[id]/recipients";
import profileHandler from "../pages/api/users/[id]/bloodline-cards";
import userDetailHandler from "../pages/api/users/[id]/index";

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

async function call(handler: unknown, req: Partial<NextApiRequest>) {
  const res = createRes();
  await (handler as (req: NextApiRequest, res: NextApiResponse) => unknown)(
    { headers: {}, query: {}, body: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const asUser = (id: number | null) =>
  id === null ? undefined : ({ id, name: db.users.find((u) => u.id === id)?.name ?? "" } as NextApiRequest["user"]);
const recipients = (cardId: number | string, viewerId: number | null = null) =>
  call(recipientsHandler, { method: "GET", query: { id: String(cardId) }, user: asUser(viewerId) });
const profile = (userId: number | string, viewerId: number | null = null) =>
  call(profileHandler, { method: "GET", query: { id: String(userId) }, user: asUser(viewerId) });

const MASKED = { id: 0, name: "닉네임 비공개", masked: true };
const at = (day: number) => new Date(Date.UTC(2026, 8, day));

const card = (overrides: Row): Row => ({
  cardType: "BLOODLINE",
  speciesType: "사슴벌레",
  bloodlineReferenceId: null,
  parentCardId: null,
  status: "ACTIVE",
  transferPolicy: "NONE",
  issueCount: 0,
  transferCount: 0,
  visualStyle: "noir",
  description: null,
  image: "cf",
  originSido: null,
  originSigungu: null,
  ownerNameVisible: false,
  createdAt: at(1),
  updatedAt: at(1),
  ...overrides,
});
const line = (overrides: Row): Row =>
  card({ cardType: "LINE", bloodlineReferenceId: 10, parentCardId: 10, name: "강산 라인", ...overrides });

/**
 * 뿌리 10 "강산 라인"(만든 사람 강산 1, 소백 2 를 거쳐 지금 지리 4 보유).
 * 출처 카드: 11 도윤파파(5, 비공개, 9/3), 12 한라(6, 공개, 9/4), 13 다온(8)이 받아 백두(3)에게 다음 분으로(9/10),
 *           14 강산 본인(레거시), 15 회수됨, 16 도윤파파 두 번째(9/7), 17 소백(2)이 보유 중 발급해 한라(6)가 받음(공개).
 */
const seed = () => {
  db.users = [
    { id: 1, name: "강산" },
    { id: 2, name: "소백" },
    { id: 3, name: "백두" },
    { id: 4, name: "지리" },
    { id: 5, name: "도윤파파" },
    { id: 6, name: "한라" },
    { id: 8, name: "다온" },
    { id: 9, name: "구경꾼" },
  ];
  db.cards = [
    card({ id: 10, name: "강산 라인", creatorId: 1, currentOwnerId: 4 }),
    line({ id: 11, creatorId: 1, currentOwnerId: 5, createdAt: at(3), updatedAt: at(3) }),
    line({ id: 12, creatorId: 1, currentOwnerId: 6, ownerNameVisible: true, createdAt: at(4), updatedAt: at(4) }),
    line({ id: 13, creatorId: 1, currentOwnerId: 3, transferCount: 1, createdAt: at(5), updatedAt: at(10) }),
    line({ id: 14, name: "강산라인", creatorId: 1, currentOwnerId: 1, createdAt: at(2) }),
    line({ id: 15, creatorId: 1, currentOwnerId: 9, status: "REVOKED", createdAt: at(6) }),
    line({ id: 16, creatorId: 1, currentOwnerId: 5, createdAt: at(7), updatedAt: at(7) }),
    line({ id: 17, creatorId: 2, currentOwnerId: 6, ownerNameVisible: true, createdAt: at(8), updatedAt: at(8) }),
    // 도윤파파(5)가 만든 혈통 40(보유), 41(구경꾼에게 넘김), 42(회수)
    card({ id: 40, name: "도윤 혈통", creatorId: 5, currentOwnerId: 5, updatedAt: at(20) }),
    card({ id: 41, name: "넘긴 혈통", creatorId: 5, currentOwnerId: 9 }),
    card({ id: 42, name: "회수 혈통", creatorId: 5, currentOwnerId: 5, status: "REVOKED" }),
    line({ id: 43, name: "도윤 혈통", bloodlineReferenceId: 40, parentCardId: 40, creatorId: 5, currentOwnerId: 6, ownerNameVisible: true }),
    card({ id: 70, name: "회수 혈통", creatorId: 1, currentOwnerId: 1, status: "REVOKED" }),
  ];
  db.transfers = [
    { id: 101, cardId: 10, fromUserId: null, toUserId: 1, note: null, createdAt: at(1) },
    { id: 102, cardId: 10, fromUserId: 1, toUserId: 2, note: null, createdAt: at(8) },
    { id: 103, cardId: 10, fromUserId: 2, toUserId: 4, note: null, createdAt: at(9) },
    { id: 104, cardId: 13, fromUserId: 8, toUserId: 3, note: null, createdAt: at(10) },
  ];
  db.events = [
    { id: 202, cardId: 10, action: "LINE_ISSUED", actorUserId: 1, fromUserId: 1, toUserId: 5, relatedCardId: 11, createdAt: at(3) },
    { id: 203, cardId: 10, action: "LINE_ISSUED", actorUserId: 1, fromUserId: 1, toUserId: 6, relatedCardId: 12, createdAt: at(4) },
    { id: 204, cardId: 10, action: "LINE_ISSUED", actorUserId: 1, fromUserId: 1, toUserId: 8, relatedCardId: 13, createdAt: at(5) },
    { id: 205, cardId: 10, action: "BLOODLINE_TRANSFER", actorUserId: 1, fromUserId: 1, toUserId: 2, relatedCardId: null, createdAt: at(8) },
    { id: 207, cardId: 10, action: "LINE_ISSUED", actorUserId: 2, fromUserId: 2, toUserId: 6, relatedCardId: 17, createdAt: at(8) },
    { id: 206, cardId: 10, action: "BLOODLINE_TRANSFER", actorUserId: 2, fromUserId: 2, toUserId: 4, relatedCardId: null, createdAt: at(9) },
    { id: 232, cardId: 13, action: "LINE_TRANSFER", actorUserId: 8, fromUserId: 8, toUserId: 3, relatedCardId: null, createdAt: at(10) },
  ];
};

beforeEach(() => {
  jest.clearAllMocks();
  seed();
});

describe("GET /api/bloodline-cards/:id/recipients", () => {
  it("받은 사람을 direct/rehomed 로 나눠 준다", async () => {
    const res = await recipients(10);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // 도윤파파(두 장이라도 1명)·한라(두 장이라도 1명)·백두 = 3. 강산 본인(14)·회수(15) 제외
    expect(res.body.total).toBe(3);
    expect(res.body.recipients).toHaveLength(3);
    // 받은 날 최신순. 같은 사람은 처음 받은 카드 하나로
    expect(res.body.recipients.map((r: Row) => [r.lineCardId, r.via, r.receivedAt])).toEqual([
      [13, "rehomed", at(10).toISOString()],
      [12, "direct", at(4).toISOString()],
      [11, "direct", at(3).toISOString()],
    ]);
  });

  it("받은 사람 목록도 가린다", async () => {
    const anonymous = await recipients(10);
    expect(anonymous.body.recipients.map((r: Row) => r.user)).toEqual([
      MASKED,
      { id: 6, name: "한라" },
      MASKED,
    ]);
    expect(anonymous.body.recipients.every((r: Row) => !r.isMe)).toBe(true);

    // 강산(1)은 도윤파파에게 직접 보냈다. 백두는 다온이 보낸 상대라 가린다
    const sender = await recipients(10, 1);
    expect(sender.body.recipients.map((r: Row) => r.user)).toEqual([
      MASKED,
      { id: 6, name: "한라" },
      { id: 5, name: "도윤파파" },
    ]);

    // 받은 본인에게는 자기 행이 보이고 isMe 가 붙는다
    const self = await recipients(10, 5);
    const mine = self.body.recipients.find((r: Row) => r.lineCardId === 11);
    expect(mine).toMatchObject({ user: { id: 5, name: "도윤파파" }, isMe: true });
    expect(self.body.recipients.filter((r: Row) => r.isMe)).toHaveLength(1);
  });

  it("사람마다 누구에게나 닉네임이 보이는지(nameVisible)를 준다", async () => {
    // 비로그인: 공개를 켠 한라만 true, 가린 사람은 false
    const anonymous = await recipients(10);
    expect(anonymous.body.recipients.map((r: Row) => [r.lineCardId, r.nameVisible])).toEqual([
      [13, false],
      [12, true],
      [11, false],
    ]);
    // 보낸 강산에게 도윤파파는 보이지만 다른 사람에게는 비공개라 false("다른 사람에게는 닉네임이 비공개예요")
    const sender = await recipients(10, 1);
    const doyun = sender.body.recipients.find((r: Row) => r.lineCardId === 11);
    expect(doyun).toMatchObject({ user: { id: 5, name: "도윤파파" }, nameVisible: false });
  });

  it("출처 카드 id 로 열어도 뿌리 기준이다", async () => {
    const byLine = await recipients(13);
    const byRoot = await recipients(10);
    expect(byLine.body).toEqual(byRoot.body);
  });

  it("받은 사람이 없으면 total 0 과 빈 목록", async () => {
    const res = await recipients(40);
    // 40 의 출처 카드 43 은 한라(6)가 가졌다
    expect(res.body.total).toBe(1);
    db.cards = db.cards.filter((c) => c.id !== 43);
    const empty = await recipients(40);
    expect(empty.body).toEqual({ success: true, total: 0, recipients: [] });
  });

  it("회수된 혈통은 404 BLOODLINE_REVOKED, 없는 카드는 404 BLOODLINE_NOT_FOUND", async () => {
    const revoked = await recipients(70);
    expect(revoked.statusCode).toBe(404);
    expect(revoked.body).toMatchObject({
      success: false,
      total: 0,
      recipients: [],
      errorCode: "BLOODLINE_REVOKED",
    });
    const missing = await recipients(999);
    expect(missing.statusCode).toBe(404);
    expect(missing.body.errorCode).toBe("BLOODLINE_NOT_FOUND");
    const invalid = await recipients("abc");
    expect(invalid.statusCode).toBe(404);
    expect(invalid.body.errorCode).toBe("BLOODLINE_NOT_FOUND");
  });

  it("조회가 실패하면 errorCode 를 준다", async () => {
    mockClient.bloodlineCard.findUnique.mockRejectedValueOnce(new Error("db down"));
    const res = await recipients(10);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, total: 0, recipients: [], errorCode: "BLOODLINE_SERVER_ERROR" });
  });
});

describe("GET /api/users/:id/bloodline-cards — 프로필 혈통 목록", () => {
  const ids = (body: Row) => body.cards.map((c: Row) => c.id);

  it("지금 보유한 카드만 준다(만든 사람·이전 보유자 아님)", async () => {
    const res = await profile(5);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // 41(넘김)·42(회수) 제외, 비공개 출처 카드 11·16 은 남에게 숨긴다
    expect(ids(res.body)).toEqual([40]);
    expect(res.body.cards[0]).toMatchObject({
      id: 40,
      receivedCount: 1,
      creator: { id: 5, name: "도윤파파" },
      currentOwner: { id: 5, name: "도윤파파" },
      transfers: [],
      visualStyle: "noir",
    });
    // 레거시 보유자 테이블을 읽는 raw SQL 을 쓰지 않는다
    expect(mockClient.$queryRaw).not.toHaveBeenCalled();
  });

  it("프로필 혈통 목록은 비공개 출처 카드를 남에게 숨긴다", async () => {
    const stranger = await profile(5, 9);
    expect(ids(stranger.body)).toEqual([40]);

    // 본인에게는 비공개 출처 카드도 보이고 공개 여부가 실린다
    const self = await profile(5, 5);
    expect(ids(self.body).sort()).toEqual([11, 16, 40]);
    const ownLine = self.body.cards.find((c: Row) => c.id === 11);
    expect(ownLine).toMatchObject({
      cardType: "LINE",
      isOwnedByMe: true,
      ownerNameVisible: false,
      currentOwner: { id: 5, name: "도윤파파" },
    });
    expect(ownLine.receivedCount).toBeUndefined();
  });

  it("공개를 켠 출처 카드는 남에게도 보이고 발급자는 마스킹 규칙을 따른다", async () => {
    const res = await profile(6);
    expect(ids(res.body).sort()).toEqual([12, 17, 43]);
    const byId = new Map(res.body.cards.map((c: Row) => [c.id, c]));
    expect((byId.get(12) as Row).currentOwner).toEqual({ id: 6, name: "한라" });
    // 12 의 발급자 강산은 뿌리를 만든 사람이라 보인다
    expect((byId.get(12) as Row).creator).toEqual({ id: 1, name: "강산" });
    // 17 의 발급자 소백(2)은 중간 보유자라 가린다
    expect((byId.get(17) as Row).creator).toEqual(MASKED);
    expect((byId.get(12) as Row).ownerNameVisible).toBeUndefined();

    // 강산(1)이 보면 자기가 혈통을 넘긴 소백이 보인다
    const sender = await profile(6, 1);
    const line17 = sender.body.cards.find((c: Row) => c.id === 17);
    expect(line17.creator).toEqual({ id: 2, name: "소백" });
  });

  it("뿌리 혈통이 숨김·회수된 출처 카드는 목록에서 뺀다", async () => {
    db.cards.push(
      card({ id: 50, name: "숨김 혈통", creatorId: 1, currentOwnerId: 1, status: "INACTIVE" }),
      line({ id: 51, name: "숨김 혈통", bloodlineReferenceId: 50, parentCardId: 50, creatorId: 1, currentOwnerId: 6, ownerNameVisible: true }),
      line({ id: 52, name: "회수 혈통", bloodlineReferenceId: 42, parentCardId: 42, creatorId: 5, currentOwnerId: 6, ownerNameVisible: true })
    );
    const res = await profile(6);
    expect(ids(res.body).sort()).toEqual([12, 17, 43]);
    const self = await profile(6, 6);
    expect(ids(self.body).sort()).toEqual([12, 17, 43]);
  });

  it("프로필 보유 혈통 수(_count.ownedBloodlineCards)는 목록과 같은 조건으로 센다", async () => {
    mockClient.user.findUnique.mockResolvedValue({
      id: 5,
      name: "도윤파파",
      email: null,
      _count: {
        followers: 0,
        following: 0,
        products: 0,
        posts: 0,
        Comments: 0,
        insectRecords: 0,
        receivedReviews: 0,
        createdBloodlineCards: 0,
      },
    });
    // 한라(6)가 가진 공개 출처 카드 중 뿌리가 숨김(51)·회수(52)된 것은 목록에서 빠지므로 수에서도 빠져야 한다
    db.cards.push(
      card({ id: 50, name: "숨김 혈통", creatorId: 1, currentOwnerId: 1, status: "INACTIVE" }),
      line({ id: 51, name: "숨김 혈통", bloodlineReferenceId: 50, parentCardId: 50, creatorId: 1, currentOwnerId: 6, ownerNameVisible: true }),
      line({ id: 52, name: "회수 혈통", bloodlineReferenceId: 42, parentCardId: 42, creatorId: 5, currentOwnerId: 6, ownerNameVisible: true })
    );
    const countFor = async (userId: number, viewerId: number | null) => {
      const res = await call(userDetailHandler, { method: "GET", query: { id: String(userId) }, user: asUser(viewerId) });
      expect(res.statusCode).toBe(200);
      return res.body.user._count.ownedBloodlineCards;
    };

    for (const [userId, viewerId] of [
      [6, null],
      [6, 6],
      [5, 9],
      [5, 5],
    ] as Array<[number, number | null]>) {
      const listed = (await profile(userId, viewerId)).body.cards.length;
      expect(await countFor(userId, viewerId)).toBe(listed);
    }
    expect(await countFor(6, null)).toBe(3); // 12·17·43
    expect(await countFor(5, 9)).toBe(1); // 남에게는 혈통 40 만(비공개 출처 카드 11·16 제외)
    expect(await countFor(5, 5)).toBe(3); // 본인에게는 40·11·16
  });

  it("잘못된 사용자 id 는 404 와 errorCode", async () => {
    const res = await profile("abc");
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ success: false, cards: [], errorCode: "BLOODLINE_NOT_FOUND" });
  });

  it("조회가 실패하면 errorCode 를 준다", async () => {
    mockClient.bloodlineCard.findMany.mockRejectedValueOnce(new Error("db down"));
    const res = await profile(5);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, cards: [], errorCode: "BLOODLINE_SERVER_ERROR" });
  });
});
