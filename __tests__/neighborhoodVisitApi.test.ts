/**
 * @jest-environment node
 */
/**
 * POST /api/neighborhood/visit(하루 1행 upsert) · GET /api/neighborhood/visitors(7일, 50km 범위, 나 제외).
 */
import type { NextApiRequest, NextApiResponse } from "next";

const NOW = new Date("2026-10-12T16:30:00.000Z"); // KST 10-13 01:30
const mockClient = {
  user: { findUnique: jest.fn() },
  regionVisit: { upsert: jest.fn(), findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: (rows: unknown[]) => rows,
}));

import visitHandler from "../pages/api/neighborhood/visit";
import visitorsHandler from "../pages/api/neighborhood/visitors";
import { kstDate } from "@libs/server/regionVisit";

async function call(handler: any, method: string, user?: { id: number }) {
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
  await handler({ method, headers: {}, query: {}, body: {}, user } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  mockClient.user.findUnique.mockResolvedValue({ regionSido: "충청북도", regionSigungu: "보은군" });
  mockClient.regionVisit.findMany.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
});
afterEach(() => jest.useRealTimers());

describe("kstDate", () => {
  it("KST 날짜(UTC 자정)", () => {
    expect(kstDate(NOW).toISOString()).toBe("2026-10-13T00:00:00.000Z");
    expect(kstDate(NOW, 6).toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });
});

describe("POST /api/neighborhood/visit", () => {
  it("비로그인은 401", async () => {
    expect((await call(visitHandler, "POST")).statusCode).toBe(401);
  });

  it("오늘(KST) 1행 upsert, 동네 이름만 남긴다", async () => {
    const res = await call(visitHandler, "POST", { id: 7 });
    expect(res.body).toEqual({ success: true, recorded: true });
    expect(mockClient.regionVisit.upsert).toHaveBeenCalledWith({
      where: { userId_day: { userId: 7, day: new Date("2026-10-13T00:00:00.000Z") } },
      update: { regionSido: "충청북도", regionSigungu: "보은군" },
      create: { userId: 7, day: new Date("2026-10-13T00:00:00.000Z"), regionSido: "충청북도", regionSigungu: "보은군" },
    });
  });

  it("동네가 없으면 기록하지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: null, regionSigungu: null });
    const res = await call(visitHandler, "POST", { id: 7 });
    expect(res.body).toEqual({ success: true, recorded: false });
    expect(mockClient.regionVisit.upsert).not.toHaveBeenCalled();
  });

  it("GET 은 405", async () => {
    expect((await call(visitHandler, "GET", { id: 7 })).statusCode).toBe(405);
  });
});

describe("GET /api/neighborhood/visitors", () => {
  it("최근 7일(오늘 포함) 50km 범위의 서로 다른 사용자 수, 나는 뺀다", async () => {
    const res = await call(visitorsHandler, "GET", { id: 7 });
    expect(res.body).toEqual({ success: true, count: 2 });
    const args = mockClient.regionVisit.findMany.mock.calls[0][0];
    expect(args.distinct).toEqual(["userId"]);
    expect(args.where.userId).toEqual({ not: 7 });
    expect(args.where.day.gte.toISOString()).toBe("2026-10-07T00:00:00.000Z");
    const daejeon = args.where.OR.find((c: any) => c.regionSido === "대전광역시");
    expect(daejeon).toBeDefined();
  });

  it("동네가 없으면 0", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: null, regionSigungu: null });
    const res = await call(visitorsHandler, "GET", { id: 7 });
    expect(res.body).toEqual({ success: true, count: 0 });
    expect(mockClient.regionVisit.findMany).not.toHaveBeenCalled();
  });

  it("비로그인은 401", async () => {
    expect((await call(visitorsHandler, "GET")).statusCode).toBe(401);
  });
});
