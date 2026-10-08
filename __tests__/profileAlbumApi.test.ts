import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 사용자 앨범 API — 앱 docs/prd/profile.md AC-22~AC-25.
 * - POST /api/albums, GET /api/users/:id/albums, GET·POST·DELETE /api/albums/:id
 */

const mockTx = {
  $queryRaw: jest.fn(),
  post: { count: jest.fn() },
  profileAlbum: { count: jest.fn(), create: jest.fn() },
};
const mockClient = {
  post: { findMany: jest.fn(), count: jest.fn() },
  profileAlbum: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
jest.mock("@libs/server/adminAccess", () => ({
  isModeratorUser: (user?: { role?: string } | null) => user?.role === "ADMIN",
}));

import createHandler from "../pages/api/albums/index";
import albumHandler from "../pages/api/albums/[id]";
import userAlbumsHandler from "../pages/api/users/[id]/albums";
import { normalizeAlbumPostIds, normalizeAlbumTitle } from "../libs/shared/profile";

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

const OWNER = 1;
const asUser = (id: number, role = "USER") => ({ id, name: "u", role }) as unknown as NextApiRequest["user"];
const day = (d: number) => new Date(Date.UTC(2026, 9, d));
const post = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: `글${id}`,
  description: "",
  image: `img-${id}`,
  images: [`img-${id}`],
  category: "자랑",
  type: "사슴벌레",
  createdAt: day(1),
  profilePinnedAt: null,
  isHidden: false,
  _count: { comments: 0, Likes: 0 },
  ...extra,
});
const photoWhere = (userId: number, hidden: boolean) => ({
  userId,
  NOT: { category: "공지" },
  ...(hidden ? {} : { isHidden: false }),
  OR: [{ images: { isEmpty: false } }, { image: { not: "" } }],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockTx.post.count.mockImplementation(async ({ where }: { where: { id: { in: number[] } } }) => where.id.in.length);
  mockTx.profileAlbum.count.mockResolvedValue(0);
  mockTx.profileAlbum.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 9, createdAt: day(8), ...data }));
  mockClient.post.count.mockImplementation(async ({ where }: { where: { id: { in: number[] } } }) => where.id.in.length);
  mockClient.post.findMany.mockResolvedValue([]);
});

describe("앨범 입력 정규화", () => {
  it("이름은 공백을 접고 앞뒤를 지운 뒤 1~12자(이모지 1자)", () => {
    expect(normalizeAlbumTitle("  올해   우화  ")).toBe("올해 우화");
    expect(normalizeAlbumTitle("가".repeat(12))).toBe("가".repeat(12));
    expect(normalizeAlbumTitle("가".repeat(13))).toBeNull();
    expect(normalizeAlbumTitle("🪲".repeat(12))).toBe("🪲".repeat(12));
    expect(normalizeAlbumTitle("   ")).toBeNull();
    expect(normalizeAlbumTitle(3)).toBeNull();
  });

  it("글 id 는 정수만, 처음 나온 순서를 지켜 중복을 뺀다", () => {
    expect(normalizeAlbumPostIds([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
    expect(normalizeAlbumPostIds([1, "2"])).toBeNull();
    expect(normalizeAlbumPostIds([0])).toBeNull();
    expect(normalizeAlbumPostIds("1,2")).toBeNull();
  });
});

describe("POST /api/albums (AC-22)", () => {
  const create = (body: unknown, user = asUser(OWNER)) =>
    call(createHandler, { method: "POST", body: body as NextApiRequest["body"], user });

  it("비로그인은 401", async () => {
    const res = await call(createHandler, { method: "POST", body: { title: "a", postIds: [1] } });
    expect(res.statusCode).toBe(401);
  });

  it("이름이 비었거나 13자 이상이면 400 ALBUM_TITLE_INVALID", async () => {
    expect((await create({ title: " ", postIds: [1] })).body.errorCode).toBe("ALBUM_TITLE_INVALID");
    const res = await create({ title: "가".repeat(13), postIds: [1] });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("ALBUM_TITLE_INVALID");
  });

  it("사진 0장·31장·남의 글이 섞이면 400 ALBUM_POSTS_INVALID", async () => {
    expect((await create({ title: "a", postIds: [] })).body.errorCode).toBe("ALBUM_POSTS_INVALID");
    const many = Array.from({ length: 31 }, (_, i) => i + 1);
    expect((await create({ title: "a", postIds: many })).body.errorCode).toBe("ALBUM_POSTS_INVALID");
    mockTx.post.count.mockResolvedValue(1); // 2개 중 1개만 내 사진 글
    const res = await create({ title: "a", postIds: [1, 2] });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("ALBUM_POSTS_INVALID");
    expect(mockTx.profileAlbum.create).not.toHaveBeenCalled();
  });

  it("이미 10개면 409 ALBUM_LIMIT", async () => {
    mockTx.profileAlbum.count.mockResolvedValue(10);
    const res = await create({ title: "a", postIds: [1] });
    expect(res.statusCode).toBe(409);
    expect(res.body.errorCode).toBe("ALBUM_LIMIT");
  });

  it("작성자 행을 잠그고, 내 사진 글(숨김 허용)인지 확인한 뒤 중복을 뺀 순서로 만든다", async () => {
    const res = await create({ title: " 올해 우화 ", postIds: [5, 3, 5] });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockTx.post.count).toHaveBeenCalledWith({ where: { ...photoWhere(OWNER, true), id: { in: [5, 3] } } });
    expect(mockTx.profileAlbum.create.mock.calls[0][0].data).toEqual({ userId: OWNER, title: "올해 우화", postIds: [5, 3] });
  });
});

describe("GET /api/users/:id/albums (AC-23)", () => {
  beforeEach(() => {
    mockClient.profileAlbum.findMany.mockResolvedValue([
      { id: 2, title: "최근", postIds: [11, 10] },
      { id: 1, title: "빈 앨범", postIds: [99] },
    ]);
    mockClient.post.findMany.mockResolvedValue([post(10), post(11, { images: [], image: "img-11" })]);
  });

  it("최근 만든 순, 표지는 넣은 순서 첫 사진, 남이 볼 때 0장 앨범은 뺀다", async () => {
    const res = await call(userAlbumsHandler, { query: { id: String(OWNER) } });
    expect(mockClient.profileAlbum.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(mockClient.post.findMany.mock.calls[0][0].where).toEqual({ ...photoWhere(OWNER, false), id: { in: [11, 10, 99] } });
    expect(res.body.albums).toEqual([{ id: 2, title: "최근", cover: "img-11", count: 2 }]);
  });

  it("주인에게는 빈 앨범도 보이고 숨김 글도 센다", async () => {
    const res = await call(userAlbumsHandler, { query: { id: String(OWNER) }, user: asUser(OWNER) });
    expect(mockClient.post.findMany.mock.calls[0][0].where.isHidden).toBeUndefined();
    expect(res.body.albums).toEqual([
      { id: 2, title: "최근", cover: "img-11", count: 2 },
      { id: 1, title: "빈 앨범", cover: "", count: 0 },
    ]);
  });
});

describe("/api/albums/:id (AC-24, AC-25)", () => {
  const album = { id: 7, title: "올해 우화", userId: OWNER, postIds: [3, 1], createdAt: day(2), user: { id: OWNER, name: "도토리" } };

  beforeEach(() => {
    mockClient.profileAlbum.findUnique.mockResolvedValue({ ...album });
    mockClient.post.findMany.mockResolvedValue([post(1), post(3)]);
    mockClient.profileAlbum.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...album, ...data }));
  });

  it("GET: 넣은 순서대로 보이는 사진 글, 없는 앨범은 404", async () => {
    const res = await call(albumHandler, { query: { id: "7" } });
    expect(res.statusCode).toBe(200);
    expect(res.body.album).toMatchObject({ id: 7, title: "올해 우화", user: { id: OWNER } });
    expect(res.body.album.postIds).toBeUndefined();
    expect(res.body.posts.map((p: { id: number }) => p.id)).toEqual([3, 1]);

    mockClient.profileAlbum.findUnique.mockResolvedValue(null);
    expect((await call(albumHandler, { query: { id: "8" } })).statusCode).toBe(404);
  });

  it("POST: 비로그인 401, 남의 앨범 403 NOT_ALBUM_OWNER", async () => {
    expect((await call(albumHandler, { method: "POST", query: { id: "7" }, body: { title: "x" } })).statusCode).toBe(401);
    const res = await call(albumHandler, { method: "POST", query: { id: "7" }, body: { title: "x" }, user: asUser(2) });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("NOT_ALBUM_OWNER");
    expect(mockClient.profileAlbum.update).not.toHaveBeenCalled();
  });

  it("POST: 주인은 이름·사진을 바꾸고, 잘못된 값은 400", async () => {
    const bad = await call(albumHandler, { method: "POST", query: { id: "7" }, body: { title: "" }, user: asUser(OWNER) });
    expect(bad.body.errorCode).toBe("ALBUM_TITLE_INVALID");
    mockClient.post.count.mockResolvedValueOnce(0);
    const badPosts = await call(albumHandler, { method: "POST", query: { id: "7" }, body: { postIds: [42] }, user: asUser(OWNER) });
    expect(badPosts.body.errorCode).toBe("ALBUM_POSTS_INVALID");

    const res = await call(albumHandler, {
      method: "POST",
      query: { id: "7" },
      body: { title: "새 이름", postIds: [1] },
      user: asUser(OWNER),
    });
    expect(res.statusCode).toBe(200);
    expect(mockClient.profileAlbum.update.mock.calls[0][0]).toMatchObject({ where: { id: 7 }, data: { title: "새 이름", postIds: [1] } });
  });

  it("DELETE: 남은 403, 주인은 지운다", async () => {
    expect((await call(albumHandler, { method: "DELETE", query: { id: "7" }, user: asUser(2) })).statusCode).toBe(403);
    expect(mockClient.profileAlbum.delete).not.toHaveBeenCalled();
    const res = await call(albumHandler, { method: "DELETE", query: { id: "7" }, user: asUser(OWNER) });
    expect(res.body).toEqual({ success: true });
    expect(mockClient.profileAlbum.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });
});
