import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  userSanction: { findMany: jest.fn(), groupBy: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/notification", () => ({ createNotification: jest.fn() }));

import meSanctionsHandler from "../pages/api/users/me/sanctions";

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
  };
  return res;
}

const me = { id: 7, name: "칠번" } as NextApiRequest["user"];

async function call(req: { method: string; query?: Record<string, string>; body?: Record<string, unknown> }, user = me) {
  const res = createRes();
  await meSanctionsHandler(
    { headers: {}, query: {}, body: {}, user, ...req } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const NOW = new Date("2026-10-09T05:20:00.000Z");
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 3,
  userId: 7,
  actorId: 1,
  type: "WARNING",
  reasonCode: "ABUSE",
  messageToUser: "댓글에서 비하 표현이 확인되었어요.",
  internalNote: "신고자 홍길동, 3번째 신고",
  days: null,
  startsAt: NOW,
  endsAt: null,
  reportId: 55,
  auctionReportId: null,
  targetType: "COMMENT",
  targetId: 9,
  snapshot: { title: "초보면", excerpt: "초보면 가만히나 있지" },
  acknowledgedAt: null,
  createdAt: NOW,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.userSanction.findMany.mockResolvedValue([row()]);
  mockClient.userSanction.groupBy.mockResolvedValue([{ type: "WARNING", _count: { _all: 1 } }]);
  mockClient.userSanction.updateMany.mockResolvedValue({ count: 1 });
});

describe("GET /api/users/me/sanctions", () => {
  it("내 제재 내역을 최신순으로, 대상자용 필드만 돌려준다(AC-15·AC-34)", async () => {
    const res = await call({ method: "GET" });

    expect(mockClient.userSanction.findMany).toHaveBeenCalledWith({
      where: { userId: 7 },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    expect(res.body).toEqual({
      success: true,
      sanctions: [
        {
          id: 3,
          type: "WARNING",
          reasonCode: "ABUSE",
          reasonLabel: "욕설·비하·혐오 표현",
          messageToUser: "댓글에서 비하 표현이 확인되었어요.",
          days: null,
          startsAt: NOW.toISOString(),
          endsAt: null,
          target: { type: "COMMENT", id: 9, title: "초보면", excerpt: "초보면 가만히나 있지" },
          acknowledgedAt: null,
          createdAt: NOW.toISOString(),
        },
      ],
      recentWarningCount: 1,
      recentSuspensionCount: 0,
    });
    expect(res.body).not.toHaveProperty("recommendation");
    expect(JSON.stringify(res.body)).not.toMatch(/internalNote|actorId|reportId|홍길동/);
  });

  it("unacknowledged=1 이면 미확인 경고·정지를 오래된 순으로(AC-23)", async () => {
    await call({ method: "GET", query: { unacknowledged: "1" } });
    expect(mockClient.userSanction.findMany).toHaveBeenCalledWith({
      where: { userId: 7, type: { in: ["WARNING", "SUSPENSION"] }, acknowledgedAt: null },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
  });
});

describe("PATCH /api/users/me/sanctions", () => {
  it("내 미확인 안내를 확인 처리한다(AC-22)", async () => {
    const res = await call({ method: "PATCH", body: { id: 3 } });
    expect(res.statusCode).toBe(200);
    expect(mockClient.userSanction.updateMany).toHaveBeenCalledWith({
      where: { id: 3, userId: 7, type: { in: ["WARNING", "SUSPENSION"] }, acknowledgedAt: null },
      data: { acknowledgedAt: expect.any(Date) },
    });
  });

  it("이미 확인했으면 그대로 성공", async () => {
    mockClient.userSanction.updateMany.mockResolvedValue({ count: 0 });
    mockClient.userSanction.findFirst.mockResolvedValue({ id: 3 });
    const res = await call({ method: "PATCH", body: { id: 3 } });
    expect(res.statusCode).toBe(200);
  });

  it("남의 안내이거나 없으면 404, 잘못된 id 는 400", async () => {
    mockClient.userSanction.updateMany.mockResolvedValue({ count: 0 });
    mockClient.userSanction.findFirst.mockResolvedValue(null);
    expect((await call({ method: "PATCH", body: { id: 99 } })).statusCode).toBe(404);
    expect((await call({ method: "PATCH", body: { id: "x" } })).statusCode).toBe(400);
  });

  it("비로그인(정지 중 포함)은 401", async () => {
    const res = await call({ method: "GET" }, null as unknown as NextApiRequest["user"]);
    expect(res.statusCode).toBe(401);
    expect(mockClient.userSanction.findMany).not.toHaveBeenCalled();
  });
});
