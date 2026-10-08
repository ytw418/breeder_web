/**
 * @jest-environment node
 */

/**
 * 혈통 상세·이력 공개 GET 의 닉네임 비공개(설계 §3.4, PRD AC-92·93)
 * - pages/api/bloodline-cards/[id]/index.ts (GET), pages/api/bloodline-cards/[id]/events.ts
 * - 공개: 뿌리 creator·currentOwner, 뷰어 본인, 뷰어가 직접 보낸 상대, ownerNameVisible=true 출처 카드 보유자.
 *   그 외는 { id: 0, name: "닉네임 비공개", masked: true }.
 * - viewerRelation: owner(뿌리 보유자) / holder(그 뿌리의 출처 카드 보유) / none. holder 면 viewerLineCard.
 * - 회수(REVOKED)·숨김(INACTIVE)은 404 BLOODLINE_REVOKED. receivedCount 는 만든 사람 보유분을 뺀 서로 다른 보유자 수.
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
    findMany: jest.fn(async (args: Row) =>
      pickRows(db.events, args).map((event) => {
        const rel = { ...(args.select ?? {}), ...(args.include ?? {}) };
        const out: Row = { ...event };
        if (rel.actorUser) out.actorUser = userRef(event.actorUserId);
        if (rel.fromUser) out.fromUser = userRef(event.fromUserId);
        if (rel.toUser) out.toUser = userRef(event.toUserId);
        return out;
      })
    ),
  },
  bloodlineCardTransfer: {
    findMany: jest.fn(async (args: Row) => pickRows(db.transfers, args)),
    findFirst: jest.fn(async (args: Row) => pickRows(db.transfers, args)[0] ?? null),
  },
  product: {
    groupBy: jest.fn(async (args: Row) => {
      const counts = new Map<number, number>();
      for (const product of db.products.filter((p) => matches(p, args.where))) {
        counts.set(product.bloodlineRootId, (counts.get(product.bloodlineRootId) ?? 0) + 1);
      }
      return Array.from(counts, ([bloodlineRootId, count]) => ({ bloodlineRootId, _count: { _all: count } }));
    }),
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
jest.mock("@libs/server/categories", () => ({ getVisibleCategories: jest.fn(async () => []) }));

import detailHandler from "../pages/api/bloodline-cards/[id]/index";
import eventsHandler from "../pages/api/bloodline-cards/[id]/events";

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
  handler: unknown,
  req: Partial<NextApiRequest>
) {
  const res = createRes();
  await (handler as (req: NextApiRequest, res: NextApiResponse) => unknown)(
    { headers: {}, query: {}, body: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const asUser = (id: number | null) =>
  id === null ? undefined : ({ id, name: db.users.find((u) => u.id === id)?.name ?? "" } as NextApiRequest["user"]);
const detail = (cardId: number, viewerId: number | null = null) =>
  call(detailHandler, { method: "GET", query: { id: String(cardId) }, user: asUser(viewerId) });
const events = (cardId: number, viewerId: number | null = null) =>
  call(eventsHandler, { method: "GET", query: { id: String(cardId), limit: "50" }, user: asUser(viewerId) });

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
 * 뿌리 10 "강산 라인": 강산(1)이 만들고 출처 카드를 보낸 뒤 소백(2)에게, 소백이 지리(4)에게 넘겼다(지금 보유자 4).
 * 출처 카드: 11 → 도윤파파(5, 비공개), 12 → 한라(6, 공개), 13 → 다온(8)이 받아 백두(3)에게 다음 분으로 보냄(비공개),
 *           14 → 강산 본인(레거시 본인 발급), 15 → 회수됨, 16 → 도윤파파의 두 번째 카드(레거시).
 */
const seed = () => {
  db.users = [
    { id: 1, name: "강산" },
    { id: 2, name: "소백" },
    { id: 3, name: "백두" },
    { id: 4, name: "지리" },
    { id: 5, name: "도윤파파" },
    { id: 6, name: "한라" },
    { id: 7, name: "브리더" },
    { id: 8, name: "다온" },
    { id: 9, name: "구경꾼" },
  ];
  db.cards = [
    card({
      id: 10,
      name: "강산 라인",
      creatorId: 1,
      currentOwnerId: 4,
      originSido: "충청남도",
      originSigungu: "공주시",
      issueCount: 5,
      transferCount: 2,
    }),
    line({ id: 11, creatorId: 1, currentOwnerId: 5, description: "잘 키워 주세요", createdAt: at(3) }),
    line({ id: 12, creatorId: 1, currentOwnerId: 6, ownerNameVisible: true, createdAt: at(4) }),
    line({ id: 13, creatorId: 1, currentOwnerId: 3, transferCount: 1, createdAt: at(5) }),
    line({ id: 14, name: "강산라인", creatorId: 1, currentOwnerId: 1, createdAt: at(2) }),
    line({ id: 15, creatorId: 1, currentOwnerId: 9, status: "REVOKED", createdAt: at(6) }),
    line({ id: 16, creatorId: 1, currentOwnerId: 5, createdAt: at(7) }),
    // 회수·숨김 혈통과 그 출처 카드
    card({ id: 70, name: "회수 혈통", creatorId: 1, currentOwnerId: 1, status: "REVOKED" }),
    card({ id: 71, name: "숨김 혈통", creatorId: 1, currentOwnerId: 1, status: "INACTIVE" }),
    line({ id: 72, name: "숨김 혈통", bloodlineReferenceId: 71, parentCardId: 71, creatorId: 1, currentOwnerId: 5 }),
  ];
  db.transfers = [
    { id: 101, cardId: 10, fromUserId: null, toUserId: 1, note: "혈통을 만들었어요", createdAt: at(1) },
    { id: 102, cardId: 10, fromUserId: 1, toUserId: 2, note: null, createdAt: at(8) },
    { id: 103, cardId: 10, fromUserId: 2, toUserId: 4, note: null, createdAt: at(9) },
    { id: 104, cardId: 13, fromUserId: 8, toUserId: 3, note: "다음 분께", createdAt: at(10) },
  ];
  db.events = [
    { id: 201, cardId: 10, action: "BLOODLINE_CREATED", actorUserId: 1, fromUserId: null, toUserId: 1, relatedCardId: null, note: "혈통을 만들었어요", createdAt: at(1) },
    { id: 202, cardId: 10, action: "LINE_ISSUED", actorUserId: 1, fromUserId: 1, toUserId: 5, relatedCardId: 11, note: "잘 키워 주세요", createdAt: at(3) },
    { id: 203, cardId: 10, action: "LINE_ISSUED", actorUserId: 1, fromUserId: 1, toUserId: 6, relatedCardId: 12, note: null, createdAt: at(4) },
    { id: 204, cardId: 10, action: "LINE_ISSUED", actorUserId: 1, fromUserId: 1, toUserId: 8, relatedCardId: 13, note: null, createdAt: at(5) },
    { id: 205, cardId: 10, action: "BLOODLINE_TRANSFER", actorUserId: 1, fromUserId: 1, toUserId: 2, relatedCardId: null, note: null, createdAt: at(8) },
    { id: 206, cardId: 10, action: "BLOODLINE_TRANSFER", actorUserId: 2, fromUserId: 2, toUserId: 4, relatedCardId: null, note: null, createdAt: at(9) },
    { id: 211, cardId: 11, action: "LINE_CREATED", actorUserId: 1, fromUserId: 1, toUserId: 5, relatedCardId: 10, note: null, createdAt: at(3) },
    { id: 231, cardId: 13, action: "LINE_CREATED", actorUserId: 1, fromUserId: 1, toUserId: 8, relatedCardId: 10, note: null, createdAt: at(5) },
    { id: 232, cardId: 13, action: "LINE_TRANSFER", actorUserId: 8, fromUserId: 8, toUserId: 3, relatedCardId: null, note: "다음 분께", createdAt: at(10) },
  ];
  db.products = [
    { id: 1, bloodlineRootId: 10, isDeleted: false, isHidden: false },
    { id: 2, bloodlineRootId: 10, isDeleted: false, isHidden: false },
    { id: 3, bloodlineRootId: 10, isDeleted: true, isHidden: false },
    { id: 4, bloodlineRootId: 10, isDeleted: false, isHidden: true },
    { id: 5, bloodlineRootId: 70, isDeleted: false, isHidden: false },
  ];
};

beforeEach(() => {
  jest.clearAllMocks();
  seed();
});

const transferPairs = (item: Row) =>
  item.transfers.map((t: Row) => [t.fromUser, t.toUser]);

describe("GET /api/bloodline-cards/:id — 마스킹", () => {
  it("비로그인에게는 받은 사람을 가린다", async () => {
    const res = await detail(10);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const root = res.body.card;
    // 뿌리의 만든 사람·지금 보유자는 항상 공개
    expect(root.creator).toEqual({ id: 1, name: "강산" });
    expect(root.currentOwner).toEqual({ id: 4, name: "지리" });
    // 중간 보유자 소백(2)은 가린다
    expect(transferPairs(root)).toEqual([
      [MASKED, { id: 4, name: "지리" }],
      [{ id: 1, name: "강산" }, MASKED],
      [null, { id: 1, name: "강산" }],
    ]);
    expect(res.body.viewerRelation).toBe("none");
    expect(res.body.viewerLineCard).toBeNull();
    expect(root.isOwnedByMe).toBe(false);
    expect(root.ownerNameVisible).toBeUndefined();

    // 출처 카드를 열면 지금 보유자(도윤파파)를 가리고 발급자(강산 = 뿌리 만든 사람)는 보인다
    const lineRes = await detail(11);
    expect(lineRes.body.card.currentOwner).toEqual(MASKED);
    expect(lineRes.body.card.creator).toEqual({ id: 1, name: "강산" });
    expect(lineRes.body.bloodlineSourceCard.id).toBe(10);
    expect(lineRes.body.parentLineCard.id).toBe(10);
    expect(lineRes.body.card.ownerNameVisible).toBeUndefined();

    // 다음 분에게 보낸 출처 카드의 보낸 사람·받은 사람 모두 가린다
    const rehomed = await detail(13);
    expect(rehomed.body.card.currentOwner).toEqual(MASKED);
    expect(transferPairs(rehomed.body.card)).toEqual([[MASKED, MASKED]]);
  });

  it("직접 보낸 사람에게는 상대를 보여 준다", async () => {
    // 강산(1)은 소백(2)에게 혈통을 넘겼고 도윤파파(5)·다온(8)에게 출처 카드를 보냈다
    const root = await detail(10, 1);
    expect(transferPairs(root.body.card)[1]).toEqual([{ id: 1, name: "강산" }, { id: 2, name: "소백" }]);

    const line11 = await detail(11, 1);
    expect(line11.body.card.currentOwner).toEqual({ id: 5, name: "도윤파파" });

    // 2단계 수령자 백두(3)는 강산이 직접 보낸 상대가 아니라 가린다. 다온(8)은 강산이 보낸 상대라 보인다
    const rehomed = await detail(13, 1);
    expect(rehomed.body.card.currentOwner).toEqual(MASKED);
    expect(transferPairs(rehomed.body.card)).toEqual([[{ id: 8, name: "다온" }, MASKED]]);

    // 다온(8)이 보면 자기가 보낸 백두(3)가 보인다
    const byDaon = await detail(13, 8);
    expect(byDaon.body.card.currentOwner).toEqual({ id: 3, name: "백두" });
  });

  it("받은 사람에게는 자기에게 보낸 사람을 보여 준다", async () => {
    // 백두(3)는 다온(8)에게서 출처 카드 13 을 넘겨받았다 → "다온님에게 받았어요"(PRD S-4.받은 사람)
    const byBaekdu = await detail(13, 3);
    expect(transferPairs(byBaekdu.body.card)).toEqual([[{ id: 8, name: "다온" }, { id: 3, name: "백두" }]]);
    // 같은 혈통의 다른 받은 사람(도윤파파)은 그대로 가린다
    const other = await detail(11, 3);
    expect(other.body.card.currentOwner).toEqual(MASKED);

    // 지리(4)는 소백(2)에게서 혈통을 넘겨받았다 → 소백이 보인다. 소백에게 넘긴 강산은 원래 공개
    const byJiri = await detail(10, 4);
    expect(transferPairs(byJiri.body.card)[0]).toEqual([{ id: 2, name: "소백" }, { id: 4, name: "지리" }]);
  });

  it("공개를 켠 보유자는 모두에게 보인다", async () => {
    const res = await detail(12);
    expect(res.body.card.currentOwner).toEqual({ id: 6, name: "한라" });

    const other = await detail(12, 9);
    expect(other.body.card.currentOwner).toEqual({ id: 6, name: "한라" });
  });

  it("출처 카드 메모(description·transfers[].note)는 보낸 사람·받은 사람에게만 준다", async () => {
    // 11: 강산(1)이 도윤파파(5)에게 "잘 키워 주세요"로 보냄. 받은 사람 목록이 lineCardId 를 알려 줘도 메모는 새지 않는다
    for (const viewer of [null, 9, 4, 6]) {
      const res = await detail(11, viewer);
      expect(res.statusCode).toBe(200);
      expect(res.body.card.description).toBeNull();
    }
    expect((await detail(11, 5)).body.card.description).toBe("잘 키워 주세요");
    expect((await detail(11, 1)).body.card.description).toBe("잘 키워 주세요");

    // 13: 다온(8)이 백두(3)에게 "다음 분께"로 넘김
    for (const viewer of [null, 9, 1]) {
      const res = await detail(13, viewer);
      expect(res.body.card.transfers.map((t: Row) => t.note)).toEqual([null]);
    }
    expect((await detail(13, 3)).body.card.transfers[0].note).toBe("다음 분께");
    expect((await detail(13, 8)).body.card.transfers[0].note).toBe("다음 분께");
  });

  it("출처 카드 보유 뷰어에게 viewerLineCard 를 준다", async () => {
    const holder = await detail(10, 5);
    expect(holder.body.viewerRelation).toBe("holder");
    expect(holder.body.viewerLineCard).toMatchObject({
      id: 11,
      cardType: "LINE",
      isOwnedByMe: true,
      ownerNameVisible: false,
      currentOwner: { id: 5, name: "도윤파파" },
      description: "잘 키워 주세요",
    });
    expect(holder.body.card.isOwnedByMe).toBe(false);

    // 자기 출처 카드를 열어도 같은 카드다
    const own = await detail(11, 5);
    expect(own.body.viewerRelation).toBe("holder");
    expect(own.body.card).toMatchObject({ id: 11, isOwnedByMe: true, ownerNameVisible: false });
    expect(own.body.viewerLineCard.id).toBe(11);
    expect(own.body.bloodlineSourceCard).toMatchObject({ id: 10, receivedCount: 3, listingCount: 2 });

    const owner = await detail(10, 4);
    expect(owner.body.viewerRelation).toBe("owner");
    expect(owner.body.viewerLineCard).toBeNull();
    expect(owner.body.card.isOwnedByMe).toBe(true);

    // 만든 사람이라도 넘긴 뒤에는 owner 가 아니다(레거시 본인 발급 카드 14 를 가졌으니 holder)
    const creator = await detail(10, 1);
    expect(creator.body.viewerRelation).toBe("holder");
    expect(creator.body.viewerLineCard.id).toBe(14);

    const stranger = await detail(10, 9);
    expect(stranger.body.viewerRelation).toBe("none");
    expect(stranger.body.viewerLineCard).toBeNull();
  });

  it("receivedCount 는 만든 사람 보유분을 뺀다", async () => {
    const res = await detail(10);
    // 도윤파파(11·16 두 장이라도 1명), 한라, 백두 = 3. 강산 본인(14)·회수(15) 제외
    expect(res.body.card.receivedCount).toBe(3);
    // 분양글: 삭제·숨김 제외 2개
    expect(res.body.card.listingCount).toBe(2);
    expect(res.body.card.originLabel).toBe("충남 공주");
    expect(res.body.card.visualStyle).toBe("noir");

    // 출처 카드 자체에는 붙이지 않는다(뿌리만)
    const lineRes = await detail(11);
    expect(lineRes.body.card.receivedCount).toBeUndefined();
    expect(lineRes.body.bloodlineSourceCard.receivedCount).toBe(3);
  });

  it("회수된 혈통은 404 BLOODLINE_REVOKED", async () => {
    for (const id of [70, 71, 15]) {
      const res = await detail(id);
      expect(res.statusCode).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        errorCode: "BLOODLINE_REVOKED",
        error: "운영 정책으로 회수된 혈통이에요",
        card: null,
        bloodlineSourceCard: null,
        parentLineCard: null,
      });
    }
    // 숨김 혈통의 출처 카드를 열어도 혈통은 보여 주지 않는다
    const hiddenRootLine = await detail(72);
    expect(hiddenRootLine.statusCode).toBe(404);
    expect(hiddenRootLine.body.errorCode).toBe("BLOODLINE_REVOKED");
  });

  it("없는 카드는 404 BLOODLINE_NOT_FOUND", async () => {
    const res = await detail(999);
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOODLINE_NOT_FOUND");
    expect(res.body.card).toBeNull();

    const invalid = await call(detailHandler, { method: "GET", query: { id: "abc" } });
    expect(invalid.statusCode).toBe(404);
    expect(invalid.body.errorCode).toBe("BLOODLINE_NOT_FOUND");
  });

  it("조회가 실패하면 errorCode 를 준다", async () => {
    mockClient.bloodlineCard.findUnique.mockRejectedValueOnce(new Error("db down"));
    const res = await detail(10);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, errorCode: "BLOODLINE_SERVER_ERROR", card: null });
  });
});

describe("GET /api/bloodline-cards/:id/events — 마스킹", () => {
  const people = (body: Row) =>
    Object.fromEntries(
      body.events.map((e: Row) => [e.id, { actor: e.actorUser, from: e.fromUser, to: e.toUser }])
    );

  it("이력 API 도 같은 규칙으로 가린다", async () => {
    const res = await events(10);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // 최신순. 뿌리 이력에는 그 아래 출처 카드의 LINE_TRANSFER(232)도 들어간다(시안 S3·S3')
    expect(res.body.events.map((e: Row) => e.id)).toEqual([232, 206, 205, 204, 203, 202, 201]);
    const byId = people(res.body);
    // "닉네임 비공개 분이 다음 분에게 보냈어요". 보유자끼리 주고받은 메모는 뿌리 이력에 싣지 않는다
    expect(byId[232]).toEqual({ actor: MASKED, from: MASKED, to: MASKED });
    expect(res.body.events[0]).toMatchObject({ action: "LINE_TRANSFER", note: null });
    expect(byId[201].actor).toEqual({ id: 1, name: "강산" });
    expect(byId[202].to).toEqual(MASKED); // 도윤파파(비공개)
    expect(byId[203].to).toEqual({ id: 6, name: "한라" }); // 공개를 켬
    expect(byId[204].to).toEqual(MASKED); // 다온(지금은 카드 없음)
    expect(byId[205].to).toEqual(MASKED); // 소백(중간 보유자)
    expect(byId[206]).toEqual({ actor: MASKED, from: MASKED, to: { id: 4, name: "지리" } });
    // 관련 카드 이름은 그대로
    expect(res.body.events.find((e: Row) => e.id === 202).relatedCard).toEqual({ id: 11, name: "강산 라인" });

    // 보낸 사람(강산)이 보면 자기가 보낸 상대가 보인다
    const sender = people((await events(10, 1)).body);
    expect(sender[202].to).toEqual({ id: 5, name: "도윤파파" });
    expect(sender[204].to).toEqual({ id: 8, name: "다온" });
    expect(sender[205].to).toEqual({ id: 2, name: "소백" });
    // 강산이 보낸 다온은 보이고, 다온이 다음 분으로 보낸 백두는 가린다("다온님이 다음 분에게 보냈어요")
    expect(sender[232]).toEqual({ actor: { id: 8, name: "다온" }, from: { id: 8, name: "다온" }, to: MASKED });
  });

  it("출처 카드 이력도 가리고 LINE_CREATED 는 그대로 내려 준다", async () => {
    const res = await events(13);
    expect(res.body.events.map((e: Row) => e.action)).toEqual(["LINE_TRANSFER", "LINE_CREATED"]);
    // 다음 분에게 보낸 메모는 당사자(다온 8·백두 3)에게만. 비로그인에게는 비운다
    expect(res.body.events[0].note).toBeNull();
    expect((await events(13, 8)).body.events[0].note).toBe("다음 분께");
    expect((await events(13, 3)).body.events[0].note).toBe("다음 분께");
    expect((await events(13, 9)).body.events[0].note).toBeNull();
    const byId = people(res.body);
    expect(byId[232]).toEqual({ actor: MASKED, from: MASKED, to: MASKED });
    expect(byId[231].actor).toEqual({ id: 1, name: "강산" });

    const daon = people((await events(13, 8)).body);
    expect(daon[232]).toEqual({
      actor: { id: 8, name: "다온" },
      from: { id: 8, name: "다온" },
      to: { id: 3, name: "백두" },
    });
  });

  it("보내기 메모(LINE_ISSUED)는 공개 이력에서 보낸 사람·받은 사람에게만 준다", async () => {
    const noteOf = (body: Row, id: number) => body.events.find((e: Row) => e.id === id)?.note;
    // 비로그인·제3자·지금 혈통 보유자(지리 4, 그 사건과 무관)에게는 메모를 비운다
    for (const viewer of [null, 9, 4]) {
      const res = await events(10, viewer);
      expect(noteOf(res.body, 202)).toBeNull();
    }
    // 보낸 사람(강산 1)·받은 사람(도윤파파 5)은 본다
    expect(noteOf((await events(10, 1)).body, 202)).toBe("잘 키워 주세요");
    expect(noteOf((await events(10, 5)).body, 202)).toBe("잘 키워 주세요");
    // 시스템 문구(만들기)는 누구에게나
    expect(noteOf((await events(10)).body, 201)).toBe("혈통을 만들었어요");
  });

  it("회수·숨김 카드의 이력은 404 BLOODLINE_REVOKED, 없는 카드는 404 BLOODLINE_NOT_FOUND", async () => {
    const revoked = await events(70);
    expect(revoked.statusCode).toBe(404);
    expect(revoked.body).toMatchObject({ success: false, events: [], errorCode: "BLOODLINE_REVOKED" });

    // 출처 카드 자체는 ACTIVE 여도 뿌리가 숨김이면 이력을 주지 않는다(상세·받은 사람과 같은 규칙)
    const hiddenRootLine = await events(72);
    expect(hiddenRootLine.statusCode).toBe(404);
    expect(hiddenRootLine.body).toMatchObject({ success: false, events: [], errorCode: "BLOODLINE_REVOKED" });

    const missing = await events(999);
    expect(missing.statusCode).toBe(404);
    expect(missing.body.errorCode).toBe("BLOODLINE_NOT_FOUND");
  });
});
