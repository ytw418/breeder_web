/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/posts?following=1 — 반려생활 '팔로잉' 칩(앱 docs/prd/profile.md v5 S-11).
 * 내가 팔로우한 사람의 글만, 비로그인은 401(공개 캐시 금지), 차단한 사람은 빠진다.
 */

const mockClient = {
  category: { findMany: jest.fn(async () => []) },
  post: { findMany: jest.fn(), count: jest.fn() },
  userBlock: { findMany: jest.fn() },
  follow: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
jest.mock("@libs/server/notification", () => ({ notifyFollowers: jest.fn() }));
jest.mock("@libs/server/growth", () => ({ incrementUserMissionProgress: jest.fn() }));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: (programs: unknown[]) => programs,
}));

import postsHandler from "../pages/api/posts/index";

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
      res.headers[name.toLowerCase()] = value;
    },
  };
  return res;
}

async function getPosts(query: Record<string, string>, user?: { id: number }) {
  const res = createRes();
  await postsHandler(
    { method: "GET", headers: {}, query, body: {}, cookies: {}, user } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const ME = 7;

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.userBlock.findMany.mockResolvedValue([]);
  mockClient.follow.findMany.mockResolvedValue([{ followingId: 2 }, { followingId: 3 }]);
  mockClient.post.findMany.mockResolvedValue([]);
  mockClient.post.count.mockResolvedValue(0);
});

describe("GET /api/posts?following=1", () => {
  it("비로그인이면 401 LOGIN_REQUIRED 이고 공개 캐시 헤더를 남기지 않는다", async () => {
    const res = await getPosts({ following: "1" });
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ success: false, errorCode: "LOGIN_REQUIRED" });
    expect(res.headers["cache-control"]).toBe("private, no-store, max-age=0");
    expect(mockClient.post.findMany).not.toHaveBeenCalled();
  });

  it("내가 팔로우한 사람의 글만 찾고 followingCount 를 준다", async () => {
    const res = await getPosts({ following: "1" }, { id: ME });
    expect(mockClient.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { followerId: ME } })
    );
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where.userId).toEqual({ in: [2, 3] });
    expect(res.body).toMatchObject({ success: true, followingCount: 2 });
    expect(res.headers["cache-control"]).toBe("private, no-store, max-age=0");
  });

  it("차단한 사람은 팔로우해 둬도 뺀다", async () => {
    mockClient.userBlock.findMany.mockResolvedValue([{ blockerId: ME, blockedId: 3 }]);
    await getPosts({ following: "1" }, { id: ME });
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where.userId).toEqual({ in: [2] });
  });

  it("카테고리·동네 조건은 무시하고 종은 그대로 건다", async () => {
    await getPosts(
      { following: "1", category: "자유", regionSido: "서울특별시", species: "곤충" },
      { id: ME }
    );
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where.category).toBeUndefined();
    expect(where.regionSido).toBeUndefined();
    expect(where.NOT).toEqual({ category: "공지" });
    expect(where.isHidden).toBe(false);
    expect(where.type ?? where.AND).toBeDefined();
  });

  it("아무도 팔로우하지 않으면 글을 찾지 않고 빈 목록을 준다", async () => {
    mockClient.follow.findMany.mockResolvedValue([]);
    const res = await getPosts({ following: "1" }, { id: ME });
    expect(mockClient.post.findMany).not.toHaveBeenCalled();
    expect(res.body).toEqual({ success: true, posts: [], pages: 0, followingCount: 0 });
  });

  it("following 이 없으면 기존 목록 그대로(팔로우 조회 없음)", async () => {
    await getPosts({ category: "자유" }, { id: ME });
    expect(mockClient.follow.findMany).not.toHaveBeenCalled();
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where.category).toBe("자유");
  });
});
