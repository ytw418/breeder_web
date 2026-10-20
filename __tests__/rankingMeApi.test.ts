/**
 * @jest-environment node
 */
/**
 * 내 순위 목표(AC-2·AC-3): 3위 밖이면 3위, 안이면 바로 위, 1위면 2위와의 점수 차. 활동은 가중치 역산으로 개수 최소.
 */
import type { NextApiRequest, NextApiResponse } from "next";

// 게시글 수만으로 순위가 정해지는 가짜 DB: u1 8개(80점) · u2 6개 · u3 4개 · u7 2개(20점).
const postCounts: Record<number, number> = { 1: 8, 2: 6, 3: 4, 7: 2 };
const mockClient = {
  user: {
    findMany: jest.fn(async () => [1, 2, 3, 7].map((id) => ({ id, name: `u${id}`, avatar: null }))),
  },
  post: {
    groupBy: jest.fn(async ({ where }: any) =>
      // 이번 주 창(createdAt.lte 가 미래)만 센다. 지난주는 0.
      where.createdAt && where.createdAt.lte.getTime() > Date.now()
        ? Object.entries(postCounts).map(([userId, n]) => ({ userId: Number(userId), _count: { _all: n } }))
        : []
    ),
  },
  product: { groupBy: jest.fn(async () => []) },
  comment: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
  bid: { groupBy: jest.fn(async () => []) },
  auction: { groupBy: jest.fn(async () => []) },
  userBadge: { findMany: jest.fn(async () => []) },
  category: { findMany: jest.fn(async (): Promise<any[]> => []) },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
jest.mock("@libs/server/growth", () => ({
  ensureAlertSubscription: jest.fn(),
  ensureCurrentWeeklySeason: jest.fn(async () => ({ id: 9 })),
}));

import { computeRankingMe, pickNextAction } from "@libs/server/ranking";
import { invalidateCategoryCache } from "@libs/server/categories";
import { ensureAlertSubscription } from "@libs/server/growth";
import meHandler from "../pages/api/rankings/me";
import breedersHandler from "../pages/api/rankings/breeders";

const entry = (rank: number, id: number, score: number, previousRank: number | null = null) => ({
  rank,
  score,
  previousRank,
  rankDelta: previousRank ? previousRank - rank : 0,
  scoreDelta: 0,
  postsCount: 0,
  commentsCount: 0,
  bidsCount: 0,
  auctionWinsCount: 0,
  sellerEndedAuctionsCount: 0,
  user: { id, name: `u${id}`, avatar: null },
  badges: [],
});

const board = [entry(1, 1, 80), entry(2, 2, 60), entry(3, 3, 45), entry(4, 4, 40), entry(5, 5, 30), entry(6, 6, 28), entry(7, 7, 26, 9)];

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

describe("pickNextAction (AC-3)", () => {
  it("글 2개 > 댓글 5개: 개수가 가장 적은 활동", () => {
    expect(pickNextAction(20)).toEqual({ kind: "post", count: 2 });
    expect(pickNextAction(1)).toEqual({ kind: "post", count: 1 });
    expect(pickNextAction(0)).toBeNull();
  });
});

describe("computeRankingMe", () => {
  it("3위 밖이면 목표는 3위, 점수는 3위 + 1", () => {
    expect(computeRankingMe(board, 7)).toEqual({
      rank: 7,
      score: 26,
      delta: 2,
      nextRank: 3,
      nextScore: 46,
      nextAction: { kind: "post", count: 2 },
      gapToSecond: null,
    });
  });

  it("3위 안이면 바로 위", () => {
    expect(computeRankingMe(board, 3)).toMatchObject({ rank: 3, nextRank: 2, nextScore: 61, nextAction: { kind: "post", count: 2 } });
  });

  it("1위면 목표 없음, 2위와 점수 차", () => {
    expect(computeRankingMe(board, 1)).toEqual({
      rank: 1,
      score: 80,
      delta: null,
      nextRank: null,
      nextScore: null,
      nextAction: null,
      gapToSecond: 20,
    });
  });

  it("순위 없음(점수 0)은 3위가 목표", () => {
    expect(computeRankingMe(board, 99)).toMatchObject({ rank: null, score: 0, nextRank: 3, nextScore: 46, nextAction: { kind: "post", count: 5 } });
  });

  it("랭킹 인원이 3명보다 적으면 1점만 있어도 오른다", () => {
    expect(computeRankingMe([entry(1, 1, 10)], 99)).toMatchObject({ nextRank: 2, nextScore: 1, nextAction: { kind: "post", count: 1 } });
  });
});

const call = async (handler: any, query: Record<string, string>, user?: { id: number }) => {
  const res = createRes();
  await handler({ method: "GET", headers: {}, query, body: {}, user } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
};

describe("GET /api/rankings/me", () => {
  it("비로그인은 401", async () => {
    const res = await call(meHandler, {});
    expect(res.statusCode).toBe(401);
  });

  it("item 은 옛 요약 + 목표, me 는 계약 RankingMe", async () => {
    const res = await call(meHandler, {}, { id: 7 });
    expect(res.statusCode).toBe(200);
    expect(res.body.me).toEqual({
      rank: 4,
      score: 20,
      delta: null,
      nextRank: 3,
      nextScore: 41,
      nextAction: { kind: "post", count: 3 },
      gapToSecond: null,
    });
    expect(res.body.item).toMatchObject({ currentSeasonId: 9, currentRank: 4, nextRank: 3 });
    expect(res.headers["Cache-Control"]).toContain("no-store");
  });

  it("categoryPath 가 있으면 관심 분야 범위 랭킹(글 1점)에서 내 순위·다음 목표(글 개수)를 낸다", async () => {
    invalidateCategoryCache();
    jest.mocked(ensureAlertSubscription).mockClear();
    mockClient.category.findMany.mockResolvedValueOnce([
      { id: 5, name: "고양이", slug: "cat", parentId: null, path: "/cat/", sortOrder: 0, isVisible: true },
    ]);
    const res = await call(meHandler, { categoryPath: "/cat/" }, { id: 7 });
    // 범위 점수: u1 8 · u2 6 · u3 4 · u7 2 → 4위, 3위(4점)를 넘으려면 글 3개.
    expect(res.body.me).toMatchObject({ rank: 4, score: 2, nextRank: 3, nextScore: 5, nextAction: { kind: "post", count: 3 } });
    expect(mockClient.post.groupBy.mock.calls.at(-1)?.[0].where.categoryId).toEqual({ in: [5] });
    // 알림은 전체 순위로 보내므로 범위 순위로는 구독을 만들지 않는다.
    expect(ensureAlertSubscription).not.toHaveBeenCalled();
    invalidateCategoryCache();
  });
});

describe("GET /api/rankings/breeders?me=1", () => {
  it("로그인: 상위 limit 명 + 내 목표, 공유 캐시 안 함", async () => {
    const res = await call(breedersHandler, { me: "1", limit: "3" }, { id: 7 });
    expect(res.body.items).toHaveLength(3);
    expect(res.body.me).toMatchObject({ rank: 4, nextRank: 3, nextAction: { kind: "post", count: 3 } });
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
  });

  it("비로그인은 me: null", async () => {
    const res = await call(breedersHandler, { me: "1" });
    expect(res.body.me).toBeNull();
  });

  it("me 없이는 예전처럼 공개 캐시, me 필드 없음", async () => {
    const res = await call(breedersHandler, { limit: "2" });
    expect(res.body.items).toHaveLength(2);
    expect(res.body).not.toHaveProperty("me");
    expect(res.headers["Cache-Control"]).toContain("public");
  });
});
