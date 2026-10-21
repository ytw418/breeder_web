import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 채팅방 나가기·알림 끄기(앱 docs/prd/chat-room-settings.md).
 * - 나가기는 나만 지운다: 나간 뒤 새 메시지가 없으면 목록에서 빠지고, 방을 열면 나간 뒤 메시지만 보인다.
 * - 알림 끈 방은 푸시를 보내지 않는다. 상대의 설정은 응답에 들어가지 않는다.
 */

const mockClient = {
  userBlock: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  chatRoom: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  chatRoomMember: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  message: { create: jest.fn(), count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
const mockPush = jest.fn();
jest.mock("@libs/server/pushGateway", () => ({ sendAllPushToUsers: (...a: unknown[]) => mockPush(...a) }));

import chatListHandler from "../pages/api/chat/chatList";
import roomHandler from "../pages/api/chat/[chatRoomId]/index";
import messageHandler from "../pages/api/chat/[chatRoomId]/message";
import leaveHandler from "../pages/api/chat/[chatRoomId]/leave";
import muteHandler from "../pages/api/chat/[chatRoomId]/mute";

const ME = 7;
const PARTNER = 9;
const LEFT_AT = new Date("2026-10-20T10:00:00.000Z");
const BEFORE = new Date("2026-10-20T09:00:00.000Z");
const AFTER = new Date("2026-10-20T11:00:00.000Z");

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: Partial<NextApiRequest>
) {
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
    setHeader: jest.fn(),
  };
  await handler(
    { method: "POST", headers: {}, query: {}, body: {}, cookies: {}, user: { id: ME }, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const member = (userId: number, extra: Record<string, unknown> = {}) => ({
  userId,
  lastReadAt: null,
  leftAt: null,
  mutedAt: null,
  user: { id: userId, name: `u${userId}`, avatar: null },
  ...extra,
});
const room = (id: number, lastAt: Date | null, mine: Record<string, unknown> = {}) => ({
  id,
  updatedAt: lastAt ?? BEFORE,
  chatRoomMembers: [member(ME, mine), member(PARTNER, { mutedAt: AFTER, lastReadAt: AFTER })],
  messages: lastAt ? [{ id: id * 10, type: "TEXT", message: "hi", image: null, createdAt: lastAt, userId: PARTNER }] : [],
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockClient.userBlock.findMany.mockResolvedValue([]);
  mockClient.user.findUnique.mockResolvedValue({ id: PARTNER, status: "ACTIVE" });
  mockClient.message.count.mockResolvedValue(1);
  mockPush.mockResolvedValue(undefined);
});

describe("GET /api/chat/chatList", () => {
  it("나간 방은 새 메시지가 올 때까지 빼고, 내 알림 상태만 내려준다", async () => {
    mockClient.chatRoom.findMany.mockResolvedValue([
      room(1, BEFORE, { leftAt: LEFT_AT }), // 나간 뒤 메시지 없음 → 숨김
      room(2, AFTER, { leftAt: LEFT_AT, lastReadAt: LEFT_AT, mutedAt: BEFORE }), // 다시 나타남
    ]);

    const res = await call(chatListHandler, { method: "GET" });

    expect(res.body.chatRooms.map((r: { id: number }) => r.id)).toEqual([2]);
    expect(res.body.chatRooms[0].muted).toBe(true);
    expect(mockClient.message.count.mock.calls[0][0].where.createdAt).toEqual({ gt: LEFT_AT });
    // 상대의 알림·읽음·나가기 상태는 응답에 없다.
    expect(res.body.chatRooms[0].chatRoomMembers).toEqual([
      { user: { id: ME, name: `u${ME}`, avatar: null } },
      { user: { id: PARTNER, name: `u${PARTNER}`, avatar: null } },
    ]);
  });
});

describe("GET /api/chat/:id", () => {
  it("나간 방을 열면 나간 뒤 메시지만 조회하고 me.muted 를 준다", async () => {
    mockClient.chatRoom.findFirst.mockResolvedValue({ id: 3, chatRoomMembers: [] });
    mockClient.chatRoomMember.findUnique.mockResolvedValue({ leftAt: LEFT_AT, mutedAt: null });
    mockClient.message.findMany.mockResolvedValue([]);

    const res = await call(roomHandler, { method: "GET", query: { chatRoomId: "3" } });

    expect(mockClient.message.findMany.mock.calls[0][0].where).toEqual({
      chatRoomId: 3,
      createdAt: { gt: LEFT_AT },
    });
    expect(res.body.me).toEqual({ muted: false });
  });
});

describe("POST /api/chat/:id/message", () => {
  it("상대가 이 방 알림을 껐으면 저장은 하고 푸시는 보내지 않는다", async () => {
    mockClient.chatRoom.findFirst.mockResolvedValue({ id: 3 });
    mockClient.chatRoomMember.findMany.mockResolvedValue([{ userId: PARTNER, mutedAt: BEFORE }]);
    mockClient.$transaction.mockResolvedValue([
      { id: 1, type: "TEXT", message: "hi", image: null, createdAt: AFTER, user: { id: ME, name: "나", avatar: null } },
    ]);

    const res = await call(messageHandler, { query: { chatRoomId: "3" }, body: { message: "hi" } });

    expect(res.body.success).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat/:id/leave · mute", () => {
  it("나가기는 내 멤버에 나간 시각과 읽은 시각을 같이 적고, 멤버가 아니면 404", async () => {
    mockClient.chatRoomMember.findUnique.mockResolvedValueOnce({ id: 1 });
    const ok = await call(leaveHandler, { query: { chatRoomId: "3" } });
    expect(ok.body).toEqual({ success: true });
    const { where, data } = mockClient.chatRoomMember.update.mock.calls[0][0];
    expect(where).toEqual({ userId_chatRoomId: { userId: ME, chatRoomId: 3 } });
    expect(data.leftAt).toBeInstanceOf(Date);
    expect(data.lastReadAt).toBe(data.leftAt);

    mockClient.chatRoomMember.findUnique.mockResolvedValueOnce(null);
    const missing = await call(leaveHandler, { query: { chatRoomId: "4" } });
    expect(missing.statusCode).toBe(404);
  });

  it("알림 켜기는 mutedAt 을 비우고, muted 가 boolean 이 아니면 400", async () => {
    mockClient.chatRoomMember.findUnique.mockResolvedValueOnce({ id: 1 });
    const on = await call(muteHandler, { query: { chatRoomId: "3" }, body: { muted: false } });
    expect(on.body).toEqual({ success: true, muted: false });
    expect(mockClient.chatRoomMember.update.mock.calls[0][0].data).toEqual({ mutedAt: null });

    const bad = await call(muteHandler, { query: { chatRoomId: "3" }, body: { muted: "yes" } });
    expect(bad.statusCode).toBe(400);
  });
});
