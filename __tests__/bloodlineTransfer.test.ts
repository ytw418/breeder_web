/**
 * @jest-environment node
 */

/**
 * POST /api/bloodline-cards/[id]/transfer — 혈통 넘기기 / 출처 카드 다음 분에게 보내기(설계 §3.3, PRD AC-89·AC-90).
 * - 권한은 currentOwnerId 하나(넘긴 뒤 이전 보유자는 만든 사람이어도 403)
 * - 받는 사람 필수, 본인 금지, 차단이면 403
 * - 출처 카드(LINE)면 ownerNameVisible 을 false 로 돌린다. 보유자 거울 행은 replaceCardOwner
 * - 알림(BLOODLINE_RECEIVED)·계측(bloodline_sent)은 트랜잭션이 끝난 뒤 1회
 */
import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  bloodlineCard: { findUnique: jest.fn(), updateMany: jest.fn() },
  bloodlineCardTransfer: { create: jest.fn() },
  bloodlineCardEvent: { create: jest.fn() },
  bloodlineCardOwner: { createMany: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
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
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));
const mockCaptureServerEvent = jest.fn();
jest.mock("@libs/server/analytics", () => ({
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
}));
const mockGetBlockRelation = jest.fn();
jest.mock("@libs/server/blocks", () => ({
  getBlockRelation: (...args: unknown[]) => mockGetBlockRelation(...args),
}));

import transferHandler from "../pages/api/bloodline-cards/[id]/transfer";

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
  await (transferHandler as (req: NextApiRequest, res: NextApiResponse) => unknown)(
    { headers: {}, query: {}, body: {}, cookies: {}, method: "POST", ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const asUser = (id: number, name: string) => ({ id, name }) as NextApiRequest["user"];
const kangsan = asUser(7, "강산(토큰)");

const USERS: Record<number, { id: number; name: string; status: string }> = {
  7: { id: 7, name: "강산", status: "ACTIVE" },
  21: { id: 21, name: "민지", status: "ACTIVE" },
  22: { id: 22, name: "도윤", status: "ACTIVE" },
  23: { id: 23, name: "탈퇴한분", status: "DELETED" },
};

interface CardRow {
  id: number;
  cardType: "BLOODLINE" | "LINE";
  name: string;
  status: string;
  creatorId: number;
  currentOwnerId: number;
  bloodlineReferenceId: number | null;
  ownerNameVisible: boolean;
}

/** 테스트 안의 작은 DB(카드 id → 행). updateMany 가 조건이 맞을 때만 바꾼다. */
let cards: Map<number, CardRow>;
let inTransaction: boolean;
let order: string[];

const ROOT: CardRow = {
  id: 11,
  cardType: "BLOODLINE",
  name: "강산 라인",
  status: "ACTIVE",
  creatorId: 7,
  currentOwnerId: 7,
  bloodlineReferenceId: null,
  ownerNameVisible: false,
};
const LINE: CardRow = {
  id: 31,
  cardType: "LINE",
  name: "강산 라인",
  status: "ACTIVE",
  creatorId: 7,
  currentOwnerId: 21,
  bloodlineReferenceId: 11,
  ownerNameVisible: true,
};

const transfer = (user: NextApiRequest["user"], id: number | string, body: Record<string, unknown>) =>
  call({ user, query: { id: String(id) }, body });

beforeEach(() => {
  jest.clearAllMocks();
  cards = new Map([
    [ROOT.id, { ...ROOT }],
    [LINE.id, { ...LINE }],
  ]);
  inTransaction = false;
  order = [];

  mockClient.bloodlineCard.findUnique.mockImplementation(async ({ where }: { where: { id: number } }) => {
    const card = cards.get(where.id);
    return card ? { ...card } : null;
  });
  mockClient.bloodlineCard.updateMany.mockImplementation(
    async ({ where, data }: { where: Partial<CardRow>; data: Record<string, any> }) => {
      const card = where.id !== undefined ? cards.get(where.id) : undefined;
      const matches =
        card &&
        (where.currentOwnerId === undefined || card.currentOwnerId === where.currentOwnerId) &&
        (where.status === undefined || card.status === where.status);
      if (!card || !matches) return { count: 0 };
      if (typeof data.currentOwnerId === "number") card.currentOwnerId = data.currentOwnerId;
      if (typeof data.ownerNameVisible === "boolean") card.ownerNameVisible = data.ownerNameVisible;
      return { count: 1 };
    }
  );
  mockClient.user.findUnique.mockImplementation(async ({ where }: { where: { id?: number; name?: string } }) => {
    const user =
      where.id !== undefined
        ? USERS[where.id]
        : Object.values(USERS).find((candidate) => candidate.name === where.name);
    return user ? { ...user } : null;
  });
  mockGetBlockRelation.mockResolvedValue({ blockedByMe: false, blockedMe: false });

  mockClient.$transaction.mockImplementation(async (callback: (tx: typeof mockClient) => unknown) => {
    inTransaction = true;
    try {
      return await callback(mockClient);
    } finally {
      inTransaction = false;
      order.push("transaction-end");
    }
  });
  mockClient.bloodlineCardTransfer.create.mockImplementation(async ({ data }: { data: Record<string, any> }) => ({
    id: 1,
    fromUser: { name: USERS[data.fromUserId].name },
  }));
  mockClient.bloodlineCardEvent.create.mockResolvedValue({ id: 1 });
  mockClient.bloodlineCardOwner.deleteMany.mockResolvedValue({ count: 1 });
  mockClient.bloodlineCardOwner.create.mockResolvedValue({});

  mockCreateNotification.mockImplementation(async () => {
    order.push(inTransaction ? "notification-inside-transaction" : "notification");
  });
  mockCaptureServerEvent.mockImplementation(async () => {
    order.push(inTransaction ? "capture-inside-transaction" : "capture");
  });
});

describe("POST /api/bloodline-cards/:id/transfer", () => {
  it("보유자가 넘기면 보유자가 바뀐다", async () => {
    const res = await transfer(kangsan, 11, { toUserId: 21, note: "  잘 부탁해요  ", source: { type: "search" } });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(cards.get(11)?.currentOwnerId).toBe(21);

    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledWith({
      where: { id: 11, status: "ACTIVE", currentOwnerId: 7 },
      data: { currentOwnerId: 21, transferCount: { increment: 1 } },
    });
    expect(mockClient.bloodlineCardTransfer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { cardId: 11, fromUserId: 7, toUserId: 21, note: "잘 부탁해요" },
      })
    );
    // 보유자 거울 행: 지우고 새 보유자 1행
    expect(mockClient.bloodlineCardOwner.deleteMany).toHaveBeenCalledWith({ where: { bloodlineCardId: 11 } });
    expect(mockClient.bloodlineCardOwner.create).toHaveBeenCalledWith({
      data: { bloodlineCardId: 11, userId: 21 },
    });
    expect(mockClient.bloodlineCardOwner.createMany).not.toHaveBeenCalled();
    expect(mockClient.bloodlineCardEvent.create).toHaveBeenCalledWith({
      data: {
        cardId: 11,
        action: "BLOODLINE_TRANSFER",
        actorUserId: 7,
        fromUserId: 7,
        toUserId: 21,
        note: "잘 부탁해요",
      },
    });

    // 알림·계측은 트랜잭션 밖에서 1회
    expect(order).toEqual(["transaction-end", "notification", "capture"]);
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "BLOODLINE_RECEIVED",
      userId: 21,
      senderId: 7,
      message: "강산님이 강산 라인 혈통을 넘겼어요",
      targetType: "bloodline",
      targetId: 11,
    });
    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(7, "bloodline_sent", {
      bloodline_id: 11,
      card_id: 11,
      card_type: "BLOODLINE",
      mode: "transfer",
      via: "search",
      auction_id: null,
    });
    expect(mockClient.$queryRaw).not.toHaveBeenCalled();
    expect(mockClient.$executeRaw).not.toHaveBeenCalled();
  });

  it("body 의 cardId 는 무시한다", async () => {
    const res = await transfer(kangsan, 11, { cardId: 31, toUserName: "민지" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 11 } })
    );
    expect(cards.get(11)?.currentOwnerId).toBe(21);
    // body 의 31 번(민지의 출처 카드)은 건드리지 않는다
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledTimes(1);
    expect(mockClient.bloodlineCard.updateMany.mock.calls[0][0].where.id).toBe(11);
    expect(cards.get(31)).toMatchObject({ currentOwnerId: 21, ownerNameVisible: true });
    expect(mockClient.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "민지" } })
    );
  });

  it("출처 카드를 넘기면 닉네임 공개가 꺼지고 알림이 간다", async () => {
    const minji = asUser(21, "민지");
    const res = await transfer(minji, 31, { toUserId: 22 });

    expect(res.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledWith({
      where: { id: 31, status: "ACTIVE", currentOwnerId: 21 },
      data: { currentOwnerId: 22, transferCount: { increment: 1 }, ownerNameVisible: false },
    });
    expect(cards.get(31)).toMatchObject({ currentOwnerId: 22, ownerNameVisible: false });
    expect(mockClient.bloodlineCardEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cardId: 31, action: "LINE_TRANSFER", fromUserId: 21, toUserId: 22, note: null }),
    });

    expect(order).toEqual(["transaction-end", "notification", "capture"]);
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "BLOODLINE_RECEIVED",
      userId: 22,
      senderId: 21,
      message: "민지님이 강산 라인 출처 카드를 보냈어요",
      targetType: "bloodline",
      targetId: 31,
    });
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(21, "bloodline_sent", {
      bloodline_id: 11,
      card_id: 31,
      card_type: "LINE",
      mode: "transfer",
      via: null,
      auction_id: null,
    });
  });

  it("뿌리 혈통이 숨김·회수면 출처 카드를 넘기지 않고 알림도 보내지 않는다", async () => {
    const minji = asUser(21, "민지");
    for (const status of ["INACTIVE", "REVOKED"]) {
      jest.clearAllMocks();
      cards.get(11)!.status = status;
      const res = await transfer(minji, 31, { toUserId: 22 });
      expect(res.statusCode).toBe(404);
      expect(res.body).toMatchObject({ success: false, errorCode: "BLOODLINE_REVOKED" });
      expect(mockClient.$transaction).not.toHaveBeenCalled();
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(cards.get(31)).toMatchObject({ currentOwnerId: 21, ownerNameVisible: true });
    }
  });

  it("검사 뒤 뿌리가 숨겨졌으면 트랜잭션 안에서 다시 보고 아무것도 쓰지 않는다", async () => {
    const minji = asUser(21, "민지");
    mockClient.$transaction.mockImplementationOnce(async (callback: (tx: typeof mockClient) => unknown) => {
      cards.get(11)!.status = "INACTIVE"; // 운영 숨김이 먼저 끝났다
      return callback(mockClient);
    });
    const res = await transfer(minji, 31, { toUserId: 22 });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOODLINE_REVOKED");
    expect(mockClient.bloodlineCard.updateMany).not.toHaveBeenCalled();
    expect(mockClient.bloodlineCardTransfer.create).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(cards.get(31)?.currentOwnerId).toBe(21);
  });

  it("toUserId 와 toUserName 이 다른 사람이면 404 이고 혈통이 넘어가지 않는다(조작한 링크)", async () => {
    // ?action=transfer&toUserId=<도윤 22>&toUserName=민지 → 확인창에는 민지, 실제로는 22 에게 넘어갈 뻔했다
    const res = await transfer(kangsan, 11, { toUserId: 22, toUserName: "민지" });
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ success: false, errorCode: "BLOODLINE_RECEIVER_NOT_FOUND" });
    expect(cards.get(11)?.currentOwnerId).toBe(7);
    expect(mockClient.$transaction).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();

    // 같은 사람이면(앞뒤 공백만 다름) 넘긴다
    const ok = await transfer(kangsan, 11, { toUserId: 22, toUserName: " 도윤 " });
    expect(ok.statusCode).toBe(200);
    expect(cards.get(11)?.currentOwnerId).toBe(22);
  });

  it("넘긴 뒤 이전 보유자는 다시 넘길 수 없다", async () => {
    const first = await transfer(kangsan, 11, { toUserId: 21 });
    expect(first.statusCode).toBe(200);
    jest.clearAllMocks();

    // 강산은 만든 사람이지만 지금 보유자가 아니다
    const second = await transfer(kangsan, 11, { toUserId: 22 });
    expect(second.statusCode).toBe(403);
    expect(second.body).toMatchObject({ success: false, errorCode: "BLOODLINE_FORBIDDEN" });
    expect(second.body.error).toBe("지금 보유한 분만 할 수 있어요");
    expect(cards.get(11)?.currentOwnerId).toBe(21);
    expect(mockClient.$transaction).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("넘기는 사이 보유자가 바뀌었으면 403 이고 기록을 남기지 않는다", async () => {
    mockClient.bloodlineCard.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await transfer(kangsan, 11, { toUserId: 21 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("BLOODLINE_FORBIDDEN");
    expect(mockClient.bloodlineCardTransfer.create).not.toHaveBeenCalled();
    expect(mockClient.bloodlineCardEvent.create).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("본인에게는 400", async () => {
    const res = await transfer(kangsan, 11, { toUserId: 7 });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, errorCode: "BLOODLINE_RECEIVER_SELF" });
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["내가 차단", { blockedByMe: true, blockedMe: false }],
    ["나를 차단", { blockedByMe: false, blockedMe: true }],
  ])("차단 관계면 403 (%s)", async (_label, relation) => {
    mockGetBlockRelation.mockResolvedValueOnce(relation);
    const res = await transfer(kangsan, 11, { toUserId: 21 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("BLOODLINE_BLOCKED");
    expect(mockGetBlockRelation).toHaveBeenCalledWith(7, 21);
    expect(mockClient.$transaction).not.toHaveBeenCalled();
    expect(cards.get(11)?.currentOwnerId).toBe(7);
  });

  it("받는 사람이 없으면 400 BLOODLINE_RECEIVER_REQUIRED", async () => {
    const res = await transfer(kangsan, 11, { note: "메모만" });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("BLOODLINE_RECEIVER_REQUIRED");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("없는 닉네임은 404, 받을 수 없는 계정은 400", async () => {
    let res = await transfer(kangsan, 11, { toUserName: "없는사람" });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOODLINE_RECEIVER_NOT_FOUND");

    res = await transfer(kangsan, 11, { toUserId: 23 });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("BLOODLINE_RECEIVER_INACTIVE");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("없는 카드는 404 BLOODLINE_NOT_FOUND, 회수된 카드는 404 BLOODLINE_REVOKED", async () => {
    let res = await transfer(kangsan, 999, { toUserId: 21 });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOODLINE_NOT_FOUND");

    res = await transfer(kangsan, "abc", { toUserId: 21 });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOODLINE_NOT_FOUND");

    cards.get(11)!.status = "REVOKED";
    res = await transfer(kangsan, 11, { toUserId: 21 });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOODLINE_REVOKED");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("비로그인은 401", async () => {
    const res = await call({ query: { id: "11" }, body: { toUserId: 21 } });
    expect(res.statusCode).toBe(401);
  });

  it("DB 오류는 errorCode 를 실은 500", async () => {
    mockClient.$transaction.mockRejectedValueOnce(new Error("boom"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await transfer(kangsan, 11, { toUserId: 21 });
    errorSpy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, errorCode: "BLOODLINE_SERVER_ERROR" });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
