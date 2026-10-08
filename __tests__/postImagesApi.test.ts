import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  // 카테고리 고정 범위 헬퍼(libs/server/categories)가 읽는 트리. 비우면 범위 조건을 붙이지 않는다.
  category: { findMany: jest.fn(async () => []) },
  post: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  like: { findFirst: jest.fn() },
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
import postDetailHandler from "../pages/api/posts/[id]/index";
import noticesHandler from "../pages/api/posts/notices";
import userPostsHandler from "../pages/api/users/[id]/posts";
import { POST_IMAGES_MAX, resolvePostImagesInput, withPostImages } from "@libs/postImages";

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

const me = { id: 7, name: "브리더" } as NextApiRequest["user"];
const ids = (n: number) => Array.from({ length: n }, (_, i) => `cf-${i + 1}`);
const baseBody = { title: "제목", description: "내용", category: "자유" };

const dbPost = (patch: Record<string, unknown>) => ({
  id: 1,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  userId: 7,
  title: "제목",
  description: "내용",
  category: "자유",
  type: null,
  latitude: null,
  longitude: null,
  image: "",
  images: [],
  user: { id: 7, name: "브리더", avatar: null, breederPrograms: [] },
  comments: [],
  _count: { comments: 0, Likes: 0 },
  ...patch,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.post.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 1, ...data })
  );
  mockClient.user.findUnique.mockResolvedValue(null);
  mockClient.post.count.mockResolvedValue(1);
  mockClient.post.findFirst.mockResolvedValue(null);
  mockClient.like.findFirst.mockResolvedValue(null);
});

describe("libs/postImages", () => {
  it("최대 10장", () => {
    expect(POST_IMAGES_MAX).toBe(10);
  });

  it.each([
    [{ images: ids(3) }, { image: "cf-1", images: ids(3) }],
    [{ images: ids(3), image: "other" }, { image: "cf-1", images: ids(3) }],
    [{ images: [] }, { image: "", images: [] }],
    [{ image: "legacy" }, { image: "legacy", images: ["legacy"] }],
    [{ image: "" }, { image: "", images: [] }],
    [{}, { image: "", images: [] }],
    [{ images: null, image: "legacy" }, { image: "legacy", images: ["legacy"] }],
  ])("입력 정규화 %#", (input, expected) => {
    expect(resolvePostImagesInput(input)).toEqual({ ok: true, ...expected });
  });

  it("11장은 POST_TOO_MANY_IMAGES", () => {
    expect(resolvePostImagesInput({ images: ids(11) })).toMatchObject({
      ok: false,
      errorCode: "POST_TOO_MANY_IMAGES",
    });
  });

  it.each([["cf-1"], [[1]], [[""]]])("잘못된 images 는 POST_INVALID_IMAGES %#", (images) => {
    expect(resolvePostImagesInput({ images })).toMatchObject({
      ok: false,
      errorCode: "POST_INVALID_IMAGES",
    });
  });

  it.each([
    [{ image: "a", images: [] }, ["a"]],
    [{ image: "", images: [] }, []],
    [{ image: "a", images: ["a", "b"] }, ["a", "b"]],
    [{ image: "a" }, ["a"]],
    [{ image: null, images: undefined }, []],
  ])("응답 보정 %#", (post, images) => {
    expect(withPostImages(post as { image?: string | null; images?: string[] | null }).images).toEqual(images);
  });
});

describe("POST /api/posts images", () => {
  const create = (body: Record<string, unknown>) =>
    call(postsHandler, { method: "POST", user: me, body: { ...baseBody, ...body } });

  it("images 10장은 저장하고 image 는 첫 장", async () => {
    const res = await create({ images: ids(10) });
    expect(res.statusCode).toBe(200);
    const data = mockClient.post.create.mock.calls[0][0].data;
    expect(data.images).toEqual(ids(10));
    expect(data.image).toBe("cf-1");
    expect(res.body.post.images).toEqual(ids(10));
    expect(res.body.post.image).toBe("cf-1");
  });

  it("images 11장은 400 POST_TOO_MANY_IMAGES, 저장하지 않는다", async () => {
    const res = await create({ images: ids(11) });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe("POST_TOO_MANY_IMAGES");
    expect(mockClient.post.create).not.toHaveBeenCalled();
  });

  it("웹 호환: image 만 보내면 image 그대로, images = [image]", async () => {
    const res = await create({ image: "legacy" });
    expect(res.statusCode).toBe(200);
    const data = mockClient.post.create.mock.calls[0][0].data;
    expect(data.image).toBe("legacy");
    expect(data.images).toEqual(["legacy"]);
  });

  it("웹 호환: 사진 없이 작성하면 image '' · images []", async () => {
    const res = await create({});
    expect(res.statusCode).toBe(200);
    const data = mockClient.post.create.mock.calls[0][0].data;
    expect(data.image).toBe("");
    expect(data.images).toEqual([]);
  });
});

describe("게시글 응답 images 보정", () => {
  it("목록: 구 데이터는 [image], 새 데이터는 images 그대로, image 필드 유지", async () => {
    mockClient.post.findMany.mockResolvedValue([
      dbPost({ id: 1, image: "legacy", images: [] }),
      dbPost({ id: 2, image: "cf-1", images: ["cf-1", "cf-2"] }),
      dbPost({ id: 3, image: "", images: [] }),
    ]);
    const res = await call(postsHandler, { method: "GET", query: {} });
    expect(res.statusCode).toBe(200);
    const posts = res.body.posts;
    expect(posts.map((p: any) => p.images)).toEqual([["legacy"], ["cf-1", "cf-2"], []]);
    expect(posts.map((p: any) => p.image)).toEqual(["legacy", "cf-1", ""]);
  });

  it("상세: 구 데이터는 [image]", async () => {
    mockClient.post.findUnique.mockResolvedValue(dbPost({ image: "legacy", images: [] }));
    const res = await call(postDetailHandler, { method: "GET", query: { id: "1" } });
    expect(res.statusCode).toBe(200);
    expect(res.body.post.images).toEqual(["legacy"]);
    expect(res.body.post.image).toBe("legacy");
  });

  it("상세: 새 데이터는 images 그대로", async () => {
    mockClient.post.findUnique.mockResolvedValue(
      dbPost({ image: "cf-1", images: ["cf-1", "cf-2", "cf-3"] })
    );
    const res = await call(postDetailHandler, { method: "GET", query: { id: "1" } });
    expect(res.body.post.images).toEqual(["cf-1", "cf-2", "cf-3"]);
  });

  it("공지 목록도 images 를 포함한다", async () => {
    mockClient.post.findMany.mockResolvedValue([dbPost({ image: "legacy", images: [] })]);
    const res = await call(noticesHandler, { method: "GET", query: {} });
    expect(res.body.posts[0].images).toEqual(["legacy"]);
  });

  it("사용자 게시글 목록도 images 를 조회·포함한다", async () => {
    mockClient.post.findMany.mockResolvedValue([
      { id: 1, title: "t", description: "d", image: "legacy", images: [], category: null },
    ]);
    const res = await call(userPostsHandler, { method: "GET", query: { id: "7" } });
    expect(mockClient.post.findMany.mock.calls[0][0].select.images).toBe(true);
    expect(res.body.posts[0].images).toEqual(["legacy"]);
  });
});
