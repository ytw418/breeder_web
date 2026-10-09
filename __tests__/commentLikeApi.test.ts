/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 댓글 좋아요(POST /api/posts/:id/comments/:commentId/like) — 실제 createNotification 을 거쳐 확인한다.
 * - 토글이고 좋아요 수를 돌려준다.
 * - 댓글 작성자에게 알림·푸시는 처음 한 번만 가고, 누르면 그 댓글로 가도록 commentId 를 싣는다.
 * - 볼 수 없는 댓글(다른 글·지운 자리·숨김·차단한 사람)은 404.
 */

const POST_ID = 10;
const COMMENT_ID = 100;
const AUTHOR = 3;
const ME = 7;

type CommentRow = {
  id: number;
  userId: number;
  postId: number;
  deletedAt: Date | null;
  isHidden: boolean;
};
type NotificationRow = {
  id: number;
  type: string;
  userId: number;
  senderId: number;
  targetId: number | null;
  targetType: string | null;
  commentId: number | null;
};

let comments: CommentRow[] = [];
let likes: { id: number; userId: number; commentId: number }[] = [];
let notifications: NotificationRow[] = [];
let blocks: { blockerId: number; blockedId: number }[] = [];
let nextId = 1;

type Where = Record<string, any>;
/** 핸들러가 만드는 댓글 where(AND·OR·notIn·isHidden·deletedAt)를 메모리 행에 적용한다. */
function matches(row: Record<string, any>, where: Where): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return (value as Where[]).every((w) => matches(row, w));
    if (key === "OR") return (value as Where[]).some((w) => matches(row, w));
    if (value && typeof value === "object" && "notIn" in value) return !value.notIn.includes(row[key]);
    return row[key] === value;
  });
}

const mockClient = {
  comment: {
    findFirst: jest.fn(async ({ where }: { where: Where }) => {
      const row = comments.find((c) => matches(c, where));
      return row ? { userId: row.userId } : null;
    }),
  },
  commentLike: {
    findUnique: jest.fn(
      async ({ where }: { where: { userId_commentId: { userId: number; commentId: number } } }) =>
        likes.find(
          (l) =>
            l.userId === where.userId_commentId.userId &&
            l.commentId === where.userId_commentId.commentId
        ) ?? null
    ),
    create: jest.fn(async ({ data }: { data: { userId: number; commentId: number } }) => {
      const row = { id: nextId++, ...data };
      likes.push(row);
      return row;
    }),
    delete: jest.fn(async ({ where }: { where: { id: number } }) => {
      likes = likes.filter((l) => l.id !== where.id);
      return { id: where.id };
    }),
    count: jest.fn(async ({ where }: { where: { commentId: number } }) =>
      likes.filter((l) => l.commentId === where.commentId).length
    ),
  },
  userBlock: {
    findMany: jest.fn(async ({ where }: { where: Where }) => {
      if (where.blockerId !== undefined) {
        return blocks
          .filter((b) => b.blockerId === where.blockerId)
          .map((b) => ({ blockedId: b.blockedId }));
      }
      return blocks.filter((b) =>
        (where.OR as { blockerId: number; blockedId: number }[]).some(
          (pair) => pair.blockerId === b.blockerId && pair.blockedId === b.blockedId
        )
      );
    }),
  },
  user: {
    findUnique: jest.fn(async ({ where }: { where: { id: number } }) => ({ name: `user${where.id}` })),
  },
  notification: {
    findFirst: jest.fn(async ({ where }: { where: Omit<NotificationRow, "id"> }) =>
      notifications.find(
        (n) =>
          n.type === where.type &&
          n.userId === where.userId &&
          n.senderId === where.senderId &&
          n.targetId === where.targetId &&
          n.targetType === where.targetType &&
          n.commentId === where.commentId
      ) ?? null
    ),
    create: jest.fn(async ({ data }: { data: Omit<NotificationRow, "id"> }) => {
      const row = { id: nextId++, ...data, commentId: data.commentId ?? null };
      notifications.push(row);
      return row;
    }),
  },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
const mockSendPush = jest.fn();
jest.mock("@libs/server/pushGateway", () => ({
  sendAllPushToUsers: (...args: unknown[]) => mockSendPush(...args),
}));

import likeHandler from "../pages/api/posts/[id]/comments/[commentId]/like";

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

async function toggle(userId: number | null = ME, commentId = COMMENT_ID) {
  const res = createRes();
  await likeHandler(
    {
      method: "POST",
      headers: {},
      body: {},
      query: { id: String(POST_ID), commentId: String(commentId) },
      user: userId ? { id: userId } : undefined,
    } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  comments = [{ id: COMMENT_ID, userId: AUTHOR, postId: POST_ID, deletedAt: null, isHidden: false }];
  likes = [];
  notifications = [];
  blocks = [];
  nextId = 1;
  mockSendPush.mockResolvedValue(undefined);
});

describe("댓글 좋아요 토글", () => {
  it("누르면 좋아요, 다시 누르면 취소하고 좋아요 수를 돌려준다", async () => {
    expect((await toggle()).body).toEqual({ success: true, liked: true, likeCount: 1 });
    expect((await toggle(8)).body).toEqual({ success: true, liked: true, likeCount: 2 });
    expect((await toggle()).body).toEqual({ success: true, liked: false, likeCount: 1 });
  });

  it("작성자에게 알리고, 누르면 그 댓글로 가도록 commentId 를 싣는다", async () => {
    await toggle();

    expect(notifications).toEqual([
      expect.objectContaining({
        type: "LIKE",
        userId: AUTHOR,
        senderId: ME,
        targetId: POST_ID,
        targetType: "post",
        commentId: COMMENT_ID,
      }),
    ]);
    expect(mockSendPush).toHaveBeenCalledWith(
      [AUTHOR],
      expect.objectContaining({
        body: `user${ME}님이 회원님의 댓글을 좋아합니다.`,
        url: `/posts/${POST_ID}?commentId=${COMMENT_ID}`,
        tag: `LIKE-post-${POST_ID}-c${COMMENT_ID}`,
      })
    );
  });

  it("좋아요 → 취소 → 좋아요를 반복해도 알림은 한 번만 간다", async () => {
    await toggle();
    await toggle();
    await toggle();

    expect(notifications).toHaveLength(1);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
  });

  it("같은 글의 '글 좋아요' 알림이 있어도 댓글 좋아요는 따로 알린다", async () => {
    notifications.push({
      id: 999,
      type: "LIKE",
      userId: AUTHOR,
      senderId: ME,
      targetId: POST_ID,
      targetType: "post",
      commentId: null,
    });
    await toggle();

    expect(notifications).toHaveLength(2);
  });

  it("내 댓글에 누르면 알림이 없다", async () => {
    comments[0].userId = ME;
    expect((await toggle()).body.liked).toBe(true);
    expect(notifications).toHaveLength(0);
  });

  it("작성자가 나를 차단했으면 좋아요는 되지만 알리지 않는다", async () => {
    blocks = [{ blockerId: AUTHOR, blockedId: ME }];
    expect((await toggle()).body.liked).toBe(true);
    expect(notifications).toHaveLength(0);
  });
});

describe("볼 수 없는 댓글은 404", () => {
  it("다른 글의 댓글", async () => {
    comments[0].postId = POST_ID + 1;
    const res = await toggle();
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("COMMENT_NOT_FOUND");
  });

  it("'삭제된 댓글' 자리", async () => {
    comments[0].deletedAt = new Date();
    expect((await toggle()).statusCode).toBe(404);
  });

  it("숨긴 댓글(작성자·관리자가 아니면)", async () => {
    comments[0].isHidden = true;
    expect((await toggle()).statusCode).toBe(404);
  });

  it("내가 차단한 사람의 댓글", async () => {
    blocks = [{ blockerId: ME, blockedId: AUTHOR }];
    expect((await toggle()).statusCode).toBe(404);
    expect(likes).toHaveLength(0);
  });

  it("비로그인은 401", async () => {
    expect((await toggle(null)).statusCode).toBe(401);
  });
});
