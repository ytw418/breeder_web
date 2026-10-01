import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  post: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
const other = { id: 8, name: "다른사람" } as NextApiRequest["user"];

const storedPost = {
  id: 1,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  userId: 7,
  title: "원래 제목",
  description: "원래 내용",
  category: "자유",
  type: null,
  latitude: null,
  longitude: null,
  image: "cf-old",
  images: ["cf-old"],
};

const updateBody = {
  action: "update",
  title: "  새 제목  ",
  description: "  새 내용  ",
  category: "정보",
  species: "장수풍뎅이",
  images: ["cf-old", "cf-new-1", "cf-new-2"],
};

const mutate = (
  body: Record<string, unknown>,
  { user = me, id = "1-원래-제목" }: { user?: NextApiRequest["user"] | null; id?: string } = {}
) =>
  call(postDetailHandler, {
    method: "POST",
    query: { id },
    user: user ?? undefined,
    body,
  });

const expectError = (
  res: Awaited<ReturnType<typeof call>>,
  status: number,
  errorCode: string,
  message?: string
) => {
  expect(res.statusCode).toBe(status);
  expect(res.body.success).toBe(false);
  expect(res.body.errorCode).toBe(errorCode);
  expect(typeof res.body.message).toBe("string");
  expect(res.body.error).toBe(res.body.message);
  if (message) expect(res.body.message).toBe(message);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.post.findUnique.mockResolvedValue(storedPost);
  mockClient.post.findFirst.mockResolvedValue(null);
  mockClient.post.update.mockImplementation(({ where, data }) =>
    Promise.resolve({ ...storedPost, id: where.id, ...data })
  );
  mockClient.post.delete.mockResolvedValue(storedPost);
  mockClient.post.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 2, ...data })
  );
  mockClient.user.findUnique.mockResolvedValue({ role: "USER", name: "브리더" });
  mockClient.like.findFirst.mockResolvedValue(null);
});

describe("POST /api/posts/:id 공통 검사", () => {
  it("비로그인은 401 POST_AUTH_REQUIRED, 수정·삭제하지 않는다", async () => {
    const res = await mutate({ action: "delete" }, { user: null });
    expectError(res, 401, "POST_AUTH_REQUIRED", "로그인이 필요합니다.");
    expect(mockClient.post.delete).not.toHaveBeenCalled();
    expect(mockClient.post.update).not.toHaveBeenCalled();
  });

  it("잘못된 id 는 400 (기존 문구)", async () => {
    const res = await mutate({ action: "delete" }, { id: "abc" });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("유효하지 않은 게시글 ID입니다.");
    expect(res.body.error).toBe("유효하지 않은 게시글 ID입니다.");
    expect(mockClient.post.findUnique).not.toHaveBeenCalled();
  });

  it("slug 포함 경로의 id 를 파싱한다", async () => {
    await mutate({ action: "delete" }, { id: "1-원래-제목" });
    expect(mockClient.post.findUnique.mock.calls[0][0].where).toEqual({ id: 1 });
  });

  it("없는 글은 404 POST_NOT_FOUND", async () => {
    mockClient.post.findUnique.mockResolvedValue(null);
    const res = await mutate(updateBody);
    expectError(res, 404, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.");
    expect(mockClient.post.update).not.toHaveBeenCalled();
  });

  it("남의 글 update 는 403 POST_FORBIDDEN", async () => {
    const res = await mutate(updateBody, { user: other });
    expectError(res, 403, "POST_FORBIDDEN", "본인 게시글만 수정·삭제할 수 있습니다.");
    expect(mockClient.post.update).not.toHaveBeenCalled();
  });

  it("남의 글 delete 는 403 POST_FORBIDDEN", async () => {
    const res = await mutate({ action: "delete" }, { user: other });
    expectError(res, 403, "POST_FORBIDDEN", "본인 게시글만 수정·삭제할 수 있습니다.");
    expect(mockClient.post.delete).not.toHaveBeenCalled();
  });

  it.each([[undefined], ["remove"], [""]])(
    "알 수 없는 action(%p)은 400 POST_INVALID_ACTION",
    async (action) => {
      const res = await mutate({ action });
      expectError(res, 400, "POST_INVALID_ACTION", "지원하지 않는 요청입니다.");
      expect(mockClient.post.update).not.toHaveBeenCalled();
      expect(mockClient.post.delete).not.toHaveBeenCalled();
    }
  );
});

describe("POST /api/posts/:id action=update", () => {
  it("본인 글은 수정하고 갱신본을 돌려준다", async () => {
    const res = await mutate(updateBody);
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.update).toHaveBeenCalledTimes(1);
    const { where, data } = mockClient.post.update.mock.calls[0][0];
    expect(where).toEqual({ id: 1 });
    expect(data).toEqual({
      title: "새 제목",
      description: "새 내용",
      category: "정보",
      type: "장수풍뎅이",
      image: "cf-old",
      images: ["cf-old", "cf-new-1", "cf-new-2"],
    });
    expect(res.body.success).toBe(true);
    expect(res.body.post).toMatchObject({
      id: 1,
      title: "새 제목",
      image: "cf-old",
      images: ["cf-old", "cf-new-1", "cf-new-2"],
    });
  });

  it("빈 category/species 는 null 로 저장, 사진을 모두 지우면 image '' · images []", async () => {
    const res = await mutate({ ...updateBody, category: "", species: "", images: [] });
    expect(res.statusCode).toBe(200);
    const { data } = mockClient.post.update.mock.calls[0][0];
    expect(data.category).toBeNull();
    expect(data.type).toBeNull();
    expect(data.image).toBe("");
    expect(data.images).toEqual([]);
    expect(res.body.post.images).toEqual([]);
  });

  it.each([["   "], [""], [undefined]])("제목이 비면(%p) 400 POST_TITLE_REQUIRED", async (title) => {
    const res = await mutate({ ...updateBody, title });
    expectError(res, 400, "POST_TITLE_REQUIRED", "제목을 입력해주세요.");
    expect(mockClient.post.update).not.toHaveBeenCalled();
  });

  it.each([["  \n "], [""], [undefined]])(
    "내용이 비면(%p) 400 POST_DESCRIPTION_REQUIRED",
    async (description) => {
      const res = await mutate({ ...updateBody, description });
      expectError(res, 400, "POST_DESCRIPTION_REQUIRED", "내용을 입력해주세요.");
      expect(mockClient.post.update).not.toHaveBeenCalled();
    }
  );

  it("사진 11장은 400 POST_TOO_MANY_IMAGES", async () => {
    const images = Array.from({ length: 11 }, (_, i) => `cf-${i}`);
    const res = await mutate({ ...updateBody, images });
    expectError(res, 400, "POST_TOO_MANY_IMAGES", "사진은 최대 10장까지 올릴 수 있습니다.");
    expect(mockClient.post.update).not.toHaveBeenCalled();
  });

  it("잘못된 사진 id 는 400 POST_INVALID_IMAGES", async () => {
    const res = await mutate({ ...updateBody, images: ["cf-1", ""] });
    expectError(res, 400, "POST_INVALID_IMAGES", "사진 정보가 올바르지 않습니다.");
    expect(mockClient.post.update).not.toHaveBeenCalled();
  });

  it("관리자가 아니면 공지로 바꿀 수 없다 (403)", async () => {
    const res = await mutate({ ...updateBody, category: "공지" });
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("공지 작성 권한이 없습니다.");
    expect(res.body.error).toBe("공지 작성 권한이 없습니다.");
    expect(typeof res.body.errorCode).toBe("string");
    expect(mockClient.user.findUnique.mock.calls[0][0].where).toEqual({ id: 7 });
    expect(mockClient.post.update).not.toHaveBeenCalled();
  });

  it.each([["ADMIN"], ["SUPER_USER"]])("관리자(%s)는 공지로 바꿀 수 있다", async (role) => {
    mockClient.user.findUnique.mockResolvedValue({ role });
    const res = await mutate({ ...updateBody, category: "공지" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.update.mock.calls[0][0].data.category).toBe("공지");
  });

  it("공지가 아니면 권한 조회를 하지 않는다", async () => {
    await mutate(updateBody);
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/posts/:id action=delete", () => {
  it("본인 글은 삭제한다", async () => {
    const res = await mutate({ action: "delete" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockClient.post.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mockClient.post.update).not.toHaveBeenCalled();
  });
});

describe("기존 동작 회귀", () => {
  it("GET /api/posts/:id 는 비로그인도 상세를 돌려준다", async () => {
    mockClient.post.findUnique.mockResolvedValue({
      ...storedPost,
      user: { id: 7, name: "브리더", avatar: null, breederPrograms: [] },
      comments: [],
      _count: { comments: 0, Likes: 0 },
    });
    const res = await call(postDetailHandler, { method: "GET", query: { id: "1" } });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.post.id).toBe(1);
    expect(res.body.post.images).toEqual(["cf-old"]);
    expect(res.body.isLiked).toBe(false);
  });

  it("GET 잘못된 id 는 기존처럼 400", async () => {
    const res = await call(postDetailHandler, { method: "GET", query: { id: "abc" } });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: "유효하지 않은 게시글 ID입니다." });
  });

  it("지원하지 않는 method 는 405", async () => {
    const res = await call(postDetailHandler, { method: "DELETE", query: { id: "1" }, user: me });
    expect(res.statusCode).toBe(405);
  });

  it("POST /api/posts 공지 작성: 비관리자 403 (기존 응답 그대로)", async () => {
    const res = await call(postsHandler, {
      method: "POST",
      user: me,
      body: { title: "공지", description: "내용", category: "공지" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: "공지 작성 권한이 없습니다." });
    expect(mockClient.post.create).not.toHaveBeenCalled();
  });

  it("POST /api/posts 공지 작성: 관리자는 허용", async () => {
    mockClient.user.findUnique.mockResolvedValue({ role: "ADMIN", name: "관리자" });
    const res = await call(postsHandler, {
      method: "POST",
      user: me,
      body: { title: "공지", description: "내용", category: "공지" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.create.mock.calls[0][0].data.category).toBe("공지");
  });
});
