/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  // 카테고리 고정 범위 헬퍼(libs/server/categories)가 읽는 트리. 비우면 범위 조건을 붙이지 않는다.
  category: { findMany: jest.fn(async () => []) },
  post: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  user: { findUnique: jest.fn() },
  userBlock: { findMany: jest.fn() },
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
  getSortedActiveBreederProgramSummaries: () => [],
}));

import postsHandler from "../pages/api/posts/index";

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

async function call(req: Partial<NextApiRequest>) {
  const res = createRes();
  await postsHandler(
    { headers: {}, query: {}, body: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const me = { id: 7, name: "브리디" } as NextApiRequest["user"];

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.userBlock.findMany.mockResolvedValue([]);
  mockClient.post.findMany.mockResolvedValue([]);
  mockClient.post.count.mockResolvedValue(0);
  mockClient.post.create.mockResolvedValue({ id: 1 });
});

describe("GET /api/posts 동네 필터", () => {
  it("시/도·시/군/구를 주면 그 동네의 해당 카테고리 글만 센다", async () => {
    await call({
      method: "GET",
      query: { category: "동네", regionSido: "서울특별시", regionSigungu: "강남구" },
    });
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      category: "동네",
      regionSido: "서울특별시",
      regionSigungu: "강남구",
      isHidden: false,
    });
    expect(mockClient.post.count).toHaveBeenCalledWith({ where });
  });

  it("시/도만 주면 시/도 전체로 넓힌다", async () => {
    await call({ method: "GET", query: { category: "동네", regionSido: "서울특별시" } });
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where.regionSido).toBe("서울특별시");
    expect(where).not.toHaveProperty("regionSigungu");
  });

  it("지역 파라미터가 없으면 지역 조건을 붙이지 않는다", async () => {
    await call({ method: "GET", query: { category: "자유" } });
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("regionSido");
  });
});

describe("POST /api/posts 동네 글", () => {
  const body = { title: "인사", description: "안녕하세요 동네 이웃 여러분", image: "img-1", category: "동네" };

  it("작성자 동네를 글에 복사한다", async () => {
    mockClient.user.findUnique
      .mockResolvedValueOnce({ regionSido: "서울특별시", regionSigungu: "강남구" })
      .mockResolvedValueOnce({ name: "브리디" });
    const res = await call({ method: "POST", body, user: me });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.create.mock.calls[0][0].data).toMatchObject({
      category: "동네",
      regionSido: "서울특별시",
      regionSigungu: "강남구",
    });
  });

  it("작성자 동네가 없으면 400 REGION_REQUIRED", async () => {
    mockClient.user.findUnique.mockResolvedValueOnce({ regionSido: null, regionSigungu: null });
    const res = await call({ method: "POST", body, user: me });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, errorCode: "REGION_REQUIRED" });
    expect(mockClient.post.create).not.toHaveBeenCalled();
  });

  it("다른 카테고리 글에는 지역을 넣지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValueOnce({ name: "브리디" });
    await call({ method: "POST", body: { ...body, category: "자유" }, user: me });
    const data = mockClient.post.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("regionSido");
  });
});
