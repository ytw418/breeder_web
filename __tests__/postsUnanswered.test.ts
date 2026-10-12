/**
 * @jest-environment node
 */
/**
 * GET /api/posts?unanswered=1 (AC-6): 7일 안 보이는 댓글 없는 질문 중 가장 오래된 것 + 전체 수.
 * GET /api/posts?scope=neighborhood: 내 동네 50km 범위 글(로그인 필요, 동네 없으면 빈 목록).
 */
import type { NextApiRequest, NextApiResponse } from "next";

const NOW = new Date("2026-10-12T12:00:00.000Z");
const mockClient = {
  category: { findMany: jest.fn(async () => []) },
  userBlock: { findMany: jest.fn(async () => []) },
  user: { findUnique: jest.fn() },
  post: { findMany: jest.fn(), count: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
jest.mock("@libs/server/notification", () => ({ notifyFollowers: jest.fn() }));
jest.mock("@libs/server/growth", () => ({ incrementUserMissionProgress: jest.fn() }));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: (rows: unknown[]) => rows,
}));

import postsHandler from "../pages/api/posts/index";

const row = (id: number) => ({
  id,
  title: `질문 ${id}`,
  description: "",
  image: "",
  images: [],
  category: "질문",
  createdAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
  _count: { comments: 0, Likes: 0 },
  comments: [],
  user: { id: 3, name: "질문자", avatar: null, breederPrograms: [] },
});

async function get(query: Record<string, string>, user?: { id: number }) {
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
      res.headers[name.toLowerCase()] = value;
    },
  };
  await postsHandler(
    { method: "GET", headers: {}, query, body: {}, cookies: {}, user } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  mockClient.post.findMany.mockResolvedValue([]);
  mockClient.post.count.mockResolvedValue(0);
});
afterEach(() => jest.useRealTimers());

describe("GET /api/posts?unanswered=1", () => {
  it("가장 오래 답 없는 질문 1개 + unansweredCount", async () => {
    mockClient.post.findMany.mockResolvedValue([row(5)]);
    mockClient.post.count.mockResolvedValue(4);
    const res = await get({ unanswered: "1", limit: "1" });
    expect(res.body).toMatchObject({ success: true, unansweredCount: 4 });
    expect(res.body.posts.map((p: any) => p.id)).toEqual([5]);
    const args = mockClient.post.findMany.mock.calls[0][0];
    expect(args.take).toBe(1);
    expect(args.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(args.where).toMatchObject({
      category: "질문",
      isHidden: false,
      comments: { none: { isHidden: false, deletedAt: null } },
    });
    expect(args.where.createdAt.gte.getTime()).toBe(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    // 목록과 개수는 같은 조건
    expect(mockClient.post.count.mock.calls[0][0].where).toEqual(args.where);
  });

  it("없으면 빈 목록·0 (화면은 카드를 그리지 않는다)", async () => {
    const res = await get({ unanswered: "1" });
    expect(res.body).toEqual({ success: true, posts: [], pages: 1, unansweredCount: 0 });
  });

  it("차단한 작성자의 질문은 뺀다", async () => {
    mockClient.userBlock.findMany.mockResolvedValueOnce([{ blockerId: 7, blockedId: 3 }]);
    await get({ unanswered: "1" }, { id: 7 });
    expect(mockClient.post.findMany.mock.calls[0][0].where.userId).toEqual({ notIn: [3] });
  });

  it("limit 은 최대 10", async () => {
    await get({ unanswered: "1", limit: "99" });
    expect(mockClient.post.findMany.mock.calls[0][0].take).toBe(10);
  });
});

describe("GET /api/posts?scope=neighborhood", () => {
  it("비로그인은 401", async () => {
    const res = await get({ scope: "neighborhood" });
    expect(res.statusCode).toBe(401);
  });

  it("동네가 없으면 빈 목록", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: null, regionSigungu: null });
    const res = await get({ scope: "neighborhood" }, { id: 7 });
    expect(res.body).toEqual({ success: true, posts: [], pages: 0 });
    expect(mockClient.post.findMany).not.toHaveBeenCalled();
  });

  it("보은군이면 청주시·대전 글까지(50km), regionSido/regionSigungu 파라미터는 무시", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "충청북도", regionSigungu: "보은군" });
    await get({ scope: "neighborhood", category: "동네", regionSido: "서울특별시", regionSigungu: "강남구" }, { id: 7 });
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where.category).toBe("동네");
    expect(where.regionSido).toBeUndefined();
    const chungbuk = where.OR.find((c: any) => c.regionSido === "충청북도");
    const daejeon = where.OR.find((c: any) => c.regionSido === "대전광역시");
    expect(chungbuk.regionSigungu.in).toEqual(expect.arrayContaining(["보은군", "청주시"]));
    expect(daejeon.regionSigungu.in.length).toBeGreaterThan(0);
    expect(where.OR.find((c: any) => c.regionSido === "서울특별시")).toBeUndefined();
  });
});
