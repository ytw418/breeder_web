import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn() },
  // 입찰 전 분양자와의 차단 관계 확인(getBlockRelation). 기본은 차단 없음.
  userBlock: { findMany: jest.fn().mockResolvedValue([]) },
  auction: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  bid: { findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  auctionReport: { findFirst: jest.fn(), create: jest.fn() },
  auctionRestart: { create: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
jest.mock("@libs/server/notification", () => ({ createNotification: jest.fn() }));
jest.mock("@libs/server/growth", () => ({ incrementUserMissionProgress: jest.fn() }));

import restartHandler from "../pages/api/auctions/[id]/restart";
import bidHandler from "../pages/api/auctions/[id]/bid";
import { settleExpiredAuctions } from "@libs/server/auctionSettlement";
import { createNotification } from "@libs/server/notification";

const mockNotify = createNotification as jest.Mock;

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
    setHeader() {},
  };
  await handler(
    { method: "POST", headers: {}, query: { id: "5" }, body: {}, cookies: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-13T03:00:00.000Z");
const seller = { id: 7, name: "브리더" } as NextApiRequest["user"];
const newEndAt = new Date(NOW.getTime() + 24 * HOUR).toISOString();
const auctionRow = (patch: Record<string, unknown>) => ({
  id: 5,
  title: "왕사슴 유충",
  userId: 7,
  status: "유찰",
  winnerId: null,
  round: 1,
  isHidden: false,
  startPrice: 10000,
  currentPrice: 10000,
  endAt: new Date(NOW.getTime() - HOUR),
  user: { name: "브리더" },
  ...patch,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  mockClient.auction.findMany.mockResolvedValue([]);
  mockClient.user.findUnique.mockImplementation(({ where }) =>
    Promise.resolve({ id: where.id, status: "ACTIVE" })
  );
  mockClient.auction.count.mockResolvedValue(0);
  mockClient.auction.updateMany.mockResolvedValue({ count: 1 });
  mockClient.bid.findMany.mockResolvedValue([]);
  mockClient.bid.updateMany.mockResolvedValue({ count: 0 });
  mockClient.auctionReport.findFirst.mockResolvedValue(null);
  mockClient.auctionReport.create.mockResolvedValue({ id: 31 });
  mockClient.auctionRestart.create.mockResolvedValue({ id: 1 });
  mockClient.$transaction.mockImplementation((fn: (tx: typeof mockClient) => unknown) => fn(mockClient));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("POST /api/auctions/:id/restart", () => {
  it("유찰된 경매를 새 기간으로 같은 경매의 다음 회차로 연다", async () => {
    mockClient.auction.findUnique.mockResolvedValue(auctionRow({}));

    const res = await call(restartHandler, { user: seller, body: { endAt: newEndAt } });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, auction: { round: 2, status: "진행중" }, restartsLeft: 2 });
    expect(mockClient.auction.updateMany).toHaveBeenCalledWith({
      where: { id: 5, round: 1, status: "유찰", isHidden: false },
      data: expect.objectContaining({
        status: "진행중",
        winnerId: null,
        currentPrice: 10000,
        endAt: new Date(newEndAt),
        round: 2,
        listedAt: NOW,
      }),
    });
    expect(mockClient.auctionRestart.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ round: 1, previousStatus: "유찰", previousWinnerId: null, reason: null }),
    });
    expect(mockClient.auctionReport.create).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("낙찰된 경매는 사유를 받아 낙찰자를 막고 운영 신고를 접수하고, 낙찰자·다른 입찰자에게 알린다", async () => {
    mockClient.auction.findUnique.mockResolvedValue(
      auctionRow({ status: "종료", winnerId: 9, currentPrice: 52000 })
    );
    mockClient.bid.findMany.mockResolvedValue([{ userId: 9 }, { userId: 11 }, { userId: 9 }]);

    const res = await call(restartHandler, { user: seller, body: { endAt: newEndAt, reason: "NO_CONTACT" } });

    expect(res.statusCode).toBe(200);
    expect(mockClient.bid.updateMany).toHaveBeenCalledWith({
      where: { auctionId: 5, archivedAt: null },
      data: { archivedAt: NOW },
    });
    expect(mockClient.auctionReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reporterId: 7, reportedUserId: 9, reason: "낙찰 후 노쇼" }),
      select: { id: true },
    });
    expect(mockClient.auctionRestart.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousStatus: "종료",
        previousPrice: 52000,
        previousBidCount: 3,
        previousWinnerId: 9,
        reason: "NO_CONTACT",
        reportId: 31,
      }),
    });
    expect(mockNotify).toHaveBeenCalledTimes(2);
    expect(mockNotify.mock.calls.map(([arg]) => [arg.type, arg.userId])).toEqual([
      ["AUCTION_RESTARTED", 9],
      ["AUCTION_RESTARTED", 11],
    ]);
  });

  it("낙찰된 경매를 사유 없이 다시 시작하면 거절한다", async () => {
    mockClient.auction.findUnique.mockResolvedValue(auctionRow({ status: "종료", winnerId: 9 }));

    const res = await call(restartHandler, { user: seller, body: { endAt: newEndAt } });

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_RESTART_REASON_REQUIRED");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("분양자가 아니면 403, 그 사이 상태가 바뀌었으면 409", async () => {
    mockClient.auction.findUnique.mockResolvedValue(auctionRow({}));
    const other = await call(restartHandler, { user: { id: 99 } as NextApiRequest["user"], body: { endAt: newEndAt } });
    expect(other.statusCode).toBe(403);
    expect(other.body.errorCode).toBe("AUCTION_RESTART_FORBIDDEN");

    mockClient.auction.updateMany.mockResolvedValue({ count: 0 });
    const conflict = await call(restartHandler, { user: seller, body: { endAt: newEndAt } });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.body.errorCode).toBe("AUCTION_RESTART_CONFLICT");
  });
});

it("이전 낙찰자는 다시 시작한 경매에 입찰할 수 없다", async () => {
  mockClient.auction.findUnique.mockResolvedValue({
    ...auctionRow({ status: "진행중", round: 2, endAt: new Date(NOW.getTime() + HOUR) }),
    minBidIncrement: 1000,
    bids: [],
  });
  mockClient.auctionRestart.findFirst.mockResolvedValue({ id: 1 });

  const res = await call(bidHandler, { user: { id: 9 } as NextApiRequest["user"], body: { amount: 11000 } });

  expect(res.statusCode).toBe(403);
  expect(res.body.errorCode).toBe("BID_BLOCKED_PREVIOUS_WINNER");
  expect(mockClient.auctionRestart.findFirst).toHaveBeenCalledWith({
    where: { auctionId: 5, previousWinnerId: 9 },
    select: { id: true },
  });
});

it("유찰 정산은 이번 회차 입찰만 보고, 다시 시작을 권하는 알림을 회차마다 보낸다", async () => {
  mockClient.auction.findMany.mockResolvedValue([{ id: 5, title: "왕사슴 유충", userId: 7 }]);
  mockClient.bid.findFirst.mockResolvedValue(null);

  await settleExpiredAuctions(5);

  expect(mockClient.bid.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { auctionId: 5, archivedAt: null } })
  );
  expect(mockNotify).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "AUCTION_END",
      userId: 7,
      message: '"왕사슴 유충" 경매가 입찰 없이 마감됐어요. 기간을 새로 정해 다시 시작해 보세요.',
      dedupe: false,
    })
  );
});
