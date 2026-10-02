import type { NextApiRequest, NextApiResponse } from "next";

/**
 * #18 서버 차단 — 채팅 가드.
 * - 방 생성·메시지 전송은 어느 쪽이 차단했든 403 CHAT_BLOCKED(문구 공통).
 * - 상대가 탈퇴(DELETED)했으면 403 CHAT_PARTNER_DELETED.
 * - 차단한 사람의 채팅 목록·unread 에서는 차단 상대가 있는 방을 뺀다.
 */

const mockClient = {
  user: { findUnique: jest.fn() },
  userBlock: { findMany: jest.fn() },
  chatRoom: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  chatRoomMember: { findMany: jest.fn(), findFirst: jest.fn() },
  message: { create: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
const mockSendAllPushToUsers = jest.fn();
jest.mock("@libs/server/pushGateway", () => ({
  sendAllPushToUsers: (...args: unknown[]) => mockSendAllPushToUsers(...args),
}));

import createRoomHandler from "../pages/api/chat/index";
import messageHandler from "../pages/api/chat/[chatRoomId]/message";
import chatListHandler from "../pages/api/chat/chatList";
import unreadCountHandler from "../pages/api/chat/unread-count";

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
    },
  };
  return res;
}

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: Partial<NextApiRequest>
) {
  const res = createRes();
  await handler(
    { method: "POST", headers: {}, query: {}, body: {}, cookies: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const ME = 7;
const PARTNER = 9;
const ROOM_ID = 30;
const me = { id: ME, name: "나" } as NextApiRequest["user"];

type BlockRow = { blockerId: number; blockedId: number };
let blocks: BlockRow[] = [];
let userStatus: Record<number, string> = {};

type BlockWhere = {
  blockerId?: number;
  blockedId?: number;
  OR?: { blockerId: number; blockedId: number }[];
};

const matchesBlock = (row: BlockRow, where: BlockWhere): boolean => {
  if (where.OR) {
    return where.OR.some((cond) => matchesBlock(row, cond));
  }
  return (
    (where.blockerId === undefined || row.blockerId === where.blockerId) &&
    (where.blockedId === undefined || row.blockedId === where.blockedId)
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  blocks = [];
  userStatus = { [ME]: "ACTIVE", [PARTNER]: "ACTIVE" };

  mockClient.userBlock.findMany.mockImplementation(({ where }: { where: BlockWhere }) =>
    Promise.resolve(
      blocks
        .filter((row) => matchesBlock(row, where))
        .map((row) => ({ blockerId: row.blockerId, blockedId: row.blockedId }))
    )
  );
  mockClient.user.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
    Promise.resolve(userStatus[where.id] ? { id: where.id, status: userStatus[where.id] } : null)
  );

  mockClient.chatRoom.findFirst.mockResolvedValue({ id: ROOM_ID });
  mockClient.chatRoom.create.mockResolvedValue({ id: 31 });
  mockClient.chatRoom.update.mockResolvedValue({ id: ROOM_ID });
  mockClient.chatRoom.findMany.mockResolvedValue([]);
  mockClient.chatRoomMember.findMany.mockResolvedValue([{ userId: PARTNER }]);
  mockClient.chatRoomMember.findFirst.mockResolvedValue({ userId: PARTNER });
  mockClient.message.create.mockResolvedValue({
    id: 100,
    type: "TEXT",
    message: "안녕하세요",
    image: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    user: { id: ME, name: "나", avatar: null },
  });
  mockClient.message.count.mockResolvedValue(0);
  mockClient.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  mockSendAllPushToUsers.mockResolvedValue(undefined);
});

describe("POST /api/chat 방 생성 차단 가드", () => {
  const createRoom = () => call(createRoomHandler, { user: me, body: { otherId: PARTNER } });

  it("내가 상대를 차단했으면 403 CHAT_BLOCKED, 방을 찾거나 만들지 않는다", async () => {
    blocks = [{ blockerId: ME, blockedId: PARTNER }];
    const res = await createRoom();

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: "이 사용자에게는 메시지를 보낼 수 없습니다.",
      errorCode: "CHAT_BLOCKED",
    });
    expect(mockClient.chatRoom.findFirst).not.toHaveBeenCalled();
    expect(mockClient.chatRoom.create).not.toHaveBeenCalled();
  });

  it("상대가 나를 차단했어도 같은 문구의 403 CHAT_BLOCKED", async () => {
    blocks = [{ blockerId: PARTNER, blockedId: ME }];
    const res = await createRoom();

    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("CHAT_BLOCKED");
    expect(res.body.error).toBe("이 사용자에게는 메시지를 보낼 수 없습니다.");
    expect(mockClient.chatRoom.create).not.toHaveBeenCalled();
  });

  it("상대가 탈퇴했으면 403 CHAT_PARTNER_DELETED", async () => {
    userStatus[PARTNER] = "DELETED";
    const res = await createRoom();

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: "탈퇴한 사용자에게는 메시지를 보낼 수 없습니다.",
      errorCode: "CHAT_PARTNER_DELETED",
    });
    expect(mockClient.chatRoom.create).not.toHaveBeenCalled();
  });

  it("차단 관계가 없으면 기존 방을 그대로 돌려준다", async () => {
    blocks = [{ blockerId: ME, blockedId: 55 }];
    const res = await createRoom();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, ChatRoomId: ROOM_ID });
    expect(mockClient.chatRoom.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat/:id/message 전송 차단 가드", () => {
  const send = () =>
    call(messageHandler, {
      user: me,
      query: { chatRoomId: String(ROOM_ID) },
      body: { type: "TEXT", message: "안녕하세요" },
    });

  it("차단 관계가 있으면 403 CHAT_BLOCKED, 메시지 저장·푸시를 하지 않는다", async () => {
    blocks = [{ blockerId: PARTNER, blockedId: ME }];
    const res = await send();

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: "이 사용자에게는 메시지를 보낼 수 없습니다.",
      errorCode: "CHAT_BLOCKED",
    });
    expect(mockClient.message.create).not.toHaveBeenCalled();
    expect(mockClient.$transaction).not.toHaveBeenCalled();
    expect(mockSendAllPushToUsers).not.toHaveBeenCalled();
  });

  it("상대가 탈퇴했으면 403 CHAT_PARTNER_DELETED, 메시지 저장·푸시를 하지 않는다", async () => {
    userStatus[PARTNER] = "DELETED";
    const res = await send();

    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("CHAT_PARTNER_DELETED");
    expect(res.body.error).toBe("탈퇴한 사용자에게는 메시지를 보낼 수 없습니다.");
    expect(mockClient.message.create).not.toHaveBeenCalled();
    expect(mockSendAllPushToUsers).not.toHaveBeenCalled();
  });

  it("방 멤버가 아니면 기존대로 404(차단 확인 전)", async () => {
    mockClient.chatRoom.findFirst.mockResolvedValue(null);
    const res = await send();

    expect(res.statusCode).toBe(404);
    expect(mockClient.userBlock.findMany).not.toHaveBeenCalled();
  });

  it("차단 관계가 없으면 저장하고 상대에게만 푸시한다", async () => {
    const res = await send();

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClient.message.create).toHaveBeenCalledTimes(1);
    expect(mockSendAllPushToUsers).toHaveBeenCalledTimes(1);
    expect(mockSendAllPushToUsers.mock.calls[0][0]).toEqual([PARTNER]);
  });
});

describe("GET /api/chat/chatList 차단 상대 방 숨김", () => {
  const list = () => call(chatListHandler, { method: "GET", user: me });

  it("차단 목록이 비어 있으면 where 는 기존 그대로", async () => {
    const res = await list();

    expect(res.statusCode).toBe(200);
    expect(mockClient.chatRoom.findMany).toHaveBeenCalledTimes(1);
    expect(mockClient.chatRoom.findMany.mock.calls[0][0].where).toEqual({
      chatRoomMembers: { some: { userId: ME } },
    });
  });

  it("내가 차단한 사람이 있으면 그 사람이 멤버인 방을 none 필터로 뺀다", async () => {
    blocks = [
      { blockerId: ME, blockedId: PARTNER },
      { blockerId: ME, blockedId: 12 },
      // 상대가 나를 차단한 것은 내 목록에 영향을 주지 않는다(피차단자 목록에는 그대로 보인다).
      { blockerId: 44, blockedId: ME },
    ];
    await list();

    const where = mockClient.chatRoom.findMany.mock.calls[0][0].where;
    expect(where.chatRoomMembers.some).toEqual({ userId: ME });
    expect(where.chatRoomMembers.none).toEqual({ userId: { in: [PARTNER, 12] } });
  });
});

describe("GET /api/chat/unread-count 차단 상대 방 제외", () => {
  const count = () => call(unreadCountHandler, { method: "GET", user: me });

  it("차단 목록이 비어 있으면 where 는 기존 그대로", async () => {
    mockClient.chatRoomMember.findMany.mockResolvedValue([]);
    const res = await count();

    expect(res.statusCode).toBe(200);
    expect(mockClient.chatRoomMember.findMany.mock.calls[0][0].where).toEqual({ userId: ME });
  });

  it("내가 차단한 사람이 있는 방의 멤버십은 세지 않는다", async () => {
    blocks = [{ blockerId: ME, blockedId: PARTNER }];
    mockClient.chatRoomMember.findMany.mockResolvedValue([]);
    await count();

    expect(mockClient.chatRoomMember.findMany.mock.calls[0][0].where).toEqual({
      userId: ME,
      chatRoom: { chatRoomMembers: { none: { userId: { in: [PARTNER] } } } },
    });
  });
});
