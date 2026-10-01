import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  auctionReport: { findUnique: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
  auction: { findUnique: jest.fn(), update: jest.fn() },
  user: { update: jest.fn(), updateMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
const mockHasAdminAccess = jest.fn();
jest.mock("@libs/server/adminAccess", () => ({
  hasAdminAccess: (...args: unknown[]) => mockHasAdminAccess(...args),
}));
jest.mock("@libs/server/notification", () => ({
  createNotification: jest.fn(),
}));

import auctionReportsHandler from "../pages/api/admin/auction-reports";

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

async function decide(body: Record<string, unknown>) {
  const res = createRes();
  await auctionReportsHandler(
    {
      method: "POST",
      headers: {},
      query: {},
      body,
      user: { id: 1, name: "관리자" },
    } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasAdminAccess.mockResolvedValue(true);
  mockClient.auctionReport.findUnique.mockResolvedValue({
    id: 5,
    status: "OPEN",
    auctionId: 3,
    reportedUserId: 9,
  });
  mockClient.auctionReport.update.mockResolvedValue({ id: 5 });
  mockClient.auctionReport.groupBy.mockResolvedValue([]);
  mockClient.user.updateMany.mockResolvedValue({ count: 1 });
});

describe("/api/admin/auction-reports 영구정지", () => {
  it("BAN_USER 는 BANNED 로 바꾸고 tokenVersion 을 올려 토큰을 무효화한다", async () => {
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "BAN_USER" });

    expect(res.statusCode).toBe(200);
    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: { not: "DELETED" } },
      data: { status: "BANNED", suspendedUntil: null, tokenVersion: { increment: 1 } },
    });
  });

  it("제재 없는 처리(NONE)는 유저 상태를 건드리지 않는다", async () => {
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "NONE" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
  });
});
