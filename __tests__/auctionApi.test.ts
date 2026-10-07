import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn() },
  auction: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  bid: { create: jest.fn() },
  bloodlineCard: { findFirst: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/auctionSettlement", () => ({
  settleExpiredAuctions: jest.fn(),
}));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: () => [],
}));
jest.mock("@libs/server/notification", () => ({
  createNotification: jest.fn(),
}));
jest.mock("@libs/server/growth", () => ({
  incrementUserMissionProgress: jest.fn(),
}));

import createHandler from "../pages/api/auctions/index";
import detailHandler from "../pages/api/auctions/[id]/index";
import bidHandler from "../pages/api/auctions/[id]/bid";
import { AUCTION_PHOTOS_MAX, AUCTION_PHOTOS_MIN } from "@libs/auctionRules";

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
    { headers: {}, query: {}, body: {}, cookies: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-01T03:00:00.000Z");
const me = { id: 7, name: "브리더" } as NextApiRequest["user"];
const baseBody = {
  title: "왕사슴 유충 경매",
  description: "건강한 3령 유충입니다.",
  photos: ["img-1"],
  category: "곤충",
  startPrice: 10000,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  mockClient.user.findUnique.mockResolvedValue({ status: "ACTIVE", phone: null, email: null });
  mockClient.auction.count.mockResolvedValue(0);
  mockClient.auction.findFirst.mockResolvedValue(null);
  mockClient.auction.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 11, ...data })
  );
  mockClient.auction.update.mockImplementation(({ data }) =>
    Promise.resolve({ id: 5, ...data })
  );
  mockClient.$transaction.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("POST /api/auctions 중복 등록 판정", () => {
  it("최근 중복 조회 조건에 종료 시각을 넣지 않는다(종료 시각만 다른 같은 경매도 중복)", async () => {
    await call(createHandler, {
      method: "POST",
      user: me,
      body: { ...baseBody, endAt: new Date(NOW.getTime() + 2 * HOUR).toISOString() },
    });
    expect(mockClient.auction.findFirst).toHaveBeenCalledTimes(1);
    const where = mockClient.auction.findFirst.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("endAt");
    expect(where).toMatchObject({
      userId: 7,
      title: baseBody.title,
      description: baseBody.description,
      startPrice: baseBody.startPrice,
      photos: { equals: baseBody.photos },
    });
    expect(where.createdAt.gte.getTime()).toBe(NOW.getTime() - 10 * 60 * 1000);
  });

  it("같은 내용이 최근에 있으면 409 AUCTION_DUPLICATE_RECENT", async () => {
    mockClient.auction.findFirst.mockResolvedValue({ id: 4 });
    const res = await call(createHandler, {
      method: "POST",
      user: me,
      body: { ...baseBody, endAt: new Date(NOW.getTime() + 2 * HOUR + 60_000).toISOString() },
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.errorCode).toBe("AUCTION_DUPLICATE_RECENT");
    expect(res.body.auctionId).toBe(4);
    expect(mockClient.auction.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auctions/:id (update) 기간 검사", () => {
  // 1시간 경매를 5분 전에 등록 → 남은 시간 55분
  const createdAt = new Date(NOW.getTime() - 5 * 60 * 1000);
  const existingEndAt = new Date(createdAt.getTime() + HOUR);

  beforeEach(() => {
    mockClient.auction.findUnique.mockResolvedValue({
      id: 5,
      userId: 7,
      status: "진행중",
      createdAt,
      endAt: existingEndAt,
      _count: { bids: 0 },
    });
  });

  const update = (body: Record<string, unknown>) =>
    call(detailHandler, {
      method: "POST",
      user: me,
      query: { id: "5" },
      body: { action: "update", ...baseBody, title: "제목만 수정", ...body },
    });

  it("endAt 을 생략하면 기간 검사를 건너뛰고 기존 종료 시각을 유지한다", async () => {
    const res = await update({});
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const data = mockClient.auction.update.mock.calls[0][0].data;
    expect(data.title).toBe("제목만 수정");
    expect(new Date(data.endAt).getTime()).toBe(existingEndAt.getTime());
  });

  it("endAt 이 기존 값과 같으면 기간 검사를 건너뛴다", async () => {
    const res = await update({ endAt: existingEndAt.toISOString() });
    expect(res.statusCode).toBe(200);
    const data = mockClient.auction.update.mock.calls[0][0].data;
    expect(new Date(data.endAt).getTime()).toBe(existingEndAt.getTime());
  });

  it("같은 시각을 다른 문자열 형식으로 보내도 밀리초 timestamp 가 같으면 같은 값으로 본다", async () => {
    // 2026-10-01T03:55:00.000Z 와 같은 시각을 밀리초 없이 표기
    const sameInstant = existingEndAt.toISOString().replace(".000Z", "Z");
    expect(sameInstant).not.toBe(existingEndAt.toISOString());
    const res = await update({ endAt: sameInstant });
    expect(res.statusCode).toBe(200);
  });

  it("기존 값과 1초라도 다르면 바뀐 것으로 보고 기간 검사를 한다", async () => {
    const res = await update({ endAt: new Date(existingEndAt.getTime() - 1000).toISOString() });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_DURATION_OUT_OF_RANGE_UPDATE");
    expect(mockClient.auction.update).not.toHaveBeenCalled();
  });

  it("종료 시각을 바꾸면 수정 시점 기준 1시간 미만은 거절한다", async () => {
    const res = await update({ endAt: new Date(NOW.getTime() + 50 * 60 * 1000).toISOString() });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_DURATION_OUT_OF_RANGE_UPDATE");
    expect(mockClient.auction.update).not.toHaveBeenCalled();
  });

  it("종료 시각을 바꾸면 수정 시점 기준 72시간 초과는 거절한다", async () => {
    const res = await update({ endAt: new Date(NOW.getTime() + 73 * HOUR).toISOString() });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_DURATION_OUT_OF_RANGE_UPDATE");
  });

  it("종료 시각을 범위 안으로 바꾸면 새 값으로 저장한다", async () => {
    const nextEndAt = new Date(NOW.getTime() + 3 * HOUR);
    const res = await update({ endAt: nextEndAt.toISOString() });
    expect(res.statusCode).toBe(200);
    const data = mockClient.auction.update.mock.calls[0][0].data;
    expect(new Date(data.endAt).getTime()).toBe(nextEndAt.getTime());
  });

  it("잘못된 endAt 은 400 AUCTION_INVALID_END_AT", async () => {
    const res = await update({ endAt: "not-a-date" });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_INVALID_END_AT");
  });
});

describe("경매 사진 장수(최소 1, 최대 10)", () => {
  const photos = (n: number) => Array.from({ length: n }, (_, i) => `img-${i + 1}`);
  const endAt = () => new Date(NOW.getTime() + 2 * HOUR).toISOString();
  const create = (count: number) =>
    call(createHandler, {
      method: "POST",
      user: me,
      body: { ...baseBody, photos: photos(count), endAt: endAt() },
    });
  const update = (count: number) =>
    call(detailHandler, {
      method: "POST",
      user: me,
      query: { id: "5" },
      body: { action: "update", ...baseBody, photos: photos(count) },
    });

  beforeEach(() => {
    const createdAt = new Date(NOW.getTime() - 5 * 60 * 1000);
    mockClient.auction.findUnique.mockResolvedValue({
      id: 5,
      userId: 7,
      status: "진행중",
      createdAt,
      endAt: new Date(createdAt.getTime() + HOUR),
      _count: { bids: 0 },
    });
  });

  it("상수: 최소 1장, 최대 10장", () => {
    expect(AUCTION_PHOTOS_MIN).toBe(1);
    expect(AUCTION_PHOTOS_MAX).toBe(10);
  });

  it.each([
    [0, 400],
    [1, 200],
    [10, 200],
    [11, 400],
  ])("등록 %p장 → %p", async (count, status) => {
    const res = await create(count);
    expect(res.statusCode).toBe(status);
    if (status === 400) expect(res.body.errorCode).toBe("AUCTION_INVALID_PHOTO_COUNT");
  });

  it.each([
    [0, 400],
    [10, 200],
    [11, 400],
  ])("수정 %p장 → %p", async (count, status) => {
    const res = await update(count);
    expect(res.statusCode).toBe(status);
    if (status === 400) expect(res.body.errorCode).toBe("AUCTION_INVALID_PHOTO_COUNT");
  });
});

describe("판매자가 정하는 입찰 단위", () => {
  const endAt = () => new Date(NOW.getTime() + 2 * HOUR).toISOString();
  const create = (body: Record<string, unknown>) =>
    call(createHandler, {
      method: "POST",
      user: me,
      body: { ...baseBody, startPrice: 50_000, endAt: endAt(), ...body },
    });
  const update = (body: Record<string, unknown>) =>
    call(detailHandler, {
      method: "POST",
      user: me,
      query: { id: "5" },
      body: { action: "update", ...baseBody, startPrice: 50_000, ...body },
    });

  beforeEach(() => {
    const createdAt = new Date(NOW.getTime() - 5 * 60 * 1000);
    mockClient.auction.findUnique.mockResolvedValue({
      id: 5,
      userId: 7,
      status: "진행중",
      createdAt,
      endAt: new Date(createdAt.getTime() + HOUR),
      minBidIncrement: 3_000,
      _count: { bids: 0 },
    });
  });

  it("등록: 보낸 입찰 단위로 저장한다(시작가 5만원이어도 1만원 강제 아님)", async () => {
    const res = await create({ minBidIncrement: 1_000 });
    expect(res.statusCode).toBe(200);
    expect(mockClient.auction.create.mock.calls[0][0].data.minBidIncrement).toBe(1_000);
  });

  it("등록: 보내지 않으면(구 앱) 시작가 구간 추천값으로 저장한다", async () => {
    const res = await create({});
    expect(res.statusCode).toBe(200);
    expect(mockClient.auction.create.mock.calls[0][0].data.minBidIncrement).toBe(10_000);
  });

  it.each([900, 1_050, 1_000_100, "abc"])(
    "등록: 허용 범위 밖 입찰 단위 %p 는 400 AUCTION_INVALID_BID_INCREMENT",
    async (value) => {
      const res = await create({ minBidIncrement: value });
      expect(res.statusCode).toBe(400);
      expect(res.body.errorCode).toBe("AUCTION_INVALID_BID_INCREMENT");
      expect(mockClient.auction.create).not.toHaveBeenCalled();
    }
  );

  it("수정: 보낸 입찰 단위로 바꾼다", async () => {
    const res = await update({ minBidIncrement: 5_000 });
    expect(res.statusCode).toBe(200);
    expect(mockClient.auction.update.mock.calls[0][0].data.minBidIncrement).toBe(5_000);
  });

  it("수정: 보내지 않으면(구 앱) 저장된 입찰 단위를 그대로 둔다", async () => {
    const res = await update({});
    expect(res.statusCode).toBe(200);
    expect(mockClient.auction.update.mock.calls[0][0].data).not.toHaveProperty("minBidIncrement");
  });

  it("수정: 허용 범위 밖이면 400 AUCTION_INVALID_BID_INCREMENT", async () => {
    const res = await update({ minBidIncrement: 500 });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_INVALID_BID_INCREMENT");
    expect(mockClient.auction.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/auctions/:id/bid 입찰 단위 검사", () => {
  const bid = (amount: number) =>
    call(bidHandler, { method: "POST", user: me, query: { id: "5" }, body: { amount } });

  beforeEach(() => {
    mockClient.auction.findUnique.mockResolvedValue({
      id: 5,
      userId: 99,
      title: "왕사슴 유충 경매",
      status: "진행중",
      endAt: new Date(NOW.getTime() + 2 * HOUR),
      currentPrice: 50_000,
      minBidIncrement: 1_000,
      bids: [],
    });
  });

  it("경매에 저장된 입찰 단위로 검사하고, 입찰해도 입찰 단위는 바꾸지 않는다", async () => {
    const res = await bid(51_000);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const data = mockClient.auction.update.mock.calls[0][0].data;
    expect(data.currentPrice).toBe(51_000);
    expect(data).not.toHaveProperty("minBidIncrement");
  });

  it("입찰 단위의 배수가 아니면 400 BID_AMOUNT_RULE_VIOLATION 과 정확한 최소가·단위 문구", async () => {
    const res = await bid(51_500);
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("BID_AMOUNT_RULE_VIOLATION");
    expect(res.body.error).toContain("51,000원");
    expect(res.body.error).toContain("1,000원 단위");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });
});
