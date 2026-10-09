/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/users/:id — 프로필 v5(앱 docs/prd/profile.md).
 * - _count.completedSales: 남이 보는 판매내역과 같은 기준의 거래 완료 수(신뢰 줄)
 * - 동네 비공개(regionVisible=false)면 본인 말고는 동네를 내려주지 않는다
 */

const mockClient = {
  user: { findUnique: jest.fn() },
  sale: { count: jest.fn() },
  follow: { findFirst: jest.fn() },
  userBlock: { findFirst: jest.fn() },
  userBadge: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
jest.mock("@libs/server/breeder-programs", () => ({
  getSortedActiveBreederProgramSummaries: () => [],
  getActiveBreederProgramsByUserId: () => Promise.resolve([]),
}));
jest.mock("@libs/server/profileSpecies", () => ({ getTopSpecies: () => Promise.resolve([]) }));
jest.mock("@libs/server/bloodline-visibility", () => ({
  countProfileBloodlineCards: () => Promise.resolve(0),
}));

import userDetailHandler from "../pages/api/users/[id]/index";

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
    setHeader() {},
  };
  return res;
}

async function getUser(id: number, viewer?: number) {
  const res = createRes();
  await userDetailHandler(
    {
      method: "GET",
      headers: {},
      query: { id: String(id) },
      body: {},
      user: viewer ? { id: viewer, role: "USER" } : undefined,
    } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const OWNER = 3;
const baseUser = (overrides: Record<string, unknown> = {}) => ({
  id: OWNER,
  name: "브리더",
  email: "breeder@example.com",
  snsId: "sns",
  phone: null,
  avatar: null,
  bio: null,
  createdAt: new Date(Date.UTC(2026, 1, 3)),
  regionSido: "서울특별시",
  regionSigungu: "마포구",
  regionUpdatedAt: new Date(Date.UTC(2026, 9, 1)),
  regionVisible: false,
  _count: {
    followers: 1,
    following: 2,
    products: 4,
    posts: 5,
    Comments: 0,
    insectRecords: 0,
    receivedReviews: 0,
    createdBloodlineCards: 0,
    auctions: 1,
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.user.findUnique.mockResolvedValue(baseUser());
  mockClient.sale.count.mockResolvedValue(12);
  mockClient.follow.findFirst.mockResolvedValue(null);
  mockClient.userBlock.findFirst.mockResolvedValue(null);
  mockClient.userBadge.findMany.mockResolvedValue([]);
});

describe("GET /api/users/:id 거래 완료 수", () => {
  it("판매자가 완료한 거래 중 지우거나 숨기지 않은 상품만 센다", async () => {
    const res = await getUser(OWNER);
    expect(mockClient.sale.count).toHaveBeenCalledWith({
      where: {
        userId: OWNER,
        status: "completed",
        product: { isDeleted: false, isHidden: false, status: "판매완료" },
      },
    });
    expect(res.body.user._count.completedSales).toBe(12);
    expect(res.body.user.createdAt).toEqual(baseUser().createdAt);
  });
});

describe("GET /api/users/:id 동네 공개 범위", () => {
  it("동네를 공개하지 않았으면 다른 사람·비로그인에게 동네를 비운다", async () => {
    for (const viewer of [undefined, 9]) {
      const res = await getUser(OWNER, viewer);
      expect(res.body.user).toMatchObject({
        regionSido: null,
        regionSigungu: null,
        regionUpdatedAt: null,
        regionVisible: false,
      });
    }
  });

  it("본인에게는 비공개여도 동네를 준다", async () => {
    const res = await getUser(OWNER, OWNER);
    expect(res.body.user).toMatchObject({ regionSido: "서울특별시", regionSigungu: "마포구" });
  });

  it("동네를 공개했으면 다른 사람에게도 준다", async () => {
    mockClient.user.findUnique.mockResolvedValue(baseUser({ regionVisible: true }));
    const res = await getUser(OWNER, 9);
    expect(res.body.user).toMatchObject({ regionSido: "서울특별시", regionSigungu: "마포구" });
  });
});
