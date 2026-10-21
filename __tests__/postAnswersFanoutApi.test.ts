import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 새 댓글 알림 구독자 묶음(POST /api/posts/:id/answers, 앱 docs/prd/post-upload.md 2026-10-21).
 * 이 글에 댓글을 단 구독자(muted=false)에게 '"제목" 글에 새 댓글: …' 을 보내되,
 * 1시간 안에 같은 글 댓글 알림을 받은 사람과 차단 관계인 사람은 건너뛴다.
 */

const mockClient = {
  user: { findUnique: jest.fn(async () => ({ name: "디디" })) },
  userBlock: { findMany: jest.fn() },
  comment: { create: jest.fn(async () => ({ id: 500 })), findUnique: jest.fn(), findFirst: jest.fn(async () => null) },
  post: { findUnique: jest.fn(async () => ({ userId: 1, isHidden: false, category: "자유", title: "크레 사육장 꾸미기" })) },
  postSubscription: { upsert: jest.fn(), findUnique: jest.fn(async () => null), findMany: jest.fn() },
  notification: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
const mockCreateNotification = jest.fn();
jest.mock("@libs/server/notification", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));
jest.mock("@libs/server/growth", () => ({ incrementUserMissionProgress: jest.fn() }));

import answersHandler from "../pages/api/posts/[id]/answers";

const AUTHOR = 1;
const D = 4;
const [B, C, E] = [2, 3, 5];

it("구독자 B·C·E 중 1시간 안에 알림을 받은 E 를 빼고 B·C 에게 새 댓글 알림을 보낸다", async () => {
  mockClient.userBlock.findMany.mockResolvedValue([]);
  mockClient.postSubscription.findMany.mockResolvedValue([{ userId: B }, { userId: C }, { userId: E }]);
  mockClient.notification.findMany.mockResolvedValue([{ userId: E }]);
  const res: Record<string, unknown> = { statusCode: 200, setHeader: jest.fn() };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);

  await answersHandler(
    { method: "POST", headers: {}, user: { id: D }, query: { id: "10" }, body: { comment: "유목 넣으면 좋아요" } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );

  // 구독자 조회는 글쓴이·나를 빼고 먼저 구독한 순 50명.
  expect(mockClient.postSubscription.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ postId: 10, muted: false, userId: { notIn: [D, AUTHOR] } }),
      orderBy: { createdAt: "asc" },
      take: 50,
    })
  );
  const receivers = mockCreateNotification.mock.calls.map(([arg]) => arg.userId).sort();
  expect(receivers).toEqual([AUTHOR, B, C]);
  expect(mockCreateNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: B,
      type: "COMMENT",
      message: '"크레 사육장 꾸미기" 글에 새 댓글: 유목 넣으면 좋아요',
      commentId: 500,
      pushTitle: "크레 사육장 꾸미기",
    })
  );
});
