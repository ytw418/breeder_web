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
const mockCreateNotification = jest.fn();
jest.mock("@libs/server/notification", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

const mockIssueSanction = jest.fn();
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
  };
});

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
    reporterId: 7,
    reason: "허위 매물 의심",
  });
  mockClient.auction.findUnique.mockResolvedValue({ id: 3, title: "왕사슴 경매", status: "종료", userId: 9 });
  mockIssueSanction.mockResolvedValue({ sanction: { id: 100 }, user: { status: "BANNED", suspendedUntil: null } });
  mockClient.auctionReport.update.mockResolvedValue({ id: 5 });
  mockClient.auctionReport.groupBy.mockResolvedValue([]);
  mockClient.user.updateMany.mockResolvedValue({ count: 1 });
});

describe("/api/admin/auction-reports 사용자 조치", () => {
  it("구 action BAN_USER 는 영구 정지 제재로 보낸다(사유는 신고 사유 기본값)", async () => {
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "BAN_USER" });

    expect(res.statusCode).toBe(200);
    expect(mockIssueSanction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 1,
        userId: 9,
        type: "BAN",
        reasonCode: "FRAUD",
        auctionReportId: 5,
        target: { type: "AUCTION", id: 3, title: "왕사슴 경매" },
      })
    );
    expect(mockClient.auctionReport.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ resolutionAction: "BAN_USER", sanctionId: 100 })
    );
  });

  it("경고·기간 정지도 고를 수 있고 신고자에게 조치 알림 1건(AC-36)", async () => {
    const res = await decide({
      reportId: 5,
      decision: "RESOLVED",
      userAction: { type: "SUSPENSION", days: 3, reasonCode: "TRADE_ABUSE", messageToUser: "입찰 방해" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockIssueSanction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SUSPENSION", days: 3, reasonCode: "TRADE_ABUSE", messageToUser: "입찰 방해" })
    );
    expect(mockClient.auctionReport.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ resolutionAction: "NONE", sanctionId: 100 })
    );
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "MODERATION",
      userId: 7,
      senderId: 1,
      message: "신고하신 경매에 대해 운영정책에 따라 조치했어요.",
    });
  });

  it("기각에 사용자 조치를 붙이면 400", async () => {
    const res = await decide({ reportId: 5, decision: "REJECTED", userAction: { type: "WARNING" } });
    expect(res.statusCode).toBe(400);
    expect(mockIssueSanction).not.toHaveBeenCalled();
  });

  it("제재가 거절되면 그 상태 코드를 돌려주고 신고·경매를 바꾸지 않는다", async () => {
    const { SanctionError } = jest.requireMock("@libs/server/sanctions");
    mockIssueSanction.mockRejectedValue(new SanctionError(409, "이미 영구 정지된 계정이에요.", "ALREADY_BANNED"));
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "STOP_AUCTION_AND_BAN" });
    expect(res.statusCode).toBe(409);
    expect(mockClient.auction.update).not.toHaveBeenCalled();
    expect(mockClient.auctionReport.update).not.toHaveBeenCalled();
  });

  it("제재 없는 처리(NONE)는 제재·신고자 알림이 없다", async () => {
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "NONE" });
    expect(res.statusCode).toBe(200);
    expect(mockIssueSanction).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
