import type { NextApiRequest, NextApiResponse } from "next";

// prisma 의 User.followers 관계는 "그 사용자가 팔로우하는" Follow 레코드를 가리킨다.
// 즉 _count.followers = 팔로잉 수, _count.following = 실제 팔로워 수.
const relationCounts: Record<number, Record<string, number>> = {
  // 많이 팔로우만 한 사용자: 팔로잉 10, 팔로워 0
  1: { insectRecords: 0, auctions: 0, followers: 10, following: 0 },
  // 팔로워가 많은 사용자: 팔로잉 0, 팔로워 3
  2: { insectRecords: 0, auctions: 0, followers: 0, following: 3 },
};

const mockClient = {
  user: {
    findMany: jest.fn(async (args: any) => {
      const selected = Object.keys(args?.select?._count?.select ?? {});
      return [1, 2].map((id) => ({
        id,
        name: `user${id}`,
        avatar: null,
        _count: Object.fromEntries(
          selected.map((key) => [key, relationCounts[id][key]])
        ),
      }));
    }),
  },
  like: { groupBy: jest.fn(async () => []) },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import rankingHandler from "../pages/api/ranking/index";

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    setHeader: jest.fn(),
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe("GET /api/ranking?tab=bredy", () => {
  it("인기 점수는 팔로잉 수가 아니라 실제 팔로워 수 x 10 으로 계산한다", async () => {
    const res = createRes();
    await rankingHandler(
      {
        method: "GET",
        headers: {},
        query: { tab: "bredy" },
        body: {},
      } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );

    expect(res.statusCode).toBe(200);
    const ranking = res.body.bredyRanking as Array<{
      user: { id: number };
      score: number;
    }>;
    // 팔로워 3명 → 30점, 팔로잉만 10명인 사용자는 0점이라 제외
    expect(ranking).toEqual([
      expect.objectContaining({ user: expect.objectContaining({ id: 2 }), score: 30 }),
    ]);
  });
});
