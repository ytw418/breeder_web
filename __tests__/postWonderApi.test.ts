import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  like: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
  post: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
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

import wonderHandler from "../pages/api/posts/[id]/wonder";

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    // Next.js 는 존재하지 않는 경로(/community)를 재검증하면
    // "Failed to revalidate /community: Invalid response 404" 로 reject 한다.
    revalidate: jest.fn((path: string) =>
      Promise.reject(new Error(`Failed to revalidate ${path}: Invalid response 404`))
    ),
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

async function callWonder(postId = "10") {
  const res = createRes();
  await wonderHandler(
    {
      method: "POST",
      headers: {},
      body: {},
      query: { id: postId },
      user: { id: 7 },
    } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.post.findUnique.mockResolvedValue({ userId: 3 });
  mockClient.user.findUnique.mockResolvedValue({ name: "브리더" });
  mockClient.like.create.mockResolvedValue({ id: 1 });
  mockClient.like.delete.mockResolvedValue({ id: 1 });
  mockCreateNotification.mockResolvedValue(undefined);
});

describe("POST /api/posts/[id]/wonder", () => {
  it("좋아요를 누르면 200 success 와 isLiked=true 를 반환한다", async () => {
    mockClient.like.findFirst.mockResolvedValue(null);

    const res = await callWonder();

    expect(mockClient.like.create).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, isLiked: true });
  });

  it("좋아요를 취소하면 200 success 와 isLiked=false 를 반환한다", async () => {
    mockClient.like.findFirst.mockResolvedValue({ id: 5 });

    const res = await callWonder();

    expect(mockClient.like.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, isLiked: false });
  });

  it("존재하지 않는 /community 경로를 재검증하지 않는다", async () => {
    mockClient.like.findFirst.mockResolvedValue(null);

    const res = await callWonder();

    expect(res.revalidate).not.toHaveBeenCalledWith("/community");
  });

  it("알림 대상 조회가 실패해도 좋아요 성공 응답을 반환한다", async () => {
    mockClient.like.findFirst.mockResolvedValue(null);
    mockClient.post.findUnique.mockRejectedValue(new Error("db down"));

    const res = await callWonder();

    expect(mockClient.like.create).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, isLiked: true });
  });

  it("알림 생성이 실패해도 좋아요 성공 응답을 반환한다", async () => {
    mockClient.like.findFirst.mockResolvedValue(null);
    mockCreateNotification.mockRejectedValue(new Error("push failed"));

    const res = await callWonder();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, isLiked: true });
  });

  it("유효하지 않은 게시글 ID 는 400 을 반환한다", async () => {
    const res = await callWonder("abc");

    expect(res.statusCode).toBe(400);
    expect(mockClient.like.findFirst).not.toHaveBeenCalled();
  });
});
