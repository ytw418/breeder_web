/**
 * @jest-environment node
 */
/**
 * 실시간 TOP 토론(AC-19): 최근 24시간 활동 점수(댓글 3·좋아요 1, 반감기 6시간)순, 마지막 활동 시각·종류를 싣는다.
 * 24시간 안 활동 글이 3개 미만이면 7일로 넓히고, 모자라면 7일 안 새 글(kind post)로 채운다.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-12T12:00:00.000Z");
const ago = (h: number) => new Date(NOW.getTime() - h * HOUR);

let comments: { postId: number; createdAt: Date }[] = [];
let likes: { postId: number; createdAt: Date }[] = [];
let freshPosts: { id: number; createdAt: Date }[] = [];

const since = (where: any) => where.createdAt.gte.getTime();
const mockClient = {
  category: { findMany: jest.fn(async () => []) },
  userBlock: { findMany: jest.fn(async () => []) },
  comment: { findMany: jest.fn(async ({ where }: any) => comments.filter((c) => c.createdAt.getTime() >= since(where))) },
  like: { findMany: jest.fn(async ({ where }: any) => likes.filter((l) => l.createdAt.getTime() >= since(where))) },
  // 찬반 토론 투표도 활동 점수에 들어간다(투표 1점). 이 테스트는 토론이 없다.
  debateVote: { findMany: jest.fn(async () => []) },
  post: {
    findMany: jest.fn(async ({ where, take }: any) => {
      if (where.id?.in) {
        return where.id.in.map((id: number) => ({
          id,
          title: `글 ${id}`,
          description: "본문",
          image: "",
          images: [],
          category: "자유",
          createdAt: ago(30),
          _count: { comments: 1, Likes: 0 },
          comments: [],
          user: { id: 1, name: "작성자", avatar: null, breederPrograms: [] },
        }));
      }
      const notIn: number[] = where.id?.notIn ?? [];
      return freshPosts.filter((p) => !notIn.includes(p.id)).slice(0, take);
    }),
    count: jest.fn(),
  },
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
import { rankHotActivity } from "@libs/server/hotRealtime";

async function getHot(query: Record<string, string> = { hot: "realtime" }) {
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
    { method: "GET", headers: {}, query, body: {}, cookies: {} } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  comments = [];
  likes = [];
  freshPosts = [];
});
afterEach(() => jest.useRealTimers());

describe("rankHotActivity", () => {
  it("댓글 3·좋아요 1, 반감기 6시간 감쇠", () => {
    const ranked = rankHotActivity(
      [
        { postId: 1, at: NOW, kind: "comment" }, // 3
        { postId: 2, at: ago(6), kind: "comment" }, // 1.5
        { postId: 2, at: ago(6), kind: "like" }, // 0.5
        { postId: 3, at: NOW, kind: "like" }, // 1
      ],
      NOW
    );
    expect(ranked.map((r) => [r.postId, r.hotScore])).toEqual([
      [1, 3],
      [2, 2],
      [3, 1],
    ]);
  });

  it("방금 활동 2개가 하루 전 활동 여러 개보다 앞선다", () => {
    const old = Array.from({ length: 6 }, () => ({ postId: 9, at: ago(23), kind: "comment" as const }));
    const ranked = rankHotActivity([...old, { postId: 1, at: ago(0.1), kind: "comment" }], NOW);
    expect(ranked[0].postId).toBe(1);
  });

  it("마지막 활동은 가장 최근 이벤트의 시각·종류", () => {
    const [item] = rankHotActivity(
      [
        { postId: 1, at: ago(3), kind: "comment" },
        { postId: 1, at: ago(1), kind: "like" },
      ],
      NOW
    );
    expect(item).toMatchObject({ lastActivityAt: ago(1).toISOString(), lastActivityKind: "like" });
  });
});

describe("GET /api/posts?hot=realtime", () => {
  it("24시간 활동 점수순 3개 + 메타(lastActivityAt·lastActivityKind·hotScore)", async () => {
    comments = [
      { postId: 1, createdAt: ago(0.05) },
      { postId: 2, createdAt: ago(10) },
      { postId: 2, createdAt: ago(10) },
      { postId: 3, createdAt: ago(20) },
      { postId: 4, createdAt: ago(23) },
    ];
    likes = [{ postId: 3, createdAt: ago(1) }];
    const res = await getHot({ hot: "realtime", limit: "3" });
    expect(res.body.posts.map((p: any) => p.id)).toEqual([1, 2, 3]);
    expect(res.body.posts[0]).toMatchObject({
      lastActivityAt: ago(0.05).toISOString(),
      lastActivityKind: "comment",
      title: "글 1",
    });
    expect(res.body.posts[2].lastActivityKind).toBe("like");
    expect(typeof res.body.posts[0].hotScore).toBe("number");
    // 24시간 안에 3개 이상이면 넓히지 않는다
    expect(mockClient.comment.findMany).toHaveBeenCalledTimes(1);
    expect(since(mockClient.comment.findMany.mock.calls[0][0].where)).toBe(ago(24).getTime());
  });

  it("24시간 안 3개 미만이면 7일로 넓힌다", async () => {
    comments = [
      { postId: 1, createdAt: ago(1) },
      { postId: 2, createdAt: ago(48) },
      { postId: 3, createdAt: ago(100) },
    ];
    const res = await getHot();
    expect(mockClient.comment.findMany).toHaveBeenCalledTimes(2);
    expect(since(mockClient.comment.findMany.mock.calls[1][0].where)).toBe(ago(24 * 7).getTime());
    expect(res.body.posts.map((p: any) => p.id)).toEqual([1, 2, 3]);
  });

  it("그래도 모자라면 7일 안 새 글(kind post, 점수 0)로 채운다", async () => {
    comments = [{ postId: 1, createdAt: ago(1) }];
    freshPosts = [
      { id: 1, createdAt: ago(2) },
      { id: 7, createdAt: ago(5) },
      { id: 8, createdAt: ago(9) },
    ];
    const res = await getHot();
    expect(res.body.posts.map((p: any) => [p.id, p.lastActivityKind])).toEqual([
      [1, "comment"],
      [7, "post"],
      [8, "post"],
    ]);
    expect(res.body.posts[1].hotScore).toBe(0);
  });

  it("아무것도 없으면 빈 목록", async () => {
    const res = await getHot();
    expect(res.body).toEqual({ success: true, posts: [], pages: 0 });
  });
});

describe("GET /api/posts?hot=weekly (홈 인기글 TOP 10)", () => {
  it("7일 활동 점수순으로 최대 10개, 공지만 빼고 모든 카테고리를 본다", async () => {
    comments = Array.from({ length: 12 }, (_, i) => ({ postId: i + 1, createdAt: ago(24 * 3 + i) }));
    const res = await getHot({ hot: "weekly" });
    expect(res.body.posts).toHaveLength(10);
    expect(res.body.posts[0].id).toBe(1);
    // 7일 한 번만 보고(24시간부터 넓히지 않는다), 카테고리는 공지만 뺀다
    expect(mockClient.comment.findMany).toHaveBeenCalledTimes(1);
    const where = mockClient.comment.findMany.mock.calls[0][0].where;
    expect(since(where)).toBe(ago(24 * 7).getTime());
    expect(where.post.category).toEqual({ not: "공지" });
    expect(res.headers["cache-control"]).toContain("s-maxage=120");
  });

  it("반감기 3일: 3일 전 댓글 2개가 방금 좋아요 1개보다 앞선다", async () => {
    comments = [
      { postId: 1, createdAt: ago(72) },
      { postId: 1, createdAt: ago(72) },
    ];
    likes = [{ postId: 2, createdAt: ago(0.1) }];
    const res = await getHot({ hot: "weekly" });
    expect(res.body.posts.map((p: any) => p.id).slice(0, 2)).toEqual([1, 2]);
  });

  it("모자라면 7일 안 새 글로 채운다", async () => {
    comments = [{ postId: 1, createdAt: ago(1) }];
    freshPosts = [
      { id: 5, createdAt: ago(2) },
      { id: 6, createdAt: ago(30) },
    ];
    const res = await getHot({ hot: "weekly" });
    expect(res.body.posts.map((p: any) => p.id)).toEqual([1, 5, 6]);
  });
});
