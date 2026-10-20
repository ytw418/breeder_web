/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  userBlock: { findMany: jest.fn() },
  follow: { findMany: jest.fn() },
  post: { groupBy: jest.fn() },
  comment: { groupBy: jest.fn() },
  product: { groupBy: jest.fn() },
  category: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: (rows: unknown[]) => rows,
}));

import suggestedHandler from "../pages/api/users/suggested";

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

const ME = 7;
const BLOCKED_BY_ME = 8;
const BLOCKED_ME = 9;
const FOLLOWING = 10;
const STRANGER = 11;
const recent = new Date();
const candidate = (id: number) => ({
  id,
  name: `user${id}`,
  avatar: null,
  pinnedCategoryIds: [],
  regionSido: null,
  regionSigungu: null,
  _count: { posts: 3 },
  breederPrograms: [],
});

describe("/api/users/suggested", () => {
  it("본인·차단(양방향)·이미 팔로우한 사람은 추천하지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ pinnedCategoryIds: [], regionSido: null, regionSigungu: null });
    mockClient.userBlock.findMany.mockResolvedValue([
      { blockerId: ME, blockedId: BLOCKED_BY_ME },
      { blockerId: BLOCKED_ME, blockedId: ME },
    ]);
    mockClient.follow.findMany.mockResolvedValue([{ followingId: FOLLOWING }]);
    // DB 가 where 를 무시하고 모두 돌려줘도(모의) 화면에 나가면 안 된다.
    const everyone = [ME, BLOCKED_BY_ME, BLOCKED_ME, FOLLOWING, STRANGER];
    const activity = everyone.map((userId) => ({ userId, _max: { createdAt: recent } }));
    mockClient.post.groupBy.mockImplementation((args: { by: string[] }) =>
      Promise.resolve(args.by.includes("type") ? [] : activity)
    );
    mockClient.comment.groupBy.mockResolvedValue([]);
    mockClient.product.groupBy.mockResolvedValue([]);
    mockClient.category.findMany.mockResolvedValue([]);
    mockClient.user.findMany.mockResolvedValue(everyone.map(candidate));

    const res = createRes();
    await suggestedHandler(
      { method: "GET", headers: {}, query: { limit: "10" }, body: {}, user: { id: ME } } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.users.map((u: { id: number }) => u.id)).toEqual([STRANGER]);
    // 쿼리에서도 뺀다(후보 수 상한 안에서 다른 사람이 밀려나지 않게).
    expect(mockClient.post.groupBy.mock.calls[0][0].where.userId.notIn).toEqual(
      expect.arrayContaining([ME, BLOCKED_BY_ME, BLOCKED_ME, FOLLOWING])
    );
  });

  it("동네 노출을 끈 사람은 같은 시/군/구여도 동네 후보·가산점에 쓰지 않는다", async () => {
    const OTHER = 20;
    const HIDDEN_NEIGHBOR = 21;
    const region = { regionSido: "서울", regionSigungu: "강남구" };
    mockClient.user.findUnique.mockResolvedValue({ pinnedCategoryIds: [], ...region });
    mockClient.userBlock.findMany.mockResolvedValue([]);
    mockClient.follow.findMany.mockResolvedValue([]);
    const activity = [OTHER, HIDDEN_NEIGHBOR].map((userId) => ({ userId, _max: { createdAt: recent } }));
    mockClient.post.groupBy.mockImplementation((args: { by: string[] }) =>
      Promise.resolve(args.by.includes("type") ? [] : activity)
    );
    mockClient.user.findMany.mockReset();
    mockClient.user.findMany.mockImplementation((args: { where: { id?: { in?: number[] } } }) =>
      Promise.resolve(
        args.where.id?.in
          ? [candidate(OTHER), { ...candidate(HIDDEN_NEIGHBOR), ...region, regionVisible: false }]
          : []
      )
    );

    const res = createRes();
    await suggestedHandler(
      { method: "GET", headers: {}, query: {}, body: {}, user: { id: ME } } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );

    // 같은 동네 +2 가 붙었다면 HIDDEN_NEIGHBOR 가 먼저 온다. 점수가 같으니 id 순.
    expect(res.body.users.map((u: { id: number }) => u.id)).toEqual([OTHER, HIDDEN_NEIGHBOR]);
    const regionQuery = mockClient.user.findMany.mock.calls.find(
      ([args]: [{ where: { regionSigungu?: string } }]) => args.where.regionSigungu
    );
    expect(regionQuery?.[0].where.regionVisible).toBe(true);
  });
});
