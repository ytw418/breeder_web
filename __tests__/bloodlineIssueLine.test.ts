/**
 * @jest-environment node
 */

/**
 * POST /api/bloodline-cards/[id]/issue-line — 출처 카드 보내기(설계 §3.2, PRD AC-84~AC-88, AC-90).
 * - 받는 사람 필수(toUserId 우선, toUserName·receiverNickName·receiverName 별칭), 본인 금지
 * - 출처 카드 이름 = 뿌리 혈통 이름 그대로(이름 중복·패턴 검사 없음). 같은 사람 중복만 409
 * - 권한은 뿌리 혈통의 currentOwnerId 하나. 차단이면 403
 * - 알림(BLOODLINE_RECEIVED)·계측(bloodline_sent)은 트랜잭션이 끝난 뒤 1회
 */
import { Prisma } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  bloodlineCard: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
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

import issueLineHandler from "../pages/api/bloodline-cards/[id]/issue-line";

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
  await (issueLineHandler as (req: NextApiRequest, res: NextApiResponse) => unknown)(
    { headers: {}, query: {}, body: {}, cookies: {}, method: "POST", ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const NOW = new Date("2026-10-08T03:00:00.000Z");
const me = { id: 7, name: "강산(토큰)" } as NextApiRequest["user"];

const USERS: Record<number, { id: number; name: string; status: string }> = {
  7: { id: 7, name: "강산", status: "ACTIVE" },
  21: { id: 21, name: "민지", status: "ACTIVE" },
  22: { id: 22, name: "도윤", status: "ACTIVE" },
  23: { id: 23, name: "정지된분", status: "SUSPENDED" },
};

const ROOT = {
  id: 11,
  cardType: "BLOODLINE",
  name: "강산 라인",
  description: "공주 산 왕사슴벌레 혈통",
  image: "img-root",
  speciesType: "왕사슴벌레",
  originSido: "충청남도",
  originSigungu: "공주시",
  bloodlineReferenceId: null,
  parentCardId: null,
  status: "ACTIVE",
  creatorId: 7,
  currentOwnerId: 7,
};

/** 만들어진 출처 카드(테스트 안의 작은 DB). */
let lines: Array<{ id: number; parentCardId: number; currentOwnerId: number; status: string; name: string }>;
let nextLineId: number;
/** 트랜잭션 콜백이 도는 중인지와 호출 순서 기록 */
let inTransaction: boolean;
let order: string[];

const send = (body: Record<string, unknown>, id: string = "11") =>
  call({ user: me, query: { id }, body });

beforeEach(() => {
  jest.clearAllMocks();
  lines = [];
  nextLineId = 31;
  inTransaction = false;
  order = [];

  mockClient.bloodlineCard.findUnique.mockResolvedValue({ ...ROOT });
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
  mockClient.bloodlineCard.findFirst.mockImplementation(
    async ({ where }: { where: { parentCardId?: number; currentOwnerId?: number; status?: string } }) => {
      const found = lines.find(
        (line) =>
          line.parentCardId === where.parentCardId &&
          line.currentOwnerId === where.currentOwnerId &&
          line.status === (where.status ?? line.status)
      );
      return found ? { id: found.id } : null;
    }
  );
  mockClient.bloodlineCard.updateMany.mockResolvedValue({ count: 1 });
  mockClient.bloodlineCard.create.mockImplementation(async ({ data }: { data: Record<string, any> }) => {
    const id = nextLineId++;
    lines.push({
      id,
      parentCardId: data.parentCardId,
      currentOwnerId: data.currentOwnerId,
      status: "ACTIVE",
      name: data.name,
    });
    return {
      id,
      ...data,
      status: "ACTIVE",
      issueCount: 0,
      transferCount: 0,
      createdAt: NOW,
      updatedAt: NOW,
      creator: { id: USERS[data.creatorId].id, name: USERS[data.creatorId].name },
      currentOwner: { id: USERS[data.currentOwnerId].id, name: USERS[data.currentOwnerId].name },
    };
  });
  mockClient.bloodlineCardEvent.create.mockResolvedValue({ id: 1 });
  mockClient.bloodlineCardOwner.createMany.mockResolvedValue({ count: 1 });

  mockCreateNotification.mockImplementation(async () => {
    order.push(inTransaction ? "notification-inside-transaction" : "notification");
  });
  mockCaptureServerEvent.mockImplementation(async () => {
    order.push(inTransaction ? "capture-inside-transaction" : "capture");
  });
});

describe("POST /api/bloodline-cards/:id/issue-line", () => {
  it("받는 사람 id 로 보내면 원본 이름 그대로 출처 카드를 만든다", async () => {
    const res = await send({
      toUserId: 21,
      note: "  건강한 3령이에요  ",
      source: { type: "chat" },
      // 구 클라이언트 필드는 받되 무시한다
      name: "다른 이름",
      description: "무시",
      image: "img-other",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.card).toMatchObject({
      id: 31,
      name: "강산 라인",
      cardType: "LINE",
      description: "건강한 3령이에요",
      bloodlineReferenceId: 11,
      parentCardId: 11,
      transferPolicy: "NONE",
      creator: { id: 7, name: "강산" },
      currentOwner: { id: 21, name: "민지" },
      isOwnedByMe: false,
    });

    expect(mockClient.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 21 } })
    );
    expect(mockClient.bloodlineCard.create).toHaveBeenCalledTimes(1);
    expect(mockClient.bloodlineCard.create.mock.calls[0][0].data).toEqual({
      cardType: "LINE",
      name: "강산 라인",
      description: "건강한 3령이에요",
      image: "img-root",
      speciesType: "왕사슴벌레",
      originSido: "충청남도",
      originSigungu: "공주시",
      bloodlineReferenceId: 11,
      parentCardId: 11,
      creatorId: 7,
      currentOwnerId: 21,
      transferPolicy: "NONE",
      ownerNameVisible: false,
    });

    // 원본 issueCount +1 (지금 보유자일 때만 올리는 조건부 갱신)
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledWith({
      where: { id: 11, cardType: "BLOODLINE", status: "ACTIVE", currentOwnerId: 7 },
      data: { issueCount: { increment: 1 } },
    });
    // 보유자 거울 행
    expect(mockClient.bloodlineCardOwner.createMany).toHaveBeenCalledWith({
      data: [{ bloodlineCardId: 31, userId: 21 }],
      skipDuplicates: true,
    });
    // 이벤트: 원본 LINE_ISSUED(note = 메모), 새 카드 LINE_CREATED
    const events = mockClient.bloodlineCardEvent.create.mock.calls.map(([arg]) => arg.data);
    expect(events).toEqual([
      expect.objectContaining({
        cardId: 11,
        action: "LINE_ISSUED",
        actorUserId: 7,
        toUserId: 21,
        relatedCardId: 31,
        note: "건강한 3령이에요",
      }),
      expect.objectContaining({ cardId: 31, action: "LINE_CREATED", actorUserId: 7, toUserId: 21 }),
    ]);

    // visualStyle raw UPDATE·Owner 테이블 raw 조회는 없다
    expect(mockClient.$queryRaw).not.toHaveBeenCalled();
    expect(mockClient.$executeRaw).not.toHaveBeenCalled();
    // Serializable 트랜잭션(같은 사람 동시 보내기 방지)
    expect(mockClient.$transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("메모가 없으면 출처 카드 소개와 이벤트 메모는 비워 둔다", async () => {
    const res = await send({ toUserId: 21 });
    expect(res.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.create.mock.calls[0][0].data.description).toBeNull();
    expect(mockClient.bloodlineCardEvent.create.mock.calls[0][0].data.note).toBeNull();
  });

  it("닉네임으로도 보낼 수 있고(별칭 포함) toUserId 가 있으면 그것을 먼저 쓴다", async () => {
    let res = await send({ toUserName: " 민지 " });
    expect(res.statusCode).toBe(200);
    expect(mockClient.user.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { name: "민지" } })
    );

    res = await send({ receiverNickName: "도윤" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.user.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { name: "도윤" } })
    );

    lines = [];
    res = await send({ toUserId: "22", toUserName: " 도윤 " });
    expect(res.statusCode).toBe(200);
    expect(mockClient.user.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: 22 } })
    );
    expect(res.body.card.currentOwner).toEqual({ id: 22, name: "도윤" });
  });

  it("toUserId 와 toUserName 이 다른 사람이면 404 이고 아무것도 보내지 않는다(조작한 링크)", async () => {
    // 링크: ?toUserId=<공격자 22>&toUserName=민지 → 화면에는 민지, 실제로는 22 에게 갈 뻔했다
    const res = await send({ toUserId: 22, toUserName: "민지" });
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ success: false, errorCode: "BLOODLINE_RECEIVER_NOT_FOUND", card: null });
    expect(mockClient.$transaction).not.toHaveBeenCalled();
    expect(mockClient.bloodlineCard.create).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();

    // 별칭(receiverNickName)으로 와도 같다
    const alias = await send({ toUserId: 22, receiverNickName: "민지" });
    expect(alias.statusCode).toBe(404);
    expect(alias.body.errorCode).toBe("BLOODLINE_RECEIVER_NOT_FOUND");
  });

  it("다른 사람에게 두 번째로 보내도 이름 중복으로 막히지 않는다", async () => {
    const first = await send({ toUserId: 21 });
    const second = await send({ toUserId: 22 });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.body.card.name).toBe("강산 라인");
    expect(second.body.card.name).toBe("강산 라인");
    expect(mockClient.bloodlineCard.create).toHaveBeenCalledTimes(2);
    // 중복 검사는 받는 사람 기준(이름으로 찾지 않는다)
    for (const [arg] of mockClient.bloodlineCard.findFirst.mock.calls) {
      expect(arg.where).not.toHaveProperty("name");
      expect(arg.where).toMatchObject({ cardType: "LINE", parentCardId: 11, status: "ACTIVE" });
    }
  });

  it("이미 받은 사람에게 다시 보내면 409 BLOODLINE_ALREADY_SENT", async () => {
    await send({ toUserId: 21 });
    jest.clearAllMocks();

    const res = await send({ toUserId: 21 });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ success: false, card: null, errorCode: "BLOODLINE_ALREADY_SENT" });
    expect(res.body.error).toBe("이미 받은 분이에요");
    expect(mockClient.bloodlineCard.create).not.toHaveBeenCalled();
    expect(mockClient.bloodlineCard.updateMany).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["빈 body", {}],
    ["구 웹 payload {name}", { name: "x" }],
    ["공백 닉네임", { toUserName: "   " }],
    ["잘못된 id", { toUserId: "abc" }],
  ])("받는 사람이 없으면 400 BLOODLINE_RECEIVER_REQUIRED (%s)", async (_label, body) => {
    const res = await send(body);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, card: null, errorCode: "BLOODLINE_RECEIVER_REQUIRED" });
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("본인에게는 400 BLOODLINE_RECEIVER_SELF", async () => {
    let res = await send({ toUserId: 7 });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("BLOODLINE_RECEIVER_SELF");

    res = await send({ toUserName: "강산" });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("BLOODLINE_RECEIVER_SELF");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("없는 닉네임은 404 BLOODLINE_RECEIVER_NOT_FOUND", async () => {
    let res = await send({ toUserName: "없는사람" });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOODLINE_RECEIVER_NOT_FOUND");

    res = await send({ toUserId: 999 });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOODLINE_RECEIVER_NOT_FOUND");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("지금 카드를 받을 수 없는 계정이면 400 BLOODLINE_RECEIVER_INACTIVE", async () => {
    const res = await send({ toUserId: 23 });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("BLOODLINE_RECEIVER_INACTIVE");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["내가 차단", { blockedByMe: true, blockedMe: false }],
    ["나를 차단", { blockedByMe: false, blockedMe: true }],
  ])("차단 관계면 403 BLOODLINE_BLOCKED (%s)", async (_label, relation) => {
    mockGetBlockRelation.mockResolvedValueOnce(relation);
    const res = await send({ toUserId: 21 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("BLOODLINE_BLOCKED");
    expect(mockGetBlockRelation).toHaveBeenCalledWith(7, 21);
    expect(mockClient.$transaction).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("만든 사람이라도 지금 보유자가 아니면 403", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce({ ...ROOT, creatorId: 7, currentOwnerId: 8 });
    const res = await send({ toUserId: 21 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("BLOODLINE_FORBIDDEN");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("출처 카드로는 보낼 수 없다", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce({
      ...ROOT,
      id: 40,
      cardType: "LINE",
      bloodlineReferenceId: 11,
      parentCardId: 11,
      creatorId: 8,
      currentOwnerId: 7,
    });
    const res = await send({ toUserId: 21 }, "40");
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("BLOODLINE_FORBIDDEN");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("보내는 사이 혈통을 넘겼으면 403 이고 아무것도 만들지 않는다", async () => {
    mockClient.bloodlineCard.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await send({ toUserId: 21 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("BLOODLINE_FORBIDDEN");
    expect(mockClient.bloodlineCard.create).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("없는 혈통은 받는 사람보다 먼저 404 BLOODLINE_NOT_FOUND", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce(null);
    let res = await call({ user: me, query: { id: "999999999" }, body: {} });
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ success: false, card: null, errorCode: "BLOODLINE_NOT_FOUND" });

    res = await call({ user: me, query: { id: "abc" }, body: { toUserId: 21 } });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOODLINE_NOT_FOUND");
  });

  it("회수·숨김된 혈통은 404 BLOODLINE_REVOKED", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValueOnce({ ...ROOT, status: "REVOKED" });
    const res = await send({ toUserId: 21 });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOODLINE_REVOKED");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("동시 요청이 부딪히면(P2034) 409 BLOODLINE_CONFLICT", async () => {
    mockClient.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("serialization failure", {
        code: "P2034",
        clientVersion: "6.6.0",
      })
    );
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await send({ toUserId: 21 });
    errorSpy.mockRestore();
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ success: false, card: null, errorCode: "BLOODLINE_CONFLICT" });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("비로그인은 401", async () => {
    const res = await call({ query: { id: "11" }, body: { toUserId: 21 } });
    expect(res.statusCode).toBe(401);
  });

  it("알림과 계측은 트랜잭션 밖에서 1회 보낸다", async () => {
    const res = await send({
      toUserId: 21,
      note: "잘 키워 주세요",
      source: { type: "auction", auctionId: 5 },
    });
    expect(res.statusCode).toBe(200);

    expect(order).toEqual(["transaction-end", "notification", "capture"]);
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "BLOODLINE_RECEIVED",
      userId: 21,
      senderId: 7,
      message: "강산님이 강산 라인 출처 카드를 보냈어요",
      targetType: "bloodline",
      targetId: 31,
    });
    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(7, "bloodline_sent", {
      bloodline_id: 11,
      card_id: 31,
      mode: "issue",
      via: "auction",
      auction_id: 5,
    });
  });

  it("source 가 없거나 모르는 값이면 계측의 via·auction_id 는 null", async () => {
    await send({ toUserId: 21, source: { type: "hack", auctionId: "x" } });
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(7, "bloodline_sent", {
      bloodline_id: 11,
      card_id: 31,
      mode: "issue",
      via: null,
      auction_id: null,
    });
  });
});
