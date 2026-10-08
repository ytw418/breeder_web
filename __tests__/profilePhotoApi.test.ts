import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 프로필 사진형(A안) API — 앱 docs/prd/profile.md AC-1, AC-6~AC-9.
 * - GET /api/users/:id : bio · topSpecies · _count.auctions
 * - GET /api/users/:id/posts?media=photo&species= : 사진 글만, 고정 우선
 * - GET /api/users/:id/photo-albums : 종별 자동 앨범
 * - POST /api/posts/:id/profile-pin : 프로필 고정(최대 3, 멱등)
 */

const mockTx = {
  $queryRaw: jest.fn(),
  post: { count: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
};
const mockClient = {
  user: { findUnique: jest.fn() },
  follow: { findFirst: jest.fn() },
  userBlock: { findFirst: jest.fn(), findMany: jest.fn() },
  userBadge: { findMany: jest.fn() },
  post: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  product: { groupBy: jest.fn() },
  // 프로필 보유 혈통 수(countProfileBloodlineCards)
  bloodlineCard: { findMany: jest.fn(async () => []) },
  $transaction: jest.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
jest.mock("@libs/server/adminAccess", () => ({
  isModeratorUser: (user?: { role?: string } | null) => user?.role === "ADMIN",
}));
jest.mock("@libs/server/breeder-programs", () => ({
  getSortedActiveBreederProgramSummaries: () => [],
  getActiveBreederProgramsByUserId: () => Promise.resolve([]),
}));

import userDetailHandler from "../pages/api/users/[id]/index";
import userPostsHandler from "../pages/api/users/[id]/posts";
import photoAlbumsHandler from "../pages/api/users/[id]/photo-albums";
import profilePinHandler from "../pages/api/posts/[id]/profile-pin";

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

const asUser = (id: number, role = "USER") => ({ id, name: "u", role }) as unknown as NextApiRequest["user"];
const OWNER = 1;
const day = (d: number) => new Date(Date.UTC(2026, 9, d));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockClient.follow.findFirst.mockResolvedValue(null);
  mockClient.userBlock.findFirst.mockResolvedValue(null);
  mockClient.userBlock.findMany.mockResolvedValue([]);
  mockClient.userBadge.findMany.mockResolvedValue([]);
  mockClient.post.groupBy.mockResolvedValue([]);
  mockClient.product.groupBy.mockResolvedValue([]);
  mockClient.post.findMany.mockResolvedValue([]);
  mockClient.post.count.mockResolvedValue(0);
});

const baseUser = {
  id: OWNER,
  name: "도토리",
  email: "a@b.com",
  avatar: null,
  snsId: "s",
  phone: null,
  _count: {
    followers: 3,
    following: 5,
    products: 1,
    posts: 2,
    Comments: 0,
    insectRecords: 0,
    receivedReviews: 0,
    createdBloodlineCards: 0,
    ownedBloodlineCards: 0,
    auctions: 4,
  },
};

describe("GET /api/users/:id — bio·topSpecies·경매 수 (AC-1)", () => {
  it("bio 와 _count.auctions(숨김 제외)를 내려준다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ ...baseUser, bio: "왕사슴 키워요" });
    const res = await call(userDetailHandler, { query: { id: String(OWNER) } });
    expect(res.statusCode).toBe(200);
    expect(res.body.user.bio).toBe("왕사슴 키워요");
    expect(res.body.user._count.auctions).toBe(4);
    const select = mockClient.user.findUnique.mock.calls[0][0].include._count.select;
    expect(select.auctions).toEqual({ where: { isHidden: false } });
  });

  it("소개가 없으면 bio 는 null", async () => {
    mockClient.user.findUnique.mockResolvedValue({ ...baseUser, bio: null });
    const res = await call(userDetailHandler, { query: { id: String(OWNER) } });
    expect(res.body.user.bio).toBeNull();
  });

  it("topSpecies 는 게시글 종 + 상품 카테고리를 합쳐 많은 순 2개", async () => {
    mockClient.user.findUnique.mockResolvedValue({ ...baseUser, bio: null });
    mockClient.post.groupBy.mockResolvedValue([
      { type: "사슴벌레", _count: { _all: 2 }, _max: { createdAt: day(1) } },
      { type: "community", _count: { _all: 9 }, _max: { createdAt: day(1) } },
      { type: null, _count: { _all: 9 }, _max: { createdAt: day(1) } },
      { type: "사마귀", _count: { _all: 1 }, _max: { createdAt: day(9) } },
    ]);
    mockClient.product.groupBy.mockResolvedValue([
      { category: "장수풍뎅이", _count: { _all: 2 }, _max: { createdAt: day(3) } },
      { category: "사슴벌레", _count: { _all: 1 }, _max: { createdAt: day(2) } },
    ]);
    const res = await call(userDetailHandler, { query: { id: String(OWNER) } });
    expect(res.body.user.topSpecies).toEqual(["사슴벌레", "장수풍뎅이"]);

    const postWhere = mockClient.post.groupBy.mock.calls[0][0].where;
    expect(postWhere).toEqual({ userId: OWNER, isHidden: false, NOT: { category: "공지" } });
    const productWhere = mockClient.product.groupBy.mock.calls[0][0].where;
    expect(productWhere).toEqual({ userId: OWNER, isDeleted: false, isHidden: false });
  });

  it("팔로워·팔로잉 수 스왑(#139)은 그대로다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ ...baseUser, bio: null });
    const res = await call(userDetailHandler, { query: { id: String(OWNER) } });
    expect(res.body.user._count.followers).toBe(5);
    expect(res.body.user._count.following).toBe(3);
  });
});

describe("GET /api/users/:id/posts?media=photo (AC-6, AC-9)", () => {
  const findManyArgs = () => mockClient.post.findMany.mock.calls[0][0];

  it("사진 있는 글만, 고정 글을 먼저(nulls last) 정렬한다", async () => {
    await call(userPostsHandler, { query: { id: String(OWNER), media: "photo" } });
    const { where, orderBy, select } = findManyArgs();
    expect(where).toEqual({
      userId: OWNER,
      NOT: { category: "공지" },
      isHidden: false,
      OR: [{ images: { isEmpty: false } }, { image: { not: "" } }],
    });
    expect(orderBy).toEqual([
      { profilePinnedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(select).toMatchObject({ profilePinnedAt: true, type: true });
    expect(mockClient.post.count.mock.calls[0][0].where).toEqual(where);
  });

  it("작성자 본인은 숨김 글도 사진 탭에서 본다", async () => {
    await call(userPostsHandler, {
      query: { id: String(OWNER), media: "photo" },
      user: asUser(OWNER),
    });
    expect(findManyArgs().where.isHidden).toBeUndefined();
  });

  it("species 를 주면 그 종 사진만", async () => {
    await call(userPostsHandler, {
      query: { id: String(OWNER), media: "photo", species: "사슴벌레" },
    });
    expect(findManyArgs().where.type).toBe("사슴벌레");
  });

  it("media 가 없으면 기존처럼 모든 글을 최신순(고정 미적용)", async () => {
    await call(userPostsHandler, { query: { id: String(OWNER) } });
    const { where, orderBy } = findManyArgs();
    expect(where.OR).toBeUndefined();
    expect(orderBy).toEqual([{ createdAt: "desc" }]);
  });

  it("응답 행에 profilePinnedAt 이 있고 images 는 구 데이터면 image 로 채운다", async () => {
    mockClient.post.findMany.mockResolvedValue([
      {
        id: 5,
        title: "t",
        description: "d",
        image: "img-a",
        images: [],
        category: "자유",
        type: "사슴벌레",
        createdAt: day(1),
        profilePinnedAt: day(2),
        isHidden: false,
        _count: { comments: 0, Likes: 0 },
      },
    ]);
    mockClient.post.count.mockResolvedValue(1);
    const res = await call(userPostsHandler, { query: { id: String(OWNER), media: "photo" } });
    expect(res.body.posts[0]).toMatchObject({ images: ["img-a"], profilePinnedAt: day(2) });
    expect(res.body.pages).toBe(1);
  });
});

describe("GET /api/users/:id/photo-albums (AC-8)", () => {
  it("종별 사진 글 수 많은 순, 표지는 그 종 최신 사진", async () => {
    mockClient.post.groupBy.mockResolvedValue([
      { type: "사마귀", _count: { _all: 1 }, _max: { createdAt: day(5) } },
      { type: "사슴벌레", _count: { _all: 3 }, _max: { createdAt: day(1) } },
      { type: "general", _count: { _all: 7 }, _max: { createdAt: day(1) } },
    ]);
    mockClient.post.findFirst.mockImplementation(async ({ where }: { where: { type: string } }) =>
      where.type === "사슴벌레" ? { image: "old", images: ["cover-a", "x"] } : { image: "cover-b", images: [] }
    );
    const res = await call(photoAlbumsHandler, { query: { id: String(OWNER) } });
    expect(res.statusCode).toBe(200);
    expect(res.body.albums).toEqual([
      { species: "사슴벌레", count: 3, cover: "cover-a" },
      { species: "사마귀", count: 1, cover: "cover-b" },
    ]);
    const groupWhere = mockClient.post.groupBy.mock.calls[0][0].where;
    expect(groupWhere).toMatchObject({
      userId: OWNER,
      NOT: { category: "공지" },
      isHidden: false,
      type: { not: null },
      OR: [{ images: { isEmpty: false } }, { image: { not: "" } }],
    });
    expect(mockClient.post.findFirst.mock.calls[0][0].orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("작성자 본인이 보면 숨김 글도 센다", async () => {
    await call(photoAlbumsHandler, { query: { id: String(OWNER) }, user: asUser(OWNER) });
    expect(mockClient.post.groupBy.mock.calls[0][0].where.isHidden).toBeUndefined();
  });

  it("숫자가 아닌 id 는 404", async () => {
    const res = await call(photoAlbumsHandler, { query: { id: "abc" } });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/posts/:id/profile-pin (AC-7)", () => {
  const pin = (body: unknown, user = asUser(OWNER), id = "10") =>
    call(profilePinHandler, { method: "POST", query: { id }, body, user });
  const photoPost = {
    id: 10,
    userId: OWNER,
    image: "img",
    images: ["img"],
    category: "자유",
    profilePinnedAt: null as Date | null,
  };

  beforeEach(() => {
    mockClient.post.findUnique.mockResolvedValue({ ...photoPost });
    mockTx.post.findUnique.mockResolvedValue({ profilePinnedAt: null });
    mockTx.post.count.mockResolvedValue(0);
    mockTx.post.update.mockResolvedValue({ profilePinnedAt: day(8) });
  });

  it("비로그인은 401", async () => {
    const res = await call(profilePinHandler, {
      method: "POST",
      query: { id: "10" },
      body: { pinned: true },
    });
    expect(res.statusCode).toBe(401);
  });

  it("pinned 가 boolean 이 아니면 400", async () => {
    const res = await pin({ pinned: "yes" });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("INVALID_PINNED");
  });

  it("없는 글은 404", async () => {
    mockClient.post.findUnique.mockResolvedValue(null);
    const res = await pin({ pinned: true });
    expect(res.statusCode).toBe(404);
  });

  it("남의 글은 403 NOT_POST_OWNER", async () => {
    const res = await pin({ pinned: true }, asUser(2));
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("NOT_POST_OWNER");
  });

  it("사진 없는 글·공지는 400 POST_NOT_PINNABLE", async () => {
    mockClient.post.findUnique.mockResolvedValue({ ...photoPost, image: "", images: [] });
    expect((await pin({ pinned: true })).body.errorCode).toBe("POST_NOT_PINNABLE");
    mockClient.post.findUnique.mockResolvedValue({ ...photoPost, category: "공지" });
    const res = await pin({ pinned: true });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("POST_NOT_PINNABLE");
  });

  it("이미 3개 고정이면 409 PROFILE_PIN_LIMIT", async () => {
    mockTx.post.count.mockResolvedValue(3);
    const res = await pin({ pinned: true });
    expect(res.statusCode).toBe(409);
    expect(res.body.errorCode).toBe("PROFILE_PIN_LIMIT");
    expect(mockTx.post.update).not.toHaveBeenCalled();
  });

  it("고정하면 작성자 행을 잠그고 세서 profilePinnedAt 을 저장한다", async () => {
    const res = await pin({ pinned: true });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, pinned: true, profilePinnedAt: day(8).toISOString() });
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
    // 사진 없는(고정 뒤 사진을 지운) 글·공지는 한도에 세지 않는다.
    expect(mockTx.post.count).toHaveBeenCalledWith({
      where: {
        userId: OWNER,
        NOT: { category: "공지" },
        OR: [{ images: { isEmpty: false } }, { image: { not: "" } }],
        profilePinnedAt: { not: null },
      },
    });
    expect(mockTx.post.update.mock.calls[0][0].where).toEqual({ id: 10 });
  });

  it("잠금을 기다리는 사이 같은 글이 먼저 고정됐으면 409 가 아니라 그 값으로 200", async () => {
    mockTx.post.findUnique.mockResolvedValue({ profilePinnedAt: day(3) });
    mockTx.post.count.mockResolvedValue(3);
    const res = await pin({ pinned: true });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, pinned: true, profilePinnedAt: day(3).toISOString() });
    expect(mockTx.post.update).not.toHaveBeenCalled();
  });

  it("이미 고정된 글을 다시 고정하면 그대로 200(멱등)", async () => {
    mockClient.post.findUnique.mockResolvedValue({ ...photoPost, profilePinnedAt: day(1) });
    const res = await pin({ pinned: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.profilePinnedAt).toBe(day(1).toISOString());
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("해제하면 null 로 저장하고, 원래 해제 상태면 저장하지 않는다", async () => {
    mockClient.post.findUnique.mockResolvedValue({ ...photoPost, profilePinnedAt: day(1) });
    const res = await pin({ pinned: false });
    expect(res.body).toEqual({ success: true, pinned: false, profilePinnedAt: null });
    expect(mockClient.post.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { profilePinnedAt: null },
    });

    mockClient.post.update.mockClear();
    mockClient.post.findUnique.mockResolvedValue({ ...photoPost, profilePinnedAt: null });
    const again = await pin({ pinned: false });
    expect(again.statusCode).toBe(200);
    expect(mockClient.post.update).not.toHaveBeenCalled();
  });
});
