import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 댓글 작성 검증과 대댓글(POST /api/posts/:id/answers { comment, parentId }).
 * - 답글은 1단계다. 답글에 답글을 달면 그 루트에 붙인다.
 * - 부모 댓글 작성자에게 답글 알림을 보내고, 게시글 작성자가 부모 작성자와 다를 때만 댓글 알림을 보낸다.
 */

const mockClient = {
  user: { findUnique: jest.fn() },
  userBlock: { findMany: jest.fn() },
  comment: { create: jest.fn(), findUnique: jest.fn() },
  post: { findUnique: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
const mockCreateNotification = jest.fn();
jest.mock("@libs/server/notification", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));
const mockIncrementMission = jest.fn();
jest.mock("@libs/server/growth", () => ({
  incrementUserMissionProgress: (...args: unknown[]) => mockIncrementMission(...args),
}));

import answersHandler from "../pages/api/posts/[id]/answers";
import { COMMENT_MAX_LENGTH } from "@libs/shared/comment";

const ME = 1;
const POST_AUTHOR = 2;
const PARENT_AUTHOR = 3;
const POST_ID = 10;
const ROOT_ID = 100;

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

async function post(body: Record<string, unknown>) {
  const res = createRes();
  await answersHandler(
    {
      method: "POST",
      user: { id: ME } as NextApiRequest["user"],
      query: { id: String(POST_ID) },
      body,
    } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

type Row = { id: number; userId: number; postId: number; parentId: number | null; isHidden?: boolean };
let comments: Row[] = [];
let blocks: { blockerId: number; blockedId: number }[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  comments = [{ id: ROOT_ID, userId: PARENT_AUTHOR, postId: POST_ID, parentId: null }];
  blocks = [];
  mockClient.post.findUnique.mockResolvedValue({ userId: POST_AUTHOR, isHidden: false });
  mockClient.user.findUnique.mockResolvedValue({ name: "나" });
  mockClient.comment.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 999, ...data })
  );
  mockClient.comment.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
    Promise.resolve(comments.find((row) => row.id === where.id) ?? null)
  );
  mockClient.userBlock.findMany.mockImplementation(
    ({ where }: { where: { OR: { blockerId: number; blockedId: number }[] } }) =>
      Promise.resolve(
        blocks.filter((block) =>
          where.OR.some(
            (pair) => pair.blockerId === block.blockerId && pair.blockedId === block.blockedId
          )
        )
      )
  );
});

describe("댓글 내용 검증", () => {
  it("앞뒤 공백을 지워 저장한다", async () => {
    await post({ comment: "  안녕하세요  " });

    expect(mockClient.comment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ comment: "안녕하세요", parentId: null }),
    });
  });

  it("공백뿐이면 400 COMMENT_EMPTY 이고 저장하지 않는다", async () => {
    const res = await post({ comment: "  " });

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("COMMENT_EMPTY");
    expect(mockClient.comment.create).not.toHaveBeenCalled();
  });

  it(`${COMMENT_MAX_LENGTH}자를 넘으면 400 COMMENT_TOO_LONG`, async () => {
    const res = await post({ comment: "가".repeat(COMMENT_MAX_LENGTH + 1) });

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("COMMENT_TOO_LONG");
  });
});

describe("대댓글", () => {
  it("parentId 를 붙여 저장하고 부모 작성자·게시글 작성자에게 각각 알린다", async () => {
    const res = await post({ comment: "답글", parentId: ROOT_ID });

    expect(res.statusCode).toBe(200);
    expect(mockClient.comment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ comment: "답글", parentId: ROOT_ID }),
    });
    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "COMMENT",
        userId: PARENT_AUTHOR,
        senderId: ME,
        message: "나님이 회원님의 댓글에 답글을 남겼습니다.",
        targetId: POST_ID,
        targetType: "post",
        // 알림을 누르면 새 답글로 스크롤한다.
        commentId: 999,
      })
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: POST_AUTHOR, senderId: ME })
    );
    expect(mockIncrementMission).toHaveBeenCalledWith(ME, "comment_write");
  });

  it("부모 작성자가 게시글 작성자면 답글 알림 하나만 보낸다", async () => {
    comments = [{ id: ROOT_ID, userId: POST_AUTHOR, postId: POST_ID, parentId: null }];
    await post({ comment: "답글", parentId: ROOT_ID });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: POST_AUTHOR,
        message: "나님이 회원님의 댓글에 답글을 남겼습니다.",
      })
    );
  });

  it("답글에 답글을 달면 루트에 붙인다", async () => {
    comments.push({ id: 200, userId: PARENT_AUTHOR, postId: POST_ID, parentId: ROOT_ID });
    await post({ comment: "답글", parentId: 200 });

    expect(mockClient.comment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ parentId: ROOT_ID }),
    });
  });

  it("다른 게시글의 댓글이면 404 이고 저장하지 않는다", async () => {
    comments = [{ id: ROOT_ID, userId: PARENT_AUTHOR, postId: POST_ID + 1, parentId: null }];
    const res = await post({ comment: "답글", parentId: ROOT_ID });

    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("COMMENT_PARENT_NOT_FOUND");
    expect(mockClient.comment.create).not.toHaveBeenCalled();
  });

  it("숨긴 댓글에는 작성자·관리자가 아니면 답글을 달 수 없다(404)", async () => {
    comments = [{ id: ROOT_ID, userId: PARENT_AUTHOR, postId: POST_ID, parentId: null, isHidden: true }];
    const res = await post({ comment: "답글", parentId: ROOT_ID });

    expect(res.statusCode).toBe(404);
  });

  it("parentId 가 숫자가 아니면 400", async () => {
    const res = await post({ comment: "답글", parentId: "abc" });

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("COMMENT_INVALID_PARENT");
  });

  it("부모 작성자가 나를 차단했으면 답글은 저장하되 부모 작성자에게 알리지 않는다", async () => {
    blocks = [{ blockerId: PARENT_AUTHOR, blockedId: ME }];
    await post({ comment: "답글", parentId: ROOT_ID });

    expect(mockClient.comment.create).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: PARENT_AUTHOR })
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: POST_AUTHOR })
    );
  });
});

describe("질문 글 답변 알림", () => {
  it("질문 글에 댓글을 달면 작성자에게 '질문에 답변' 문구로 알린다", async () => {
    mockClient.post.findUnique.mockResolvedValue({
      userId: POST_AUTHOR,
      isHidden: false,
      category: "질문",
    });
    await post({ comment: "고단백 젤리 써요" });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: POST_AUTHOR,
        message: "나님이 회원님의 질문에 답변을 남겼어요.",
      })
    );
  });

  it("질문이 아닌 글은 기존 댓글 문구 그대로", async () => {
    mockClient.post.findUnique.mockResolvedValue({
      userId: POST_AUTHOR,
      isHidden: false,
      category: "자유",
    });
    await post({ comment: "좋네요" });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: POST_AUTHOR,
        message: "나님이 회원님의 게시글에 댓글을 남겼습니다.",
      })
    );
  });
});
