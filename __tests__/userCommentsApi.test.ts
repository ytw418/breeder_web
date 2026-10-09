import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 프로필 댓글 목록(GET /api/users/:id/comments)
 * - '삭제된 댓글' 자리는 뺀다.
 * - 답글이면 parentId 와 루트 댓글 작성자 이름(replyTo)을 붙인다.
 */

const mockClient = {
  comment: { findMany: jest.fn(), count: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import handler from "../pages/api/users/[id]/comments";

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

const post = { id: 10, title: "글", image: "", category: "자유" };

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.comment.count.mockResolvedValue(3);
  mockClient.comment.findMany.mockImplementation(({ where }: { where: Record<string, any> }) => {
    if (where.id) {
      // 루트 댓글 작성자 조회
      return Promise.resolve([
        { id: 1, user: { name: "루트작성자" } },
        { id: 2, user: { name: "탈퇴한 사용자#99" } },
      ]);
    }
    return Promise.resolve([
      { id: 5, comment: "그냥 댓글", createdAt: new Date(), isHidden: false, parentId: null, post },
      { id: 6, comment: "답글", createdAt: new Date(), isHidden: false, parentId: 1, post },
      { id: 7, comment: "탈퇴자에게 답글", createdAt: new Date(), isHidden: false, parentId: 2, post },
    ]);
  });
});

it("삭제 자리를 빼고, 답글에는 루트 댓글 작성자 이름을 붙인다", async () => {
  const res = createRes();
  await handler(
    { method: "GET", query: { id: "3", page: "1" } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );

  expect(mockClient.comment.findMany.mock.calls[0][0].where).toEqual(
    expect.objectContaining({ userId: 3, deletedAt: null, isHidden: false })
  );
  expect(mockClient.comment.findMany).toHaveBeenCalledWith({
    where: { id: { in: [1, 2] } },
    select: { id: true, user: { select: { name: true } } },
  });
  expect(res.body.comments.map((c: any) => [c.id, c.parentId, c.replyTo])).toEqual([
    [5, null, null],
    [6, 1, { name: "루트작성자" }],
    [7, 2, { name: "탈퇴한 사용자" }],
  ]);
});
