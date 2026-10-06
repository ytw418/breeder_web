/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/posts 목록 — 정렬·페이지 나눔을 DB 쿼리에서 처리한다.
 * 전체 게시글을 메모리로 읽어 정렬·slice 하지 않고, 한 페이지(10개)만 가져온다.
 * 응답 형태({ success, posts, pages })·필터·정렬 기준은 그대로 둔다.
 */

const mockClient = {
  post: { findMany: jest.fn(), count: jest.fn() },
  userBlock: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/notification", () => ({
  notifyFollowers: jest.fn(),
}));
jest.mock("@libs/server/growth", () => ({
  incrementUserMissionProgress: jest.fn(),
}));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: (programs: Array<{ programType: string }>) =>
    [...programs].sort((a, b) => a.programType.localeCompare(b.programType)),
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

const makePost = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `글 ${id}`,
  description: "본문",
  category: "자유",
  type: null,
  image: "",
  images: [],
  createdAt: new Date(2026, 9, 1, 0, id),
  updatedAt: new Date(2026, 9, 1, 0, id),
  userId: 1,
  latitude: null,
  longitude: null,
  user: { id: 1, name: "작성자", avatar: null, breederPrograms: [] },
  _count: { comments: 0, Likes: 0 },
  ...overrides,
});

const findManyArgs = () => mockClient.post.findMany.mock.calls[0][0];

const TIE_BREAK = [{ createdAt: "desc" }, { id: "desc" }];

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.post.findMany.mockResolvedValue([]);
  mockClient.post.count.mockResolvedValue(0);
  mockClient.userBlock.findMany.mockResolvedValue([]);
});

describe("GET /api/posts 정렬·페이지를 DB 에서 처리", () => {
  it("최신순은 한 페이지(10개)만 DB 에서 가져온다", async () => {
    await getPosts({ page: "3" });

    expect(mockClient.post.findMany).toHaveBeenCalledTimes(1);
    expect(findManyArgs()).toMatchObject({
      skip: 20,
      take: 10,
      orderBy: TIE_BREAK,
    });
  });

  it("인기순은 좋아요 수 → 최신 → id 순으로 DB 가 정렬한다", async () => {
    await getPosts({ page: "2", sort: "popular" });

    expect(findManyArgs()).toMatchObject({
      skip: 10,
      take: 10,
      orderBy: [{ Likes: { _count: "desc" } }, ...TIE_BREAK],
    });
  });

  it("댓글순은 댓글 수 → 최신 → id 순으로 DB 가 정렬한다", async () => {
    await getPosts({ sort: "comments" });

    expect(findManyArgs()).toMatchObject({
      skip: 0,
      take: 10,
      orderBy: [{ comments: { _count: "desc" } }, ...TIE_BREAK],
    });
  });

  it("알 수 없는 정렬은 최신순으로 처리한다", async () => {
    await getPosts({ sort: "random" });

    expect(findManyArgs().orderBy).toEqual(TIE_BREAK);
  });

  it.each([["abc"], ["0"], ["-2"], ["1.5"], ["1e30"]])(
    "잘못된 page(%s)는 1페이지로 처리한다",
    async (page) => {
      await getPosts({ page });

      expect(findManyArgs()).toMatchObject({ skip: 0, take: 10 });
    }
  );

  it("DB 가 돌려준 한 페이지를 메모리에서 다시 자르지 않고 그대로 응답한다", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makePost(20 - i, i === 0 ? { image: "cover", images: [] } : {})
    );
    mockClient.post.findMany.mockResolvedValue(rows);
    mockClient.post.count.mockResolvedValue(25);

    const res = await getPosts({ page: "2" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pages).toBe(3);
    expect(res.body.posts.map((p: { id: number }) => p.id)).toEqual(rows.map((r) => r.id));
    // 대표 이미지만 있는 예전 글은 images 로 펼쳐 준다(기존 응답 그대로).
    expect(res.body.posts[0].images).toEqual(["cover"]);
    expect(Object.keys(res.body).sort()).toEqual(["pages", "posts", "success"]);
  });

  it("작성자 브리더 프로그램 뱃지는 정렬해서 내려준다(기존 그대로)", async () => {
    mockClient.post.findMany.mockResolvedValue([
      makePost(1, {
        user: {
          id: 1,
          name: "작성자",
          avatar: null,
          breederPrograms: [{ programType: "PARTNER" }, { programType: "FOUNDING" }],
        },
      }),
    ]);
    mockClient.post.count.mockResolvedValue(1);

    const res = await getPosts({});

    expect(res.body.posts[0].user.breederPrograms).toEqual([
      { programType: "FOUNDING" },
      { programType: "PARTNER" },
    ]);
  });

  it("카테고리·종·차단 필터는 목록과 count 에 같은 where 로 들어간다", async () => {
    mockClient.userBlock.findMany.mockResolvedValue([{ blockedId: 9 }]);

    await getPosts({ category: "질문", species: "곤충", sort: "popular" }, { id: 7 });

    const where = findManyArgs().where;
    expect(where.category).toBe("질문");
    expect(where.type).toEqual({ in: expect.arrayContaining(["곤충"]) });
    expect(where.userId).toEqual({ notIn: [9] });
    expect(mockClient.post.count.mock.calls[0][0].where).toEqual(where);
  });

  it("기본 피드는 공지를 빼고, 공지 카테고리를 고르면 공지만 본다", async () => {
    await getPosts({});
    expect(findManyArgs().where).toEqual({ NOT: { category: "공지" }, isHidden: false });

    mockClient.post.findMany.mockClear();
    await getPosts({ category: "공지" });
    expect(findManyArgs().where).toEqual({ category: "공지", isHidden: false });
  });
});
