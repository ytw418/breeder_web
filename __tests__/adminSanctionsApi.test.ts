import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn() },
  userSanction: { findMany: jest.fn() },
  report: { findMany: jest.fn(), count: jest.fn() },
  moderationLog: { findMany: jest.fn() },
  post: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

const mockHasAdminAccess = jest.fn();
const mockCanRunSensitive = jest.fn();
jest.mock("@libs/server/adminAccess", () => ({
  hasAdminAccess: (...args: unknown[]) => mockHasAdminAccess(...args),
  canRunSensitiveAdminAction: (...args: unknown[]) => mockCanRunSensitive(...args),
}));
jest.mock("@libs/server/notification", () => ({ createNotification: jest.fn() }));

const mockIssueSanction = jest.fn();
const mockGetSanctionSummary = jest.fn();
jest.mock("@libs/server/sanctions", () => {
  class SanctionError extends Error {
    constructor(
      readonly status: number,
      message: string,
      readonly code: string
    ) {
      super(message);
      Object.setPrototypeOf(this, SanctionError.prototype);
    }
  }
  return {
    SanctionError,
    isSanctionError: (error: unknown) => error instanceof SanctionError,
    issueSanction: (...args: unknown[]) => mockIssueSanction(...args),
    getSanctionSummary: (...args: unknown[]) => mockGetSanctionSummary(...args),
  };
});

import sanctionsHandler from "../pages/api/admin/sanctions";
import userDetailHandler from "../pages/api/admin/users/[id]";

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

const admin = { id: 1, name: "관리자" } as NextApiRequest["user"];

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: { method: string; body?: Record<string, unknown>; query?: Record<string, string> }
) {
  const res = createRes();
  await handler(
    { headers: {}, query: {}, body: {}, user: admin, ...req } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasAdminAccess.mockResolvedValue(true);
  mockCanRunSensitive.mockReturnValue(false);
  mockIssueSanction.mockResolvedValue({ sanction: { id: 100, type: "WARNING" }, user: { status: "ACTIVE", suspendedUntil: null } });
});

describe("POST /api/admin/sanctions", () => {
  it("입력을 제재 서비스로 넘기고 201 을 준다", async () => {
    const res = await call(sanctionsHandler, {
      method: "POST",
      body: {
        userId: "7",
        type: "SUSPENSION",
        days: "10",
        reasonCode: "SPAM",
        messageToUser: "도배",
        internalNote: "메모",
        reportId: 55,
        target: { type: "POST", id: "9", title: "제목", excerpt: "가".repeat(150) },
      },
    });

    expect(res.statusCode).toBe(201);
    expect(mockIssueSanction).toHaveBeenCalledWith({
      actorId: 1,
      userId: 7,
      type: "SUSPENSION",
      days: 10,
      reasonCode: "SPAM",
      messageToUser: "도배",
      internalNote: "메모",
      reportId: 55,
      target: { type: "POST", id: 9, title: "제목", excerpt: "가".repeat(100) },
    });
    expect(res.body.sanction).toEqual({ id: 100, type: "WARNING" });
  });

  it("잘못된 대상은 버리고, 일수가 없으면 null 로 넘긴다", async () => {
    await call(sanctionsHandler, {
      method: "POST",
      body: { userId: 7, type: "WARNING", reasonCode: "ABUSE", target: { type: "CHAT", id: 1 } },
    });
    expect(mockIssueSanction).toHaveBeenCalledWith(expect.objectContaining({ days: null, target: null, reportId: null }));
  });

  it("userId·유형이 없으면 400", async () => {
    const res = await call(sanctionsHandler, { method: "POST", body: { userId: 7, type: "MUTE" } });
    expect(res.statusCode).toBe(400);
    expect(mockIssueSanction).not.toHaveBeenCalled();
  });

  it("제재 서비스 거절은 상태 코드·문구·코드를 그대로 돌려준다(E-2·E-8·E-14)", async () => {
    const { SanctionError } = jest.requireMock("@libs/server/sanctions");
    mockIssueSanction.mockRejectedValue(
      new SanctionError(409, "영구 정지된 계정이에요. 먼저 정지를 해제해 주세요.", "USER_BANNED")
    );
    const res = await call(sanctionsHandler, {
      method: "POST",
      body: { userId: 7, type: "SUSPENSION", days: 3, reasonCode: "SPAM" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: "영구 정지된 계정이에요. 먼저 정지를 해제해 주세요.",
      errorCode: "USER_BANNED",
    });
  });

  it("비관리자는 403(E-10)", async () => {
    mockHasAdminAccess.mockResolvedValue(false);
    const res = await call(sanctionsHandler, { method: "POST", body: { userId: 7, type: "WARNING" } });
    expect(res.statusCode).toBe(403);
    expect(mockIssueSanction).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/sanctions", () => {
  it("사용자 제재 이력을 최신순으로 돌려준다", async () => {
    mockClient.userSanction.findMany.mockResolvedValue([{ id: 2 }, { id: 1 }]);
    const res = await call(sanctionsHandler, { method: "GET", query: { userId: "7" } });
    expect(mockClient.userSanction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7 }, orderBy: { createdAt: "desc" } })
    );
    expect(res.body).toEqual({ success: true, sanctions: [{ id: 2 }, { id: 1 }] });
  });

  it("userId 가 없으면 400", async () => {
    const res = await call(sanctionsHandler, { method: "GET", query: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/admin/users/[id] (AC-30)", () => {
  const target = { id: 7, name: "칠번", status: "SUSPENDED", suspendedUntil: new Date("2026-10-19T05:20:00.000Z") };

  beforeEach(() => {
    mockClient.user.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
      Promise.resolve(where.id === 7 ? target : where.id === 1 ? { email: "admin@bredy.app" } : null)
    );
    mockGetSanctionSummary.mockResolvedValue({
      recentWarningCount: 1,
      recentSuspensionCount: 1,
      recommendation: { type: "SUSPENSION", days: 10 },
    });
    mockClient.userSanction.findMany.mockResolvedValue([{ id: 3, type: "SUSPENSION" }]);
    mockClient.report.findMany.mockResolvedValue([{ id: 55 }]);
    mockClient.report.count.mockResolvedValue(4);
    mockClient.moderationLog.findMany.mockResolvedValue([{ id: 8, action: "HIDE" }]);
    mockClient.post.findMany.mockResolvedValue([{ id: 9, title: "글" }]);
    mockClient.product.findMany.mockResolvedValue([]);
  });

  it("상태·누적 제재·이력·받은 신고·콘텐츠 조치·최근 글을 돌려준다", async () => {
    const res = await call(userDetailHandler, { method: "GET", query: { id: "7" } });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      user: target,
      summary: {
        recentWarningCount: 1,
        recentSuspensionCount: 1,
        recommendation: { type: "SUSPENSION", days: 10 },
        reportsReceivedCount: 4,
      },
      sanctions: [{ id: 3, type: "SUSPENSION" }],
      reportsReceived: [{ id: 55 }],
      contentActions: [{ id: 8, action: "HIDE" }],
      posts: [{ id: 9, title: "글" }],
      products: [],
      canRunSensitiveActions: false,
    });
    expect(mockClient.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reportedUserId: 7 }, take: 20 })
    );
    expect(mockClient.moderationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { targetUserId: 7 } })
    );
    expect(mockCanRunSensitive).toHaveBeenCalledWith("admin@bredy.app");
  });

  it("없는 사용자는 404, 잘못된 id 는 400", async () => {
    expect((await call(userDetailHandler, { method: "GET", query: { id: "999" } })).statusCode).toBe(404);
    expect((await call(userDetailHandler, { method: "GET", query: { id: "abc" } })).statusCode).toBe(400);
  });

  it("비관리자는 403", async () => {
    mockHasAdminAccess.mockResolvedValue(false);
    const res = await call(userDetailHandler, { method: "GET", query: { id: "7" } });
    expect(res.statusCode).toBe(403);
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
  });
});
