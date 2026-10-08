import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 팔로워·팔로잉 목록 API — 앱 docs/prd/profile.md AC-3~AC-5.
 * schema 의 관계 이름이 의미와 반대라(User.followers = 이 유저가 followerId) 방향을 여기서 고정한다.
 */

const mockClient = {
  user: { findUnique: jest.fn() },
  follow: { findMany: jest.fn(), count: jest.fn() },
  userBlock: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));

import followersHandler from "../pages/api/users/[id]/followers";
import followingHandler from "../pages/api/users/[id]/following";

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
    setHeader(key: string, value: string) {
      res.headers[key] = value;
    },
  };
  return res;
}

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: Partial<NextApiRequest>
) {
  const res = createRes();
  await handler(
    { method: "GET", headers: {}, query: {}, body: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const TARGET = 10;
const VIEWER = 7;
const asUser = (id: number) => ({ id, name: "u" }) as NextApiRequest["user"];
const person = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `u${id}`,
  avatar: null,
  bio: null,
  _count: { posts: id },
  ...extra,
});
const at = (d: number) => new Date(Date.UTC(2026, 9, d));

/** 목록 조회(첫 findMany)와 viewer 팔로우 확인(두 번째 findMany)을 나눠 돌려준다. */
function mockRows(rows: unknown[], viewerFollows: number[] = []) {
  mockClient.follow.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    if ("followingId" in args.where && typeof args.where.followingId === "object") {
      return viewerFollows.map((followingId) => ({ followingId }));
    }
    return rows;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.user.findUnique.mockResolvedValue({ id: TARGET });
  mockClient.userBlock.findMany.mockResolvedValue([]);
  mockClient.follow.count.mockResolvedValue(0);
  mockRows([]);
});

const listArgs = () => mockClient.follow.findMany.mock.calls[0][0];

describe("GET /api/users/:id/followers", () => {
  it("followingId = id 인 행의 follower 를 최근 팔로우 순으로 준다", async () => {
    mockRows([
      { id: 2, createdAt: at(5), follower: person(3, { bio: "소개" }) },
      { id: 1, createdAt: at(1), follower: person(4) },
    ]);
    mockClient.follow.count.mockResolvedValue(2);
    const res = await call(followersHandler, { query: { id: String(TARGET) } });

    expect(res.statusCode).toBe(200);
    const args = listArgs();
    expect(args.where).toEqual({ followingId: TARGET, follower: { status: { not: "DELETED" } } });
    expect(args.select.follower).toBeDefined();
    expect(args.select.following).toBeUndefined();
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
    expect(res.body).toEqual({
      success: true,
      users: [
        { id: 3, name: "u3", avatar: null, bio: "소개", postsCount: 3, isFollowing: false, followedAt: at(5).toISOString() },
        { id: 4, name: "u4", avatar: null, bio: null, postsCount: 4, isFollowing: false, followedAt: at(1).toISOString() },
      ],
      pages: 1,
      total: 2,
    });
  });

  it("사용자 필드는 공개 정보만 select 한다(이메일·전화 없음)", async () => {
    await call(followersHandler, { query: { id: String(TARGET) } });
    expect(Object.keys(listArgs().select.follower.select).sort()).toEqual(
      ["_count", "avatar", "bio", "id", "name"].sort()
    );
  });

  it("로그인 viewer 가 차단한 사람은 빼고(단방향), 행마다 isFollowing 을 채운다", async () => {
    mockClient.userBlock.findMany.mockResolvedValue([{ blockedId: 99 }]);
    mockRows(
      [
        { id: 2, createdAt: at(5), follower: person(3) },
        { id: 1, createdAt: at(1), follower: person(4) },
      ],
      [4]
    );
    const res = await call(followersHandler, { query: { id: String(TARGET) }, user: asUser(VIEWER) });

    expect(mockClient.userBlock.findMany.mock.calls[0][0].where).toEqual({ blockerId: VIEWER });
    expect(listArgs().where.follower).toEqual({ status: { not: "DELETED" }, id: { notIn: [99] } });
    const viewerQuery = mockClient.follow.findMany.mock.calls[1][0];
    expect(viewerQuery.where).toEqual({ followerId: VIEWER, followingId: { in: [3, 4] } });
    expect(res.body.users.map((u: { isFollowing: boolean }) => u.isFollowing)).toEqual([false, true]);
    expect(res.headers["Cache-Control"]).toContain("private");
  });

  it("비로그인은 차단 필터 없이 상태 필터만, 캐시는 Vary: Authorization", async () => {
    const res = await call(followersHandler, { query: { id: String(TARGET) } });
    expect(mockClient.userBlock.findMany).not.toHaveBeenCalled();
    expect(res.headers.Vary).toBe("Authorization");
    expect(res.headers["Cache-Control"]).toBeUndefined();
  });

  it("같은 사람의 중복 팔로우 행은 한 번만 준다", async () => {
    mockRows([
      { id: 3, createdAt: at(5), follower: person(3) },
      { id: 2, createdAt: at(4), follower: person(3) },
    ]);
    const res = await call(followersHandler, { query: { id: String(TARGET) } });
    expect(res.body.users).toHaveLength(1);
  });

  it("page·size 로 나누고 size 는 50 까지", async () => {
    mockClient.follow.count.mockResolvedValue(120);
    const res = await call(followersHandler, { query: { id: String(TARGET), page: "3", size: "500" } });
    expect(listArgs().take).toBe(50);
    expect(listArgs().skip).toBe(100);
    expect(res.body.pages).toBe(3);
    expect(res.body.total).toBe(120);
  });

  it("없는 사용자·숫자가 아닌 id 는 404", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    expect((await call(followersHandler, { query: { id: "12345" } })).statusCode).toBe(404);
    expect((await call(followersHandler, { query: { id: "abc" } })).statusCode).toBe(404);
  });
});

describe("GET /api/users/:id/following", () => {
  it("followerId = id 인 행의 following 을 준다(팔로워와 방향이 반대)", async () => {
    mockRows([{ id: 1, createdAt: at(2), following: person(5) }]);
    mockClient.follow.count.mockResolvedValue(1);
    const res = await call(followingHandler, { query: { id: String(TARGET) } });

    const args = listArgs();
    expect(args.where).toEqual({ followerId: TARGET, following: { status: { not: "DELETED" } } });
    expect(args.select.following).toBeDefined();
    expect(args.select.follower).toBeUndefined();
    expect(res.body.users.map((u: { id: number }) => u.id)).toEqual([5]);
    expect(res.body.total).toBe(1);
  });

  it("POST 는 405", async () => {
    const res = await call(followingHandler, { method: "POST", query: { id: String(TARGET) } });
    expect(res.statusCode).toBe(405);
  });
});
