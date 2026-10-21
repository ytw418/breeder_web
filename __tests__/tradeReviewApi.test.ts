/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 거래 후기 API(앱 docs/prd/trade-review.md §4 C).
 * - 후기 자격: 분양자가 지정하고 입양 확정한 입양자만, 그 뒤 차단돼도 쓸 수 있다
 * - 글당 1개(409), 크루 403, 용품 글에 개체 키워드 400, 답글 한 번(409)
 * - 받은 후기 목록: 지운 분양글은 removed, 키워드 집계
 */

const mockClient = {
  product: { findUnique: jest.fn() },
  sale: { findFirst: jest.fn() },
  purchase: { findMany: jest.fn(), findFirst: jest.fn() },
  review: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  userBlock: { findMany: jest.fn() },
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
};
// 거래 lock 트랜잭션은 같은 모킹 클라이언트로 바로 돈다.
mockClient.$transaction.mockImplementation((fn: (tx: typeof mockClient) => unknown) => fn(mockClient));
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
const mockCreateNotification = jest.fn();
jest.mock("@libs/server/notification", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));
jest.mock("@libs/server/analytics", () => ({ captureServerEvent: jest.fn() }));

import reviewHandler from "../pages/api/products/[id]/review";
import replyHandler from "../pages/api/products/[id]/review/reply";
import userReviewsHandler from "../pages/api/users/[id]/reviews";

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

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: Partial<NextApiRequest>
) {
  const res = createRes();
  await handler(
    { headers: {}, query: { id: "3" }, body: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const SELLER = { id: 7, name: "분양자" } as NextApiRequest["user"];
const BUYER = { id: 8, name: "입양자" } as NextApiRequest["user"];
const CREW = { id: 120, name: "크루·크루" } as NextApiRequest["user"];

const reviewRow = (overrides: Record<string, unknown> = {}) => ({
  id: 11,
  keywords: ["healthy", "fast_reply"],
  reply: null,
  repliedAt: null,
  createdAt: new Date(Date.UTC(2026, 9, 21)),
  isHidden: false,
  productId: 3,
  createdById: 8,
  createdForId: 7,
  createdBy: { id: 8, name: "입양자", avatar: null },
  ...overrides,
});

const postReview = (user: NextApiRequest["user"], keywords: unknown = ["healthy", "fast_reply"]) =>
  call(reviewHandler, { method: "POST", user, body: { keywords } });

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.product.findUnique.mockResolvedValue({
    id: 3,
    userId: 7,
    name: "크레 해칭",
    status: "판매완료",
    isDeleted: false,
    productType: "생물",
  });
  // 분양자가 입양자 8 을 지정했고, 8 이 입양 확정했다.
  mockClient.sale.findFirst.mockResolvedValue({ id: 1, buyerId: 8, buyerSource: "bredy" });
  mockClient.purchase.findMany.mockResolvedValue([{ userId: 8 }]);
  mockClient.purchase.findFirst.mockResolvedValue(null);
  mockClient.review.findFirst.mockResolvedValue(null);
  mockClient.review.create.mockImplementation(({ data }) => Promise.resolve(reviewRow({ keywords: data.keywords })));
  mockClient.user.findUnique.mockResolvedValue({ name: "입양자" });
  mockClient.userBlock.findMany.mockResolvedValue([]);
});

describe("POST /api/products/:id/review", () => {
  it("지정만 되고 입양 확정 전이면 403, 확정한 입양자는 분양자가 차단했어도 쓸 수 있다", async () => {
    mockClient.purchase.findMany.mockResolvedValueOnce([]);
    let res = await postReview(BUYER);
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("REVIEW_NOT_ALLOWED");
    expect(mockClient.review.create).not.toHaveBeenCalled();

    // 분양자가 입양자를 차단해도 자격은 입양 확정 때 정해졌으므로 막지 않는다(알림만 createNotification 이 억제).
    mockClient.userBlock.findMany.mockResolvedValue([{ blockerId: 7, blockedId: 8 }]);
    res = await postReview(BUYER, ["fast_reply", "healthy", "fast_reply"]);
    expect(res.statusCode).toBe(201);
    expect(mockClient.review.create.mock.calls[0][0].data).toMatchObject({
      productId: 3,
      createdById: 8,
      createdForId: 7,
      keywords: ["healthy", "fast_reply"],
    });
    expect(res.body.review).toMatchObject({ id: 11, author: { id: 8 }, reply: null });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TRADE_REVIEW_RECEIVED", userId: 7, senderId: 8, targetId: 3 })
    );
  });

  it("이 분양글에 후기가 이미 있으면 409", async () => {
    mockClient.review.findFirst.mockResolvedValue({ id: 11, reply: null });
    const res = await postReview(BUYER);
    expect(res.statusCode).toBe(409);
    expect(res.body.errorCode).toBe("REVIEW_EXISTS");
    expect(mockClient.review.create).not.toHaveBeenCalled();
  });

  it("크루 계정은 403", async () => {
    const res = await postReview(CREW);
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("CREW_NOT_ALLOWED");
  });

  it("용품 분양글에 개체 키워드를 고르면 400", async () => {
    mockClient.product.findUnique.mockResolvedValue({
      id: 3,
      userId: 7,
      status: "판매완료",
      isDeleted: false,
      productType: "용품",
    });
    const res = await postReview(BUYER, ["healthy"]);
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("INVALID_KEYWORDS");
  });
});

describe("POST /api/products/:id/review/reply", () => {
  it("분양자는 한 번만 답글을 남기고, 두 번째는 409", async () => {
    mockClient.review.findFirst.mockResolvedValueOnce(reviewRow());
    mockClient.review.updateMany.mockResolvedValueOnce({ count: 1 });
    mockClient.review.findUnique.mockResolvedValueOnce(reviewRow({ reply: "감사해요", repliedAt: new Date() }));
    let res = await call(replyHandler, { method: "POST", user: SELLER, body: { text: " 감사해요 " } });
    expect(res.statusCode).toBe(200);
    expect(mockClient.review.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 11, reply: null },
      data: { reply: "감사해요" },
    });
    expect(res.body.review).toMatchObject({ reply: "감사해요" });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TRADE_REVIEW_REPLIED", userId: 8, senderId: 7 })
    );

    mockClient.review.findFirst.mockResolvedValueOnce(reviewRow({ reply: "감사해요" }));
    res = await call(replyHandler, { method: "POST", user: SELLER, body: { text: "또 감사해요" } });
    expect(res.statusCode).toBe(409);
    expect(res.body.errorCode).toBe("REPLY_EXISTS");
  });
});

describe("GET /api/users/:id/reviews", () => {
  it("지운 분양글은 이름·사진 없이 removed 로 주고, 키워드는 많은 순으로 센다", async () => {
    mockClient.review.count.mockResolvedValue(2);
    mockClient.review.findMany
      .mockResolvedValueOnce([
        reviewRow({ product: { id: 3, name: "크레 해칭", photos: ["img-1"], isDeleted: true } }),
        reviewRow({ id: 12, productId: 4, keywords: ["fast_reply"], product: { id: 4, name: "구피", photos: [], isDeleted: false } }),
      ])
      .mockResolvedValueOnce([{ keywords: ["healthy", "fast_reply"] }, { keywords: ["fast_reply"] }]);

    const res = await call(userReviewsHandler, { method: "GET", query: { id: "7" } });
    expect(res.statusCode).toBe(200);
    expect(mockClient.review.findMany.mock.calls[0][0].where).toEqual({
      createdForId: 7,
      isHidden: false,
      productId: { not: null },
      product: { isHidden: false },
    });
    expect(res.body.total).toBe(2);
    expect(res.body.items[0].product).toEqual({ id: 3, removed: true });
    expect(res.body.items[1].product).toEqual({ id: 4, name: "구피", image: null });
    expect(res.body.keywordCounts).toEqual([
      { key: "fast_reply", count: 2 },
      { key: "healthy", count: 1 },
    ]);
  });
});
