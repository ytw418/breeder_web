import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 댓글 수정·삭제(PATCH·DELETE /api/posts/:id/comments/:commentId).
 * - 작성자 본인만 고치고 지운다.
 * - 답글이 남은 루트는 '삭제된 댓글' 자리로 남기고, 그 밖에는 행을 지운다.
 */

const mockClient = {
  comment: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import handler from "../pages/api/posts/[id]/comments/[commentId]";
import { COMMENT_MAX_LENGTH } from "@libs/shared/comment";

const ME = 1;
const OTHER = 2;
const POST_ID = 10;
const COMMENT_ID = 100;

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
  await handler(
    {
      query: { id: String(POST_ID), commentId: String(COMMENT_ID) },
      body: {},
      ...req,
    } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const me = { id: ME } as NextApiRequest["user"];

function givenComment(overrides: Record<string, unknown> = {}) {
  mockClient.comment.findUnique.mockImplementation(({ where }: { where: { id: number } }) => {
    if (where.id === COMMENT_ID) {
      return Promise.resolve({
        userId: ME,
        postId: POST_ID,
        parentId: null,
        deletedAt: null,
        ...overrides,
      });
    }
    return Promise.resolve(null);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  givenComment();
  mockClient.comment.count.mockResolvedValue(0);
  mockClient.comment.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: COMMENT_ID, ...data })
  );
});

describe("PATCH 댓글 수정", () => {
  it("본인 댓글이면 앞뒤 공백을 지워 저장하고 editedAt 을 남긴다", async () => {
    const res = await call({ method: "PATCH", user: me, body: { comment: "  고친 댓글  " } });

    expect(res.statusCode).toBe(200);
    expect(mockClient.comment.update).toHaveBeenCalledWith({
      where: { id: COMMENT_ID },
      data: { comment: "고친 댓글", editedAt: expect.any(Date) },
      select: { id: true, comment: true, editedAt: true },
    });
    expect(res.body).toEqual({
      success: true,
      comment: expect.objectContaining({ id: COMMENT_ID, comment: "고친 댓글" }),
    });
  });

  it("남의 댓글은 403", async () => {
    givenComment({ userId: OTHER });
    const res = await call({ method: "PATCH", user: me, body: { comment: "고침" } });

    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("COMMENT_FORBIDDEN");
    expect(mockClient.comment.update).not.toHaveBeenCalled();
  });

  it("공백뿐이면 400 COMMENT_EMPTY", async () => {
    const res = await call({ method: "PATCH", user: me, body: { comment: "   " } });

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("COMMENT_EMPTY");
  });

  it(`${COMMENT_MAX_LENGTH}자를 넘으면 400 COMMENT_TOO_LONG`, async () => {
    const res = await call({
      method: "PATCH",
      user: me,
      body: { comment: "가".repeat(COMMENT_MAX_LENGTH + 1) },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("COMMENT_TOO_LONG");
  });

  it("다른 게시글의 댓글이면 404", async () => {
    givenComment({ postId: POST_ID + 1 });
    const res = await call({ method: "PATCH", user: me, body: { comment: "고침" } });

    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("COMMENT_NOT_FOUND");
  });

  it("이미 지운 댓글 자리면 404", async () => {
    givenComment({ deletedAt: new Date() });
    const res = await call({ method: "PATCH", user: me, body: { comment: "고침" } });

    expect(res.statusCode).toBe(404);
  });

  it("댓글 id 가 숫자가 아니면 400", async () => {
    const res = await call({
      method: "PATCH",
      user: me,
      query: { id: String(POST_ID), commentId: "abc" },
      body: { comment: "고침" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("COMMENT_INVALID_ID");
  });

  it("비로그인은 401", async () => {
    const res = await call({ method: "PATCH", body: { comment: "고침" } });

    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE 댓글 삭제", () => {
  it("답글 없는 루트는 행을 지운다", async () => {
    const res = await call({ method: "DELETE", user: me });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, mode: "hard" });
    expect(mockClient.comment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
    expect(mockClient.comment.update).not.toHaveBeenCalled();
  });

  it("답글이 남은 루트는 본문을 비우고 deletedAt 만 남긴다", async () => {
    mockClient.comment.count.mockResolvedValue(2);
    const res = await call({ method: "DELETE", user: me });

    expect(res.body).toEqual({ success: true, mode: "placeholder" });
    expect(mockClient.comment.update).toHaveBeenCalledWith({
      where: { id: COMMENT_ID },
      data: { deletedAt: expect.any(Date), comment: "" },
    });
    expect(mockClient.comment.delete).not.toHaveBeenCalled();
  });

  it("답글은 지우고, 살아 있는 부모는 그대로 둔다", async () => {
    givenComment({ parentId: 50 });
    const res = await call({ method: "DELETE", user: me });

    expect(res.body).toEqual({ success: true, mode: "hard" });
    expect(mockClient.comment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
    expect(mockClient.comment.deleteMany).not.toHaveBeenCalled();
  });

  it("'삭제된 댓글' 부모의 마지막 답글을 지우면 부모 자리도 지운다", async () => {
    mockClient.comment.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
      Promise.resolve(
        where.id === COMMENT_ID
          ? { userId: ME, postId: POST_ID, parentId: 50, deletedAt: null }
          : { deletedAt: new Date() }
      )
    );
    await call({ method: "DELETE", user: me });

    expect(mockClient.comment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
    expect(mockClient.comment.deleteMany).toHaveBeenCalledWith({
      where: { id: 50, deletedAt: { not: null } },
    });
  });

  it("남의 댓글은 403", async () => {
    givenComment({ userId: OTHER });
    const res = await call({ method: "DELETE", user: me });

    expect(res.statusCode).toBe(403);
    expect(mockClient.comment.delete).not.toHaveBeenCalled();
  });
});
