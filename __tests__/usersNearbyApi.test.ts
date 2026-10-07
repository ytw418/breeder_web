/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  userBlock: { findMany: jest.fn() },
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
  getSortedActiveBreederProgramSummaries: () => [],
}));

import nearbyHandler from "../pages/api/users/nearby";

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

async function get(query: Record<string, string> = {}, user?: NextApiRequest["user"]) {
  const res = createRes();
  await nearbyHandler(
    { method: "GET", headers: {}, query, body: {}, user } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const me = { id: 7, name: "나" } as NextApiRequest["user"];

const row = (id: number, name: string, sigungu: string, posts: number, comments: number) => ({
  id,
  name,
  avatar: null,
  regionSido: "서울특별시",
  regionSigungu: sigungu,
  regionUpdatedAt: new Date(2026, 9, id),
  _count: { posts, Comments: comments },
  breederPrograms: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.userBlock.findMany.mockResolvedValue([]);
});

describe("GET /api/users/nearby", () => {
  it("비로그인은 401", async () => {
    const res = await get();
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("동네 미설정이면 scope none 과 빈 목록", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: null, regionSigungu: null });
    const res = await get({}, me);
    expect(res.body).toEqual({ success: true, scope: "none", region: null, items: [] });
    expect(mockClient.user.findMany).not.toHaveBeenCalled();
    expect(res.headers["Cache-Control"]).toContain("no-store");
  });

  it("같은 시/군/구의 나를 표시한 브리더를 활동 많은 순으로, 본인·차단 관계는 빼고 준다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "서울특별시", regionSigungu: "강남구" });
    mockClient.userBlock.findMany.mockResolvedValue([
      { blockerId: 7, blockedId: 20 },
      { blockerId: 21, blockedId: 7 },
    ]);
    mockClient.user.findMany.mockResolvedValueOnce([
      row(1, "조용한", "강남구", 1, 0),
      row(2, "활발한", "강남구", 10, 30),
    ]);

    const res = await get({ limit: "3" }, me);

    const where = mockClient.user.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      status: "ACTIVE",
      regionVisible: true,
      regionSido: "서울특별시",
      regionSigungu: "강남구",
      id: { notIn: [7, 20, 21] },
    });
    expect(res.body.scope).toBe("sigungu");
    expect(res.body.region).toEqual({ sido: "서울특별시", sigungu: "강남구" });
    expect(res.body.items.map((item: any) => item.user.name)).toEqual(["활발한", "조용한"]);
    expect(res.body.items[0]).toMatchObject({
      region: { sido: "서울특별시", sigungu: "강남구" },
      postsCount: 10,
      commentsCount: 30,
    });
    // 민감 정보는 내려가지 않는다
    expect(Object.keys(res.body.items[0].user).sort()).toEqual(["avatar", "id", "name"]);
  });

  it("시/군/구에 0명이면 시/도로 넓혀 scope sido", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "서울특별시", regionSigungu: "강남구" });
    mockClient.user.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row(3, "마포브리더", "마포구", 2, 2)]);

    const res = await get({}, me);

    expect(mockClient.user.findMany).toHaveBeenCalledTimes(2);
    const second = mockClient.user.findMany.mock.calls[1][0].where;
    expect(second.regionSido).toBe("서울특별시");
    expect(second.regionSigungu).toBeUndefined();
    expect(res.body.scope).toBe("sido");
    expect(res.body.items[0].region.sigungu).toBe("마포구");
  });

  it("시/도에도 0명이면 scope none 에 동네는 그대로", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "제주특별자치도", regionSigungu: "제주시" });
    mockClient.user.findMany.mockResolvedValue([]);
    const res = await get({}, me);
    expect(res.body).toEqual({
      success: true,
      scope: "none",
      region: { sido: "제주특별자치도", sigungu: "제주시" },
      items: [],
    });
  });

  it("limit 은 1~50 으로 자르고 잘못된 값은 기본 3", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "서울특별시", regionSigungu: "강남구" });
    mockClient.user.findMany.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => row(i + 1, `b${i}`, "강남구", 0, 0))
    );
    expect((await get({ limit: "999" }, me)).body.items).toHaveLength(50);
    expect((await get({ limit: "abc" }, me)).body.items).toHaveLength(3);
    expect((await get({ limit: "0" }, me)).body.items).toHaveLength(1);
  });
});
