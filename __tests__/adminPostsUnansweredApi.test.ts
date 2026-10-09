import type { NextApiRequest, NextApiResponse } from "next";

/** 관리자 게시물 '답 없는 글' 필터: 최근 7일, 보이는 댓글이 하나도 없는 글(공지·숨김 제외). */

const mockClient = {
  post: { findMany: jest.fn(), count: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
jest.mock("@libs/server/adminAccess", () => ({ hasAdminAccess: async () => true }));
jest.mock("@libs/server/moderation", () => ({
  MODERATION_TARGET_NOT_FOUND_MESSAGE: "",
  applyModeration: jest.fn(),
  isModerationTargetNotFound: () => false,
}));

import adminPostsHandler from "../pages/api/admin/posts";

const NOW = new Date("2026-10-09T12:00:00.000Z");

async function list(query: Record<string, string>) {
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
  await adminPostsHandler(
    { method: "GET", headers: {}, query, body: {}, cookies: {}, user: { id: 1 } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  mockClient.post.findMany.mockResolvedValue([]);
  mockClient.post.count.mockResolvedValue(0);
});
afterEach(() => jest.useRealTimers());

it("unanswered=1 이면 최근 7일 안의 보이는 댓글 없는 글만(공지·숨김 제외)", async () => {
  await list({ unanswered: "1" });

  const where = mockClient.post.findMany.mock.calls[0][0].where;
  expect(where).toEqual({
    isHidden: false,
    // category 가 없는 글도 넣는다(not 만 쓰면 NULL 이 빠진다).
    OR: [{ category: null }, { category: { not: "공지" } }],
    createdAt: { gte: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000) },
    comments: { none: { isHidden: false, deletedAt: null } },
  });
  expect(mockClient.post.count.mock.calls[0][0].where).toEqual(where);
});

it("필터가 없으면 기존처럼 전체", async () => {
  await list({});
  expect(mockClient.post.findMany.mock.calls[0][0].where).toEqual({});
});
