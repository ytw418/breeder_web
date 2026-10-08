/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

/** 게시글 검색: 종 이름으로 찾으면 소분류 이름(강아지)으로 저장된 글도 카테고리 하위로 찾는다. */
const TREE = [
  { id: 5, name: "포유류", slug: "mammal", parentId: null, path: "/mammal/", isVisible: true, sortOrder: 5 },
  { id: 30, name: "햄스터", slug: "hamster", parentId: 5, path: "/mammal/hamster/", isVisible: true, sortOrder: 2 },
  { id: 31, name: "강아지", slug: "dog", parentId: 5, path: "/mammal/dog/", isVisible: true, sortOrder: 7 },
];

const mockClient = {
  category: { findMany: jest.fn(async () => TREE) },
  product: { findMany: jest.fn(async () => []) },
  post: { findMany: jest.fn(async (_args: { where: { OR: Record<string, unknown>[] } }) => []) },
  user: { findMany: jest.fn(async () => []) },
  userBlock: { findMany: jest.fn(async () => []) },
};

jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import searchHandler from "../pages/api/search/index";
import { invalidateCategoryCache } from "@libs/server/categories";

async function search(q: string) {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader: jest.fn(),
  };
  await searchHandler(
    { method: "GET", query: { q, type: "posts" } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return mockClient.post.findMany.mock.calls[0]![0].where.OR;
}

beforeEach(() => {
  jest.clearAllMocks();
  invalidateCategoryCache();
});

it("'포유류' 검색은 포유류와 그 하위 카테고리 글을 함께 찾는다", async () => {
  expect(await search("포유류")).toContainEqual({ categoryId: { in: [5, 30, 31] } });
});

it("종이 아닌 검색어는 카테고리 조건을 붙이지 않는다", async () => {
  const or = await search("사육장");
  expect(or.some((cond) => "categoryId" in cond)).toBe(false);
});
