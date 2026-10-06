/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 좋아요 알림 중복 방지 — 실제 createNotification 을 거쳐 확인한다.
 * 좋아요 → 취소 → 좋아요를 반복해도 작성자에게 알림 행과 푸시는 처음 한 번만 간다.
 */

type LikeRow = { id: number; userId: number; postId: number };
type NotificationRow = {
  id: number;
  type: string;
  userId: number;
  senderId: number;
  targetId: number | null;
  targetType: string | null;
};

let likes: LikeRow[] = [];
let notifications: NotificationRow[] = [];
let nextId = 1;

const mockClient = {
  like: {
    findFirst: jest.fn(async ({ where }: { where: { userId: number; postId: number } }) => {
      const row = likes.find((l) => l.userId === where.userId && l.postId === where.postId);
      return row ? { id: row.id } : null;
    }),
    create: jest.fn(
      async ({
        data,
      }: {
        data: { user: { connect: { id: number } }; post: { connect: { id: number } } };
      }) => {
        const row = {
          id: nextId++,
          userId: data.user.connect.id,
          postId: data.post.connect.id,
        };
        likes.push(row);
        return row;
      }
    ),
    delete: jest.fn(async ({ where }: { where: { id: number } }) => {
      likes = likes.filter((l) => l.id !== where.id);
      return { id: where.id };
    }),
  },
  post: { findUnique: jest.fn(async () => ({ userId: 3 })) },
  user: {
    findUnique: jest.fn(async ({ where }: { where: { id: number } }) => ({
      name: `user${where.id}`,
    })),
  },
  notification: {
    findFirst: jest.fn(async ({ where }: { where: Omit<NotificationRow, "id"> }) => {
      return (
        notifications.find(
          (n) =>
            n.type === where.type &&
            n.userId === where.userId &&
            n.senderId === where.senderId &&
            n.targetId === where.targetId &&
            n.targetType === where.targetType
        ) ?? null
      );
    }),
    create: jest.fn(async ({ data }: { data: Omit<NotificationRow, "id"> }) => {
      const row = {
        id: nextId++,
        ...data,
        targetId: data.targetId ?? null,
        targetType: data.targetType ?? null,
      };
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

import wonderHandler from "../pages/api/posts/[id]/wonder";

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

async function toggleLike(userId: number, postId = "10") {
  const res = createRes();
  await wonderHandler(
    {
      method: "POST",
      headers: {},
      body: {},
      query: { id: postId },
      user: { id: userId },
    } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  likes = [];
  notifications = [];
  nextId = 1;
  mockSendPush.mockResolvedValue(undefined);
});

describe("POST /api/posts/[id]/wonder 좋아요 알림 중복 방지", () => {
  it("좋아요 → 취소 → 좋아요를 반복해도 작성자 알림·푸시는 한 번만 간다", async () => {
    expect((await toggleLike(7)).body).toEqual({ success: true, isLiked: true });
    expect((await toggleLike(7)).body).toEqual({ success: true, isLiked: false });
    expect((await toggleLike(7)).body).toEqual({ success: true, isLiked: true });
    expect((await toggleLike(7)).body).toEqual({ success: true, isLiked: false });
    expect((await toggleLike(7)).body).toEqual({ success: true, isLiked: true });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "LIKE",
      userId: 3,
      senderId: 7,
      targetId: 10,
      targetType: "post",
    });
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockSendPush).toHaveBeenCalledWith([3], expect.objectContaining({ url: "/posts/10" }));
  });

  it("다른 사람의 첫 좋아요는 각각 알린다", async () => {
    await toggleLike(7);
    await toggleLike(8);

    expect(notifications.map((n) => n.senderId)).toEqual([7, 8]);
    expect(mockSendPush).toHaveBeenCalledTimes(2);
  });

  it("같은 사람이라도 다른 글에 누른 첫 좋아요는 알린다", async () => {
    await toggleLike(7, "10");
    await toggleLike(7, "11");

    expect(notifications.map((n) => n.targetId)).toEqual([10, 11]);
    expect(mockSendPush).toHaveBeenCalledTimes(2);
  });
});
