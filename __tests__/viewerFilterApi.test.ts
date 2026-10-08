import type { NextApiRequest, NextApiResponse } from "next";

/**
 * #18 서버 차단 — 목록·상세의 viewer 필터.
 * - 로그인한 viewer 가 차단한 사람의 글·댓글·상품·경매·유저는 viewer 에게서만 뺀다(단방향).
 * - viewer 기준으로 걸러진 응답은 `private, no-store` 로 둔다.
 * - 비로그인 요청은 기존 쿼리·public 캐시 헤더를 그대로 유지한다.
 * - 목록 응답은 `Vary: Authorization` 을 달아 비로그인용 CDN 캐시가 로그인 요청에 쓰이지 않게 한다.
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test";

const mockClient = {
  // 카테고리 고정 범위 헬퍼(libs/server/categories)가 읽는 트리. 비우면 범위 조건을 붙이지 않는다.
  category: { findMany: jest.fn(async () => []) },
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  userBlock: { findMany: jest.fn(), findFirst: jest.fn() },
  post: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
  like: { findFirst: jest.fn() },
  product: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
  fav: { findFirst: jest.fn() },
  purchase: { findFirst: jest.fn() },
  auction: { findMany: jest.fn(), count: jest.fn() },
  follow: { findFirst: jest.fn() },
  userBadge: { findMany: jest.fn() },
  // 프로필 보유 혈통 수(countProfileBloodlineCards)
  bloodlineCard: { findMany: jest.fn(async () => []) },
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
jest.mock("@libs/server/auctionSettlement", () => ({
  settleExpiredAuctions: jest.fn(),
}));
jest.mock("@libs/server/notification", () => ({
  notifyFollowers: jest.fn(),
}));
jest.mock("@libs/server/growth", () => ({
  incrementUserMissionProgress: jest.fn(),
  ensureAlertSubscription: jest.fn(),
  ensureCurrentWeeklySeason: jest.fn(),
  getUserMissionSummary: jest.fn(),
}));
jest.mock("@libs/server/ranking", () => ({}));
jest.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

import postsHandler from "../pages/api/posts/index";
import postDetailHandler from "../pages/api/posts/[id]/index";
import productsHandler from "../pages/api/products/index";
import popularHandler from "../pages/api/products/popular";
import productDetailHandler from "../pages/api/products/[id]/index";
import auctionsHandler from "../pages/api/auctions/index";
import searchHandler from "../pages/api/search/index";
import userDetailHandler from "../pages/api/users/[id]/index";
import productListHandler from "../pages/api/users/[id]/productList";
import { fetchProductsResponse } from "@libs/server/home";

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

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: Partial<NextApiRequest>
) {
  const res = createRes();
  await handler(
    { method: "GET", headers: {}, query: {}, body: {}, cookies: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const VIEWER = 7;
const BLOCKED_A = 9;
const BLOCKED_B = 12;
const viewer = { id: VIEWER, name: "viewer" } as NextApiRequest["user"];
const PRIVATE_NO_STORE = "private, no-store, max-age=0";
const VARY_AUTHORIZATION = "Authorization";

type BlockRow = { blockerId: number; blockedId: number };
let blocks: BlockRow[] = [];

const blockAsViewer = (...ids: number[]) => {
  blocks = ids.map((blockedId) => ({ blockerId: VIEWER, blockedId }));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  blocks = [];

  mockClient.userBlock.findMany.mockImplementation(
    ({ where }: { where: { blockerId: number } }) =>
      Promise.resolve(
        blocks
          .filter((row) => row.blockerId === where.blockerId)
          .map((row) => ({ blockedId: row.blockedId }))
      )
  );
  mockClient.userBlock.findFirst.mockImplementation(
    ({ where }: { where: { blockerId: number; blockedId: number } }) =>
      Promise.resolve(
        blocks.find(
          (row) => row.blockerId === where.blockerId && row.blockedId === where.blockedId
        )
          ? { id: 1 }
          : null
      )
  );

  mockClient.post.findMany.mockResolvedValue([]);
  mockClient.post.count.mockResolvedValue(0);
  mockClient.post.findFirst.mockResolvedValue(null);
  mockClient.post.findUnique.mockResolvedValue({
    id: 10,
    title: "게시글",
    category: "자유",
    image: "",
    images: [],
    createdAt: new Date(),
    user: { id: 1, name: "작성자", avatar: null, breederPrograms: [] },
    comments: [],
    _count: { comments: 0, Likes: 0 },
  });
  mockClient.like.findFirst.mockResolvedValue(null);
  mockClient.product.findMany.mockResolvedValue([]);
  mockClient.product.count.mockResolvedValue(0);
  mockClient.fav.findFirst.mockResolvedValue(null);
  mockClient.purchase.findFirst.mockResolvedValue(null);
  mockClient.auction.findMany.mockResolvedValue([]);
  mockClient.auction.count.mockResolvedValue(0);
  mockClient.user.findMany.mockResolvedValue([]);
  mockClient.follow.findFirst.mockResolvedValue(null);
  mockClient.userBadge.findMany.mockResolvedValue([]);
});

describe("GET /api/posts 목록", () => {
  it("비로그인이면 작성자 필터 없이 public 캐시 헤더를 유지한다", async () => {
    const res = await call(postsHandler, { query: {} });

    expect(res.statusCode).toBe(200);
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("userId");
    expect(mockClient.post.count.mock.calls[0][0].where).not.toHaveProperty("userId");
    expect(res.headers["cache-control"]).toMatch(/^public, s-maxage=/);
    // 비로그인 캐시 항목은 Authorization 이 있는 요청과 섞이지 않는다.
    expect(res.headers["vary"]).toBe(VARY_AUTHORIZATION);
    expect(mockClient.userBlock.findMany).not.toHaveBeenCalled();
  });

  it("로그인 + 차단이 있으면 목록·count 모두 userId.notIn, private no-store", async () => {
    blockAsViewer(BLOCKED_A, BLOCKED_B);
    const res = await call(postsHandler, { query: { category: "자유" }, user: viewer });

    expect(res.statusCode).toBe(200);
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where.userId).toEqual({ notIn: [BLOCKED_A, BLOCKED_B] });
    expect(where.category).toBe("자유");
    expect(mockClient.post.count.mock.calls[0][0].where.userId).toEqual({
      notIn: [BLOCKED_A, BLOCKED_B],
    });
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
    expect(res.headers["vary"]).toBe(VARY_AUTHORIZATION);
  });

  it("로그인했지만 차단이 없으면 where 는 기존 그대로, 헤더는 private", async () => {
    const res = await call(postsHandler, { query: {}, user: viewer });

    expect(mockClient.post.findMany.mock.calls[0][0].where).toEqual({
      NOT: { category: "공지" },
      isHidden: false,
    });
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
  });
});

describe("GET /api/posts/:id 댓글", () => {
  it("비로그인이면 숨긴 댓글만 빼고 그 수도 같이 뺀다", async () => {
    const res = await call(postDetailHandler, { query: { id: "10" } });

    expect(res.statusCode).toBe(200);
    const include = mockClient.post.findUnique.mock.calls[0][0].include;
    expect(include.comments.where).toEqual({ isHidden: false });
    expect(include._count.select.comments).toEqual({ where: { isHidden: false } });
  });

  it("로그인 + 차단이 있으면 차단한 사람의 댓글과 숨긴 댓글(내 것 제외)을 뺀다", async () => {
    blockAsViewer(BLOCKED_A);
    const res = await call(postDetailHandler, { query: { id: "10" }, user: viewer });

    expect(res.statusCode).toBe(200);
    const include = mockClient.post.findUnique.mock.calls[0][0].include;
    const expected = {
      AND: [
        { userId: { notIn: [BLOCKED_A] } },
        { OR: [{ isHidden: false }, { userId: VIEWER }] },
      ],
    };
    expect(include.comments.where).toEqual(expected);
    expect(include._count.select.comments).toEqual({ where: expected });
  });

  it("관리자는 숨긴 댓글까지 모두 받는다", async () => {
    const res = await call(postDetailHandler, {
      query: { id: "10" },
      user: { ...viewer, role: "ADMIN" } as NextApiRequest["user"],
    });

    expect(res.statusCode).toBe(200);
    const include = mockClient.post.findUnique.mock.calls[0][0].include;
    expect(include.comments).not.toHaveProperty("where");
    expect(include._count.select.comments).toBe(true);
  });

  it("숨긴 글은 작성자·관리자가 아니면 404 POST_HIDDEN", async () => {
    const hiddenPost = {
      ...(await mockClient.post.findUnique()),
      userId: 1,
      isHidden: true,
    };
    mockClient.post.findUnique.mockResolvedValue(hiddenPost);

    const stranger = await call(postDetailHandler, { query: { id: "10" }, user: viewer });
    expect(stranger.statusCode).toBe(404);
    expect(stranger.body.errorCode).toBe("POST_HIDDEN");

    const anonymous = await call(postDetailHandler, { query: { id: "10" } });
    expect(anonymous.statusCode).toBe(404);

    const author = await call(postDetailHandler, {
      query: { id: "10" },
      user: { id: 1, name: "작성자" } as NextApiRequest["user"],
    });
    expect(author.statusCode).toBe(200);
    expect(author.body.post.isHidden).toBe(true);

    const admin = await call(postDetailHandler, {
      query: { id: "10" },
      user: { ...viewer, role: "SUPER_USER" } as NextApiRequest["user"],
    });
    expect(admin.statusCode).toBe(200);
  });
});

describe("GET /api/products 목록 (buildProductsResponse)", () => {
  it("비로그인이면 숨김·삭제 상품만 빼고 public 캐시 헤더를 유지한다", async () => {
    const res = await call(productsHandler, { query: {} });

    expect(res.statusCode).toBe(200);
    const where = mockClient.product.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ isHidden: false, isDeleted: false });
    expect(mockClient.product.count.mock.calls[0][0].where).toEqual(where);
    expect(res.headers["cache-control"]).toMatch(/^public, s-maxage=/);
    expect(res.headers["vary"]).toBe(VARY_AUTHORIZATION);
    expect(mockClient.userBlock.findMany).not.toHaveBeenCalled();
  });

  it("로그인 + 차단이 있으면 userId.notIn, private no-store", async () => {
    blockAsViewer(BLOCKED_A);
    const res = await call(productsHandler, {
      query: { category: "전체", status: "판매중" },
      user: viewer,
    });

    const where = mockClient.product.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      isHidden: false,
      isDeleted: false,
      status: "판매중",
      userId: { notIn: [BLOCKED_A] },
    });
    expect(mockClient.product.count.mock.calls[0][0].where).toEqual(where);
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
  });

  it("price=0 이면 가격 0원(무료나눔) 상품만 거른다", async () => {
    const res = await call(productsHandler, {
      query: { status: "판매중", price: "0" },
    });

    expect(res.statusCode).toBe(200);
    const where = mockClient.product.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      isHidden: false,
      isDeleted: false,
      status: "판매중",
      price: 0,
    });
    expect(mockClient.product.count.mock.calls[0][0].where).toEqual(where);
    expect(res.headers["cache-control"]).toMatch(/s-maxage=30,/);
  });

  it("price 가 0 이상의 정수가 아니면 무시한다", async () => {
    for (const price of ["abc", "-1", "1.5", ""]) {
      mockClient.product.findMany.mockClear();
      await call(productsHandler, { query: { price } });
      expect(mockClient.product.findMany.mock.calls[0][0].where).toEqual({
        isHidden: false,
        isDeleted: false,
      });
    }
  });

  it("fetchProductsResponse 는 viewerId 가 없으면 차단 목록을 조회하지 않는다", async () => {
    await fetchProductsResponse({ page: 1, size: 10 });

    expect(mockClient.userBlock.findMany).not.toHaveBeenCalled();
    expect(mockClient.product.findMany.mock.calls[0][0].where).toEqual({
      isHidden: false,
      isDeleted: false,
    });
  });
});

describe("GET /api/products/popular", () => {
  it("비로그인이어도 숨김·삭제 상품은 항상 뺀다(public 캐시 유지)", async () => {
    const res = await call(popularHandler, {});

    const where = mockClient.product.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ isHidden: false, isDeleted: false });
    expect(res.headers["cache-control"]).toMatch(/^public, s-maxage=/);
    expect(res.headers["vary"]).toBe(VARY_AUTHORIZATION);
  });

  it("로그인 + 차단이 있으면 userId.notIn, private no-store", async () => {
    blockAsViewer(BLOCKED_A, BLOCKED_B);
    const res = await call(popularHandler, { user: viewer });

    const where = mockClient.product.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      isHidden: false,
      isDeleted: false,
      userId: { notIn: [BLOCKED_A, BLOCKED_B] },
    });
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
  });
});

describe("GET /api/auctions 목록", () => {
  it("비로그인이면 작성자 필터 없이 public 캐시 헤더를 유지한다", async () => {
    const res = await call(auctionsHandler, { query: {} });

    expect(res.statusCode).toBe(200);
    expect(mockClient.auction.findMany.mock.calls[0][0].where).toEqual({ isHidden: false });
    expect(res.headers["cache-control"]).toMatch(/^public, s-maxage=/);
    expect(res.headers["vary"]).toBe(VARY_AUTHORIZATION);
  });

  it("로그인 + 차단이 있으면 목록·count 모두 userId.notIn, private no-store", async () => {
    blockAsViewer(BLOCKED_A);
    const res = await call(auctionsHandler, { query: { status: "진행중" }, user: viewer });

    const where = mockClient.auction.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      isHidden: false,
      status: "진행중",
      userId: { notIn: [BLOCKED_A] },
    });
    expect(mockClient.auction.count.mock.calls[0][0].where).toEqual(where);
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
  });
});

describe("GET /api/search", () => {
  it("로그인 + 차단이 있으면 상품·게시글은 userId.notIn, 유저는 id.notIn", async () => {
    blockAsViewer(BLOCKED_A, BLOCKED_B);
    const res = await call(searchHandler, { query: { q: "사슴" }, user: viewer });

    expect(res.statusCode).toBe(200);
    const productWhere = mockClient.product.findMany.mock.calls[0][0].where;
    expect(productWhere).toMatchObject({
      isHidden: false,
      isDeleted: false,
      userId: { notIn: [BLOCKED_A, BLOCKED_B] },
    });
    expect(productWhere.OR.length).toBeGreaterThan(0);
    expect(mockClient.post.findMany.mock.calls[0][0].where).toMatchObject({
      category: { not: "공지" },
      userId: { notIn: [BLOCKED_A, BLOCKED_B] },
    });
    expect(mockClient.user.findMany.mock.calls[0][0].where).toEqual({
      name: { contains: "사슴", mode: "insensitive" },
      id: { notIn: [BLOCKED_A, BLOCKED_B] },
    });
    expect(res.headers["cache-control"]).toBe(PRIVATE_NO_STORE);
  });

  it("비로그인이면 유저 검색 where 는 기존 그대로, 상품은 숨김·삭제만 뺀다", async () => {
    const res = await call(searchHandler, { query: { q: "사슴" } });

    expect(res.headers["vary"]).toBe(VARY_AUTHORIZATION);

    expect(mockClient.user.findMany.mock.calls[0][0].where).toEqual({
      name: { contains: "사슴", mode: "insensitive" },
    });
    expect(mockClient.post.findMany.mock.calls[0][0].where).not.toHaveProperty("userId");
    const productWhere = mockClient.product.findMany.mock.calls[0][0].where;
    expect(productWhere).toMatchObject({ isHidden: false, isDeleted: false });
    expect(productWhere).not.toHaveProperty("userId");
    expect(mockClient.userBlock.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/users/:id isBlocked", () => {
  const TARGET = BLOCKED_A;

  beforeEach(() => {
    mockClient.user.findUnique.mockResolvedValue({
      id: TARGET,
      name: "상대",
      email: null,
      _count: {
        followers: 0,
        following: 0,
        products: 0,
        posts: 0,
        Comments: 0,
        insectRecords: 0,
        receivedReviews: 0,
        createdBloodlineCards: 0,
        ownedBloodlineCards: 0,
      },
    });
  });

  it("viewer 가 대상을 차단했으면 true", async () => {
    blockAsViewer(TARGET);
    const res = await call(userDetailHandler, { query: { id: String(TARGET) }, user: viewer });

    expect(res.statusCode).toBe(200);
    expect(res.body.isBlocked).toBe(true);
  });

  it("차단하지 않았으면 false (대상이 viewer 를 차단한 사실은 노출하지 않는다)", async () => {
    blocks = [{ blockerId: TARGET, blockedId: VIEWER }];
    const res = await call(userDetailHandler, { query: { id: String(TARGET) }, user: viewer });

    expect(res.statusCode).toBe(200);
    expect(res.body.isBlocked).toBe(false);
  });

  it("비로그인이면 false, 차단 조회를 하지 않는다", async () => {
    const res = await call(userDetailHandler, { query: { id: String(TARGET) } });

    expect(res.body.isBlocked).toBe(false);
    expect(mockClient.userBlock.findFirst).not.toHaveBeenCalled();
  });
  it("상품 수(_count.products)에는 삭제한 상품을 세지 않는다", async () => {
    await call(userDetailHandler, { query: { id: String(TARGET) } });

    const count = mockClient.user.findUnique.mock.calls[0][0].include._count.select;
    expect(count.products).toEqual({ where: { isDeleted: false } });
  });
});

describe("GET /api/products/:id 숨김 상품", () => {
  const OWNER = 3;
  const hiddenProduct = (overrides: Record<string, unknown> = {}) => ({
    id: 20,
    userId: OWNER,
    name: "왕사슴 수컷",
    status: "판매중",
    isHidden: true,
    isDeleted: false,
    user: { id: OWNER, name: "판매자", avatar: null },
    _count: { favs: 0 },
    ...overrides,
  });

  it("숨김 상품을 소유자가 아닌 사람이 보면 404 PRODUCT_HIDDEN", async () => {
    mockClient.product.findUnique.mockResolvedValue(hiddenProduct());
    const res = await call(productDetailHandler, { query: { id: "20" }, user: viewer });

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: "삭제되었거나 숨겨진 상품입니다.",
      errorCode: "PRODUCT_HIDDEN",
    });
  });

  it("삭제 상품을 비로그인으로 보면 404 PRODUCT_HIDDEN", async () => {
    mockClient.product.findUnique.mockResolvedValue(
      hiddenProduct({ isHidden: false, isDeleted: true })
    );
    const res = await call(productDetailHandler, { query: { id: "20" } });

    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("PRODUCT_HIDDEN");
  });

  it("소유자는 숨김 상품도 200 으로 본다", async () => {
    mockClient.product.findUnique.mockResolvedValue(hiddenProduct());
    const res = await call(productDetailHandler, {
      query: { id: "20" },
      user: { id: OWNER, name: "판매자" } as NextApiRequest["user"],
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.id).toBe(20);
  });

  it("공개 상품은 그대로 200", async () => {
    mockClient.product.findUnique.mockResolvedValue(hiddenProduct({ isHidden: false }));
    const res = await call(productDetailHandler, { query: { id: "20" }, user: viewer });

    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/products/:id 연관 상품", () => {
  const product = {
    id: 20,
    userId: 3,
    name: "왕사슴 수컷",
    status: "판매중",
    isHidden: false,
    isDeleted: false,
    user: { id: 3, name: "판매자", avatar: null },
    _count: { favs: 0 },
  };

  beforeEach(() => {
    mockClient.product.findUnique.mockResolvedValue(product);
  });

  it("비로그인이어도 숨김·삭제 상품은 연관 상품에서 뺀다", async () => {
    const res = await call(productDetailHandler, { query: { id: "20" } });

    expect(res.statusCode).toBe(200);
    const where = mockClient.product.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ isHidden: false, isDeleted: false });
    expect(where.OR.length).toBeGreaterThan(0);
    expect(where).not.toHaveProperty("userId");
    expect(mockClient.userBlock.findMany).not.toHaveBeenCalled();
  });

  it("로그인 + 차단이 있으면 차단한 판매자의 상품도 연관 상품에서 뺀다", async () => {
    blockAsViewer(BLOCKED_A, BLOCKED_B);
    const res = await call(productDetailHandler, { query: { id: "20" }, user: viewer });

    expect(res.statusCode).toBe(200);
    expect(mockClient.product.findMany.mock.calls[0][0].where).toMatchObject({
      isHidden: false,
      isDeleted: false,
      userId: { notIn: [BLOCKED_A, BLOCKED_B] },
    });
  });
});

describe("GET /api/users/:id/productList", () => {
  const SELLER = 3;

  it("다른 사람의 프로필에서는 숨김·삭제 상품을 목록·페이지 수 모두에서 뺀다", async () => {
    const res = await call(productListHandler, { query: { id: String(SELLER) }, user: viewer });

    expect(res.statusCode).toBe(200);
    const where = mockClient.product.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ userId: SELLER, isHidden: false, isDeleted: false });
    expect(mockClient.product.count.mock.calls[0][0].where).toEqual(where);
  });

  it("비로그인도 숨김·삭제 상품은 보지 못한다", async () => {
    await call(productListHandler, { query: { id: String(SELLER) } });

    expect(mockClient.product.findMany.mock.calls[0][0].where).toEqual({
      userId: SELLER,
      isHidden: false,
      isDeleted: false,
    });
  });

  it("본인 목록에는 숨김 상품은 보이고, 직접 삭제한 상품은 빠진다", async () => {
    await call(productListHandler, {
      query: { id: String(SELLER) },
      user: { id: SELLER, name: "판매자" } as NextApiRequest["user"],
    });

    expect(mockClient.product.findMany.mock.calls[0][0].where).toEqual({
      userId: SELLER,
      isDeleted: false,
    });
    expect(mockClient.product.count.mock.calls[0][0].where).toEqual({
      userId: SELLER,
      isDeleted: false,
    });
  });
});
