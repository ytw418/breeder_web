/**
 * @jest-environment node
 */
/**
 * GET /api/posts?unanswered=1 (AC-6): 7일 안 질문 중 질문자가 아닌 사람의 보이는 댓글이 없는 것, 오래된 순 + 전체 수.
 * GET /api/posts?scope=neighborhood: 내 동네 50km 범위 글(로그인 필요, 동네 없으면 빈 목록).
 */
import type { NextApiRequest, NextApiResponse } from "next";

const NOW = new Date("2026-10-12T12:00:00.000Z");
const mockClient = {
  category: { findMany: jest.fn(async () => []) },
  userBlock: { findMany: jest.fn(async (): Promise<any[]> => []) },
  user: { findUnique: jest.fn() },
  post: { findMany: jest.fn(), count: jest.fn() },
  comment: { groupBy: jest.fn(async (_args?: any): Promise<any[]> => []) },
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
  mockClient.comment.groupBy.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());

describe("GET /api/posts?unanswered=1", () => {
  // 후보 질문(id·작성자) → (글, 댓글 작성자) 묶음 → 페이지 행. 행 조회는 id 목록으로 한다.
  const candidates = (ids: number[], authorId = 3) => ids.map((id) => ({ id, userId: authorId }));
  const mockRows = () =>
    mockClient.post.findMany.mockImplementation(async (args: any) =>
      args.select ? candidatesNow : args.where.id.in.map((id: number) => row(id))
    );
  let candidatesNow: { id: number; userId: number }[] = [];

  beforeEach(() => {
    candidatesNow = [];
    mockRows();
  });

  it("가장 오래 답 없는 질문 1개 + unansweredCount(후보는 7일 안 질문, 오래된 순)", async () => {
    candidatesNow = candidates([5, 6, 7, 8]);
    const res = await get({ unanswered: "1", limit: "1" });
    expect(res.body).toMatchObject({ success: true, unansweredCount: 4, pages: 4 });
    expect(res.body.posts.map((p: any) => p.id)).toEqual([5]);
    const args = mockClient.post.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(args.where).toMatchObject({ category: "질문", isHidden: false });
    expect(args.where.createdAt.gte.getTime()).toBe(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(mockClient.comment.groupBy.mock.calls[0][0].where).toEqual({
      postId: { in: [5, 6, 7, 8] },
      isHidden: false,
      deletedAt: null,
    });
  });

  it("질문자 본인 댓글만 달린 질문은 남고, 남이 답한 질문은 빠진다(page 로 넘긴다)", async () => {
    candidatesNow = candidates([5, 6, 7]);
    mockClient.comment.groupBy.mockResolvedValue([
      { postId: 5, userId: 3 }, // 질문자 본인 '아무도 없나요?'
      { postId: 6, userId: 9 }, // 다른 사람 답
    ]);
    const res = await get({ unanswered: "1", limit: "1", page: "2" });
    expect(res.body).toMatchObject({ unansweredCount: 2, pages: 2 });
    expect(res.body.posts.map((p: any) => p.id)).toEqual([7]);
  });

  it("없으면 빈 목록·0 (화면은 '물어보기' 카드를 그린다)", async () => {
    const res = await get({ unanswered: "1" });
    expect(res.body).toEqual({ success: true, posts: [], pages: 1, unansweredCount: 0 });
    expect(mockClient.comment.groupBy).not.toHaveBeenCalled();
  });

  it("차단한 작성자의 질문은 뺀다", async () => {
    mockClient.userBlock.findMany.mockResolvedValueOnce([{ blockerId: 7, blockedId: 3 }]);
    await get({ unanswered: "1" }, { id: 7 });
    expect(mockClient.post.findMany.mock.calls[0][0].where.userId).toEqual({ notIn: [3] });
  });

  it("limit 은 최대 20", async () => {
    candidatesNow = candidates(Array.from({ length: 30 }, (_, i) => i + 1));
    const res = await get({ unanswered: "1", limit: "99" });
    expect(res.body.posts).toHaveLength(20);
    expect(res.body.pages).toBe(2);
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
