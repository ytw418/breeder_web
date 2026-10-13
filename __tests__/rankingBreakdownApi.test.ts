/**
 * @jest-environment node
 */
/**
 * 랭킹 세분화(2026-10-12): 이번 달 기간, 종 필터(하위 포함·상위 제외), 경매 활동·분양 사람 랭킹.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const CATEGORIES = [
  { id: 1, name: "파충류", slug: "reptile", parentId: null, path: "/reptile/", sortOrder: 0, isVisible: true },
  { id: 2, name: "크레스티드 게코", slug: "crested", parentId: 1, path: "/reptile/crested/", sortOrder: 0, isVisible: true },
  { id: 3, name: "볼파이썬", slug: "ball", parentId: 1, path: "/reptile/ball/", sortOrder: 1, isVisible: true },
];

const mockClient = {
  category: { findMany: jest.fn(async () => CATEGORIES) },
  user: {
    findMany: jest.fn(async ({ where }: any) =>
      (where?.id?.in ?? []).map((id: number) => ({ id, name: `u${id}`, avatar: null }))
    ),
  },
  product: { groupBy: jest.fn() },
  bid: { groupBy: jest.fn() },
  auction: { groupBy: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));

import { getPreviousMonthWindow, getMonthWindow } from "@libs/server/season";
import { listingMetricWhere, resolveRankingWindows } from "@libs/server/ranking";
import listingsHandler from "../pages/api/rankings/listings";
import auctionActivityHandler from "../pages/api/rankings/auction-activity";

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
      res.headers[name] = value;
    },
    end: jest.fn(),
  };
  return res;
}

const get = async (handler: any, query: Record<string, string>) => {
  const res = createRes();
  await handler({ method: "GET", query, headers: {} } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
};

const isCurrent = (where: any) => where.createdAt && where.createdAt.lte.getTime() > Date.now();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("기간", () => {
  it("이번 달·지난달은 KST 달력 기준으로 붙어 있다", () => {
    const base = new Date("2026-03-01T00:30:00.000Z"); // 3월 1일 09:30 KST
    const month = getMonthWindow(base);
    const previous = getPreviousMonthWindow(base);
    expect(month.startAt.toISOString()).toBe("2026-02-28T15:00:00.000Z");
    expect(previous.startAt.toISOString()).toBe("2026-01-31T15:00:00.000Z");
    expect(previous.endAt.getTime()).toBe(month.startAt.getTime() - 1);
  });

  it("역대는 기간이 없고, 이번 주·이번 달은 이전 기간이 있다", () => {
    expect(resolveRankingWindows("all")).toEqual({ current: null, previous: null });
    expect(resolveRankingWindows("weekly").previous).not.toBeNull();
    expect(resolveRankingWindows("monthly").current).not.toBeNull();
  });

  it("분양 지표를 완료로 바꾸면 판매완료 상태만 센다", () => {
    expect(listingMetricWhere("posted", null)).toEqual({});
    expect(listingMetricWhere("completed", null)).toEqual({ status: "판매완료" });
  });
});

describe("GET /api/rankings/listings", () => {
  it("이번 달 분양글 수 순, 지난달 대비 순위 변화", async () => {
    mockClient.product.groupBy.mockImplementation(async ({ where }: any) =>
      isCurrent(where)
        ? [
            { userId: 5, _count: { _all: 3 } },
            { userId: 6, _count: { _all: 7 } },
          ]
        : [
            { userId: 5, _count: { _all: 9 } },
            { userId: 6, _count: { _all: 1 } },
          ]
    );
    const res = await get(listingsHandler, { period: "monthly" });
    expect(res.statusCode).toBe(200);
    expect(res.body.items.map((i: any) => [i.user.id, i.listingsCount, i.rankDelta])).toEqual([
      [6, 7, 1],
      [5, 3, -1],
    ]);
    expect(res.body.items[0].metric).toBe("posted");
    const where = mockClient.product.groupBy.mock.calls[0][0].where;
    expect(where).toMatchObject({ isHidden: false, isDeleted: false });
  });

  it("소분류 필터는 그 종과 하위만(파충류로만 단 글은 빼고), 모르는 종은 빈 목록", async () => {
    mockClient.product.groupBy.mockResolvedValue([]);
    await get(listingsHandler, { period: "all", species: "크레스티드 게코" });
    expect(mockClient.product.groupBy.mock.calls[0][0].where.categoryId).toEqual({ in: [2] });
    await get(listingsHandler, { species: "파충류" });
    expect(mockClient.product.groupBy.mock.calls[1][0].where.categoryId).toEqual({ in: [1, 2, 3] });
    mockClient.product.groupBy.mockClear();
    const res = await get(listingsHandler, { species: "공룡" });
    expect(res.body.items).toEqual([]);
    expect(mockClient.product.groupBy).not.toHaveBeenCalled();
  });
});

describe("GET /api/rankings/auction-activity", () => {
  it("입찰 2 · 등록 3 · 낙찰 10 으로 사람을 세운다", async () => {
    mockClient.bid.groupBy.mockResolvedValue([{ userId: 1, _count: { _all: 5 } }]);
    mockClient.auction.groupBy.mockImplementation(async ({ by }: any) =>
      by[0] === "winnerId" ? [{ winnerId: 2, _count: { _all: 1 } }] : [{ userId: 2, _count: { _all: 1 } }]
    );
    const res = await get(auctionActivityHandler, { period: "all" });
    expect(res.body.items.map((i: any) => [i.user.id, i.score, i.bidsCount, i.listedCount, i.winsCount])).toEqual([
      [2, 13, 0, 1, 1],
      [1, 10, 5, 0, 0],
    ]);
    // 역대는 이전 기간을 세지 않는다(그룹 쿼리 3번).
    expect(mockClient.bid.groupBy).toHaveBeenCalledTimes(1);
  });
});
