/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

const tx = {
  $executeRaw: jest.fn(),
  chatWave: { count: jest.fn(), create: jest.fn() },
  message: { create: jest.fn() },
  chatRoom: { update: jest.fn() },
};
const mockClient = {
  user: { findFirst: jest.fn(), findUnique: jest.fn() },
  chatWave: { findUnique: jest.fn(), count: jest.fn() },
  $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
const mockAssertCanChat = jest.fn();
jest.mock("@libs/server/blocks", () => ({ assertCanChat: (...a: unknown[]) => mockAssertCanChat(...a) }));
const mockScope = jest.fn();
jest.mock("@libs/server/nearby", () => ({ getViewerRegionScope: (...a: unknown[]) => mockScope(...a) }));
const mockRoom = jest.fn();
jest.mock("@libs/server/chatRoom", () => ({ findOrCreateDirectRoom: (...a: unknown[]) => mockRoom(...a) }));
const mockPush = jest.fn();
jest.mock("@libs/server/pushGateway", () => ({ sendAllPushToUsers: (...a: unknown[]) => mockPush(...a) }));
const mockCapture = jest.fn();
jest.mock("@libs/server/analytics", () => ({
  captureServerEvent: (...a: unknown[]) => mockCapture(...a),
  resolveClientPlatform: () => "app",
}));

import waveHandler from "../pages/api/chat/wave";

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
    setHeader: jest.fn(),
    end: jest.fn(),
  };
  return res;
}

const call = async (body: Record<string, unknown>, userId = 1) => {
  const res = createRes();
  await waveHandler(
    { method: "POST", user: { id: userId }, body, headers: {}, query: {} } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAssertCanChat.mockResolvedValue({ ok: true });
  mockScope.mockResolvedValue({ region: { sido: "서울", sigungu: "구로구" }, regions: [{ sido: "서울", sigungu: "구로구", distanceKm: 0 }], label: "서울" });
  mockClient.user.findFirst.mockResolvedValue({ id: 2 });
  mockClient.user.findUnique.mockResolvedValue({ name: "젠크레" });
  mockClient.chatWave.findUnique.mockResolvedValue(null);
  mockClient.chatWave.count.mockResolvedValue(0);
  mockRoom.mockResolvedValue({ id: 50, created: true });
  tx.chatWave.count.mockResolvedValue(3);
  tx.message.create.mockResolvedValue({ id: 900 });
  mockPush.mockResolvedValue(undefined);
});

describe("POST /api/chat/wave", () => {
  it("동네 브리더에게 고른 문구를 채팅으로 보내고 남은 횟수를 준다", async () => {
    const res = await call({ otherId: 2, presetId: "friend" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, chatRoomId: 50, messageId: 900, wavesLeftToday: 6 });
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.chatWave.create.mock.calls[0][0].data).toMatchObject({ senderId: 1, recipientId: 2, chatRoomId: 50, presetId: "friend" });
    expect(tx.message.create.mock.calls[0][0].data).toMatchObject({ type: "TEXT", chatRoomId: 50, userId: 1 });
    expect(tx.message.create.mock.calls[0][0].data.message).toContain("동네 친구");
    expect(mockPush).toHaveBeenCalledWith([2], expect.objectContaining({ url: "/chat/50" }));
    expect(mockCapture).toHaveBeenCalledWith(1, "chat_wave_sent", expect.objectContaining({ preset_id: "friend", platform: "app" }));
  });

  it("나에게·모르는 문구는 400", async () => {
    expect((await call({ otherId: 1, presetId: "hello" })).body.errorCode).toBe("WAVE_SELF");
    expect((await call({ otherId: 2, presetId: "spam" })).body.errorCode).toBe("WAVE_BAD_PRESET");
    expect(mockRoom).not.toHaveBeenCalled();
  });

  it("차단 관계면 assertCanChat 결과를 그대로", async () => {
    mockAssertCanChat.mockResolvedValue({ ok: false, status: 403, error: "x", errorCode: "CHAT_BLOCKED" });
    const res = await call({ otherId: 2, presetId: "hello" });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("CHAT_BLOCKED");
  });

  it("동네 범위 밖이거나 내 동네가 없으면 403 WAVE_NOT_NEARBY", async () => {
    mockClient.user.findFirst.mockResolvedValue(null);
    expect((await call({ otherId: 2, presetId: "hello" })).body.errorCode).toBe("WAVE_NOT_NEARBY");
    mockScope.mockResolvedValue(null);
    expect((await call({ otherId: 2, presetId: "hello" })).body.errorCode).toBe("WAVE_NOT_NEARBY");
    expect(mockRoom).not.toHaveBeenCalled();
  });

  it("이미 인사했으면 409 와 그 채팅방", async () => {
    mockClient.chatWave.findUnique.mockResolvedValue({ chatRoomId: 77 });
    const res = await call({ otherId: 2, presetId: "hello" });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ errorCode: "WAVE_ALREADY", chatRoomId: 77 });
  });

  it("오늘 10명을 채웠으면 429(동시 요청은 잠금 안에서 다시 센다)", async () => {
    mockClient.chatWave.count.mockResolvedValue(10);
    expect((await call({ otherId: 2, presetId: "hello" })).statusCode).toBe(429);
    mockClient.chatWave.count.mockResolvedValue(9);
    tx.chatWave.count.mockResolvedValue(10);
    const res = await call({ otherId: 2, presetId: "hello" });
    expect(res.statusCode).toBe(429);
    expect(tx.message.create).not.toHaveBeenCalled();
  });
});
