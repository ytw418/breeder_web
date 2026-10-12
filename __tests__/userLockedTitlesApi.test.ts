/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/users/:id lockedTitles(AC-4): 본인 조회일 때만 아직 못 단 칭호(남은 양 적은 순 3개).
 */

const mockClient = {
  user: { findUnique: jest.fn() },
  sale: { count: jest.fn() },
  follow: { findFirst: jest.fn(), count: jest.fn() },
  userBlock: { findFirst: jest.fn() },
  userBadge: { findMany: jest.fn() },
  post: { findMany: jest.fn() },
  product: { count: jest.fn() },
  comment: { count: jest.fn() },
  bid: { count: jest.fn() },
  auction: { count: jest.fn() },
  bloodlineCard: { count: jest.fn() },
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
  mockClient.sale.count.mockResolvedValue(0);
  mockClient.follow.findFirst.mockResolvedValue(null);
  mockClient.follow.count.mockResolvedValue(9); // 팔로워 9 → 팔로워 부자까지 1
  mockClient.userBlock.findFirst.mockResolvedValue(null);
  mockClient.userBadge.findMany.mockResolvedValue([]);
  // 게시글 2개(사진 3장, 좋아요 4) → 기록왕까지 1, 사진 맛집까지 2
  mockClient.post.findMany.mockResolvedValue([
    { image: "a", images: ["a", "b"], _count: { Likes: 3 } },
    { image: "c", images: [], _count: { Likes: 1 } },
  ]);
  mockClient.product.count.mockResolvedValue(3); // 분양왕 달성
  mockClient.comment.count.mockResolvedValue(0);
  mockClient.bid.count.mockResolvedValue(0);
  mockClient.auction.count.mockResolvedValue(0);
  mockClient.bloodlineCard.count.mockResolvedValue(0);
});

describe("GET /api/users/:id lockedTitles", () => {
  it("본인에게는 남은 양 적은 순 3개", async () => {
    const res = await getUser(OWNER, OWNER);
    expect(res.body.user.lockedTitles).toEqual([
      { key: "follower", label: "팔로워 부자", remaining: { kind: "follower", count: 1 } },
      { key: "post", label: "기록왕", remaining: { kind: "post", count: 1 } },
      { key: "photo", label: "사진 맛집", remaining: { kind: "photo", count: 2 } },
    ]);
    expect(mockClient.bloodlineCard.count.mock.calls[0][0].where).toEqual({
      creatorId: OWNER,
      cardType: "BLOODLINE",
      status: "ACTIVE",
    });
  });

  it("타인·비로그인에게는 없다(조회도 하지 않는다)", async () => {
    for (const viewer of [undefined, 9]) {
      const res = await getUser(OWNER, viewer);
      expect(res.body.user).not.toHaveProperty("lockedTitles");
    }
    expect(mockClient.post.findMany).not.toHaveBeenCalled();
  });

  it("집계가 실패해도 프로필은 내려가고 잠금 칭호는 빈 목록", async () => {
    mockClient.bid.count.mockRejectedValueOnce(new Error("db"));
    jest.spyOn(console, "error").mockImplementationOnce(() => undefined);
    const res = await getUser(OWNER, OWNER);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.lockedTitles).toEqual([]);
  });
});
