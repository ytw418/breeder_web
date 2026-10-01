import type { NextApiRequest, NextApiResponse } from "next";

/**
 * #18 서버 차단 — 차단 이후의 상호작용.
 * - 차단하면 양방향 팔로우를 지우므로, 어느 쪽이 차단했든 새 팔로우도 막는다(문구는 방향과 무관).
 * - 게시글 작성자가 차단한 사람의 댓글은 작성자에게 알림·푸시를 보내지 않는다.
 */

const mockClient = {
  user: { findUnique: jest.fn() },
  userBlock: { findMany: jest.fn() },
  follow: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
  comment: { create: jest.fn() },
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

import followHandler from "../pages/api/users/[id]/follow";
import answersHandler from "../pages/api/posts/[id]/answers";

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
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
    { method: "POST", headers: {}, query: {}, body: {}, cookies: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const ME = 7;
const OTHER = 9;
const POST_ID = 30;
const me = { id: ME, name: "나" } as NextApiRequest["user"];

type BlockRow = { blockerId: number; blockedId: number };
let blocks: BlockRow[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  blocks = [];

  // getBlockRelation: where.OR 의 (blocker, blocked) 쌍 중 실제 있는 차단만 돌려준다.
  mockClient.userBlock.findMany.mockImplementation(
    ({ where }: { where: { OR: BlockRow[] } }) =>
      Promise.resolve(
        blocks
          .filter((row) =>
            where.OR.some(
              (pair) => pair.blockerId === row.blockerId && pair.blockedId === row.blockedId
            )
          )
          .map((row) => ({ blockerId: row.blockerId }))
      )
  );
  mockClient.user.findUnique.mockResolvedValue({ name: "나" });
  mockClient.follow.findFirst.mockResolvedValue(null);
  mockClient.follow.create.mockResolvedValue({ id: 1 });
  mockClient.follow.delete.mockResolvedValue({ id: 1 });
  mockClient.comment.create.mockResolvedValue({ id: 100, comment: "댓글" });
  mockClient.post.findUnique.mockResolvedValue({ userId: OTHER });
  mockCreateNotification.mockResolvedValue(undefined);
  mockIncrementMission.mockResolvedValue(undefined);
});

describe("POST /api/users/:id/follow", () => {
  const follow = () => call(followHandler, { user: me, query: { id: String(OTHER) } });

  it.each([
    ["내가 상대를 차단", { blockerId: ME, blockedId: OTHER }],
    ["상대가 나를 차단", { blockerId: OTHER, blockedId: ME }],
  ])("%s했으면 403 FOLLOW_BLOCKED, 팔로우·알림을 만들지 않는다", async (_label, block) => {
    blocks = [block];
    const res = await follow();

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: "이 사용자를 팔로우할 수 없습니다.",
      errorCode: "FOLLOW_BLOCKED",
    });
    expect(mockClient.follow.create).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("차단이 없으면 팔로우하고 알림을 보낸다", async () => {
    const res = await follow();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, isFollowing: true });
    expect(mockClient.follow.create).toHaveBeenCalledWith({
      data: { followerId: ME, followingId: OTHER },
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "FOLLOW", userId: OTHER, senderId: ME })
    );
  });

  it("이미 팔로우 중이면 차단 여부와 관계없이 언팔로우는 된다", async () => {
    blocks = [{ blockerId: OTHER, blockedId: ME }];
    mockClient.follow.findFirst.mockResolvedValue({ id: 5 });
    const res = await follow();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, isFollowing: false });
    expect(mockClient.follow.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});

describe("POST /api/posts/:id/answers 댓글 알림", () => {
  const comment = () =>
    call(answersHandler, { user: me, query: { id: String(POST_ID) }, body: { comment: "댓글" } });

  it("게시글 작성자가 댓글 작성자를 차단했으면 댓글은 저장하되 알림은 보내지 않는다", async () => {
    blocks = [{ blockerId: OTHER, blockedId: ME }];
    const res = await comment();

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockClient.comment.create).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockIncrementMission).toHaveBeenCalledWith(ME, "comment_write");
  });

  it("댓글 작성자가 게시글 작성자를 차단한 경우(단방향)는 기존처럼 알림을 보낸다", async () => {
    blocks = [{ blockerId: ME, blockedId: OTHER }];
    await comment();

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "COMMENT", userId: OTHER, senderId: ME })
    );
  });

  it("차단이 없으면 게시글 작성자에게 알림을 보낸다", async () => {
    await comment();

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "COMMENT", userId: OTHER, senderId: ME, targetId: POST_ID })
    );
    expect(mockIncrementMission).toHaveBeenCalledWith(ME, "comment_write");
  });
});
