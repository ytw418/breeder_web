import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 질문 답변 채택(POST/DELETE /api/posts/:id/accept, 앱 docs/prd/feed-engagement.md 2026-10-21 '해결').
 * 질문자만 채택할 수 있고, 채택하면 acceptedCommentId·resolvedAt 을 저장하고 답한 사람에게 알린다.
 */

const mockClient = {
  post: {
    findUnique: jest.fn(async () => ({ id: 10, userId: 1, title: "크레 밥 뭐 먹여요?", category: "질문", acceptedCommentId: null })),
    update: jest.fn(async () => ({ acceptedCommentId: 77, resolvedAt: new Date("2026-10-21T00:00:00Z") })),
  },
  comment: { findUnique: jest.fn(async () => ({ id: 77, postId: 10, userId: 2, deletedAt: null, isHidden: false })) },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
const mockCreateNotification = jest.fn();
jest.mock("@libs/server/notification", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

import acceptHandler from "../pages/api/posts/[id]/accept";

async function call(userId: number) {
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
  await acceptHandler(
    { method: "POST", headers: {}, user: { id: userId }, query: { id: "10" }, body: { commentId: 77 } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

it("질문자가 아니면 403, 질문자는 채택을 저장하고 답한 사람에게 알린다", async () => {
  const denied = await call(3);
  expect(denied.statusCode).toBe(403);
  expect(mockClient.post.update).not.toHaveBeenCalled();

  const ok = await call(1);
  expect(ok.statusCode).toBe(200);
  expect(ok.body).toMatchObject({ success: true, acceptedCommentId: 77 });
  expect(mockClient.post.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 10 }, data: expect.objectContaining({ acceptedCommentId: 77 }) })
  );
  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "ANSWER_ACCEPTED",
      userId: 2,
      senderId: 1,
      message: '"크레 밥 뭐 먹여요?" 질문에 회원님의 답변이 채택됐어요',
      commentId: 77,
    })
  );
});
