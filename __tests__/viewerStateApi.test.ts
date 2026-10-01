import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * #139 — 비로그인 isLiked, 팔로워·팔로잉 수 회귀 테스트.
 *
 * Prisma 는 where 의 값이 undefined 이면 그 조건을 통째로 무시한다.
 * mock 도 같은 의미로 동작하게 만들어, "userId: undefined" 로 조회하면
 * 다른 사람의 좋아요/찜이 잡히는 실제 버그를 재현한다.
 */

const OTHER_USER_ID = 99;
const LIKED_ID = 1;

function prismaLikeFindFirst(owner: { postId?: number; productId?: number }) {
  return jest.fn(({ where }: { where: Record<string, unknown> }) => {
    const row = { id: LIKED_ID, userId: OTHER_USER_ID, ...owner };
    const matched = Object.entries(where).every(
      ([key, value]) =>
        value === undefined || (row as Record<string, unknown>)[key] === value
    );
    return Promise.resolve(matched ? { id: row.id } : null);
  });
}

const mockClient = {
  post: { findUnique: jest.fn(), findFirst: jest.fn() },
  like: { findFirst: prismaLikeFindFirst({ postId: 10 }) },
  product: { findUnique: jest.fn(), findMany: jest.fn() },
  fav: { findFirst: prismaLikeFindFirst({ productId: 20 }) },
  purchase: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
  follow: { findFirst: jest.fn() },
  userBadge: { findMany: jest.fn() },
  // 차단 없음(#18 viewer 필터는 viewerFilterApi.test.ts 에서 검증)
  userBlock: {
    findMany: jest.fn(() => Promise.resolve([])),
    findFirst: jest.fn(() => Promise.resolve(null)),
  },
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
  getActiveBreederProgramsByUserId: () => Promise.resolve([]),
}));

import postDetailHandler from "../pages/api/posts/[id]/index";
import productDetailHandler from "../pages/api/products/[id]/index";
import userDetailHandler from "../pages/api/users/[id]/index";

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

const asUser = (id: number) => ({ id, name: "u" }) as NextApiRequest["user"];

beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  mockClient.post.findUnique.mockResolvedValue({
    id: 10,
    title: "게시글",
    category: "자유",
    createdAt: new Date(),
    user: { id: 1, name: "작성자", avatar: null, breederPrograms: [] },
    comments: [],
    _count: { comments: 0, Likes: 1 },
  });
  mockClient.product.findUnique.mockResolvedValue({
    id: 20,
    userId: 1,
    name: "왕사슴 수컷",
    status: "판매중",
    user: { id: 1, name: "판매자", avatar: null },
    _count: { favs: 1 },
  });
  mockClient.product.findMany.mockResolvedValue([]);
  mockClient.purchase.findFirst.mockResolvedValue(null);
});

describe("GET /api/posts/{id} isLiked", () => {
  it("비로그인 요청이면 다른 사람이 좋아요했어도 false", async () => {
    const res = await call(postDetailHandler, { query: { id: "10" } });
    expect(res.statusCode).toBe(200);
    expect(res.body.isLiked).toBe(false);
  });

  it("좋아요한 본인이면 true, 다른 로그인 유저면 false", async () => {
    const liked = await call(postDetailHandler, {
      query: { id: "10" },
      user: asUser(OTHER_USER_ID),
    });
    expect(liked.body.isLiked).toBe(true);

    const notLiked = await call(postDetailHandler, {
      query: { id: "10" },
      user: asUser(5),
    });
    expect(notLiked.body.isLiked).toBe(false);
  });
});

describe("GET /api/products/{id} isLiked", () => {
  it("비로그인 요청이면 다른 사람이 찜했어도 false", async () => {
    const res = await call(productDetailHandler, { query: { id: "20" } });
    expect(res.statusCode).toBe(200);
    expect(res.body.isLiked).toBe(false);
  });

  it("찜한 본인이면 true, 다른 로그인 유저면 false", async () => {
    const liked = await call(productDetailHandler, {
      query: { id: "20" },
      user: asUser(OTHER_USER_ID),
    });
    expect(liked.body.isLiked).toBe(true);

    const notLiked = await call(productDetailHandler, {
      query: { id: "20" },
      user: asUser(5),
    });
    expect(notLiked.body.isLiked).toBe(false);
  });
});

describe("GET /api/users/{id} 팔로워·팔로잉 수", () => {
  it("전제: schema 의 User.followers 관계는 Follow.followerId 쪽이다(이름과 의미가 반대)", () => {
    // 이 전제가 바뀌면(스키마 관계 이름을 바로잡으면) API 의 스왑 매핑도 함께 제거해야 한다.
    const schema = fs.readFileSync(
      path.join(__dirname, "../prisma/schema.prisma"),
      "utf8"
    );
    expect(schema).toMatch(/followers\s+Follow\[\]\s+@relation\(name: "follower"\)/);
    expect(schema).toMatch(
      /follower\s+User\s+@relation\(name: "follower", fields: \[followerId\]/
    );
  });

  it("_count.followers 는 이 유저를 팔로우하는 수, following 은 이 유저가 팔로우하는 수", async () => {
    // schema.prisma: User.followers = @relation("follower") → 이 유저가 followerId 인 Follow
    // (= 이 유저가 팔로우하는 사람). 즉 Prisma _count 값은 이름과 의미가 반대로 나온다.
    // A(id 1)를 B가 팔로우 → A 기준 Prisma _count 는 { followers: 0, following: 1 }.
    mockClient.user.findUnique.mockResolvedValue({
      id: 1,
      name: "A",
      email: null,
      _count: {
        followers: 0,
        following: 1,
        products: 0,
        posts: 0,
        Comments: 0,
        insectRecords: 0,
        receivedReviews: 0,
        createdBloodlineCards: 0,
        ownedBloodlineCards: 0,
      },
    });
    mockClient.userBadge.findMany.mockResolvedValue([]);

    const res = await call(userDetailHandler, { query: { id: "1" } });

    expect(res.statusCode).toBe(200);
    expect(res.body.user._count.followers).toBe(1);
    expect(res.body.user._count.following).toBe(0);
  });
});
