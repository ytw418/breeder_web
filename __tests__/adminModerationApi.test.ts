import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  post: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  comment: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  product: { findUnique: jest.fn(), update: jest.fn() },
  auction: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  moderationLog: { create: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

const mockHasAdminAccess = jest.fn();
jest.mock("@libs/server/adminAccess", () => ({
  hasAdminAccess: (...args: unknown[]) => mockHasAdminAccess(...args),
}));

const mockCreateNotification = jest.fn();
jest.mock("@libs/server/notification", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

import moderationHandler from "../pages/api/admin/moderation";

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

const admin = { id: 1, name: "관리자" } as NextApiRequest["user"];

async function moderate(body: Record<string, unknown>, user = admin) {
  const res = createRes();
  await (moderationHandler as (req: NextApiRequest, res: NextApiResponse) => unknown)(
    { method: "POST", headers: {}, query: {}, cookies: {}, body, user } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasAdminAccess.mockResolvedValue(true);
  mockClient.post.findUnique.mockResolvedValue({
    userId: 9,
    title: "문제 게시글",
    description: "광고 내용입니다",
  });
  mockClient.comment.findUnique.mockResolvedValue({
    userId: 9,
    comment: "나쁜 댓글",
    post: { title: "문제 게시글" },
  });
  mockClient.product.findUnique.mockResolvedValue({
    userId: 9,
    name: "왕사슴",
    description: "허위 매물",
    isDeleted: false,
  });
  mockClient.auction.findUnique.mockResolvedValue({
    userId: 9,
    title: "왕사슴 경매",
    description: "설명",
    status: "진행중",
  });
  mockClient.post.delete.mockResolvedValue({ id: 30 });
  mockClient.moderationLog.create.mockResolvedValue({ id: 1 });
});

describe("POST /api/admin/moderation 권한·입력", () => {
  it("관리자가 아니면 403 이고 아무것도 바꾸지 않는다", async () => {
    mockHasAdminAccess.mockResolvedValue(false);
    const res = await moderate({ targetType: "POST", targetId: 30, action: "hide" });
    expect(res.statusCode).toBe(403);
    expect(mockClient.post.update).not.toHaveBeenCalled();
  });

  it("비로그인이면 403", async () => {
    const res = await moderate(
      { targetType: "POST", targetId: 30, action: "hide" },
      null as unknown as NextApiRequest["user"]
    );
    expect(res.statusCode).toBe(403);
  });

  it.each([
    [{ targetType: "USER", targetId: 30, action: "hide" }],
    [{ targetType: "POST", targetId: "abc", action: "hide" }],
    [{ targetType: "POST", targetId: 0, action: "hide" }],
    [{ targetType: "POST", targetId: 30, action: "ban" }],
  ])("잘못된 입력 %j 는 400", async (body) => {
    const res = await moderate(body);
    expect(res.statusCode).toBe(400);
    expect(mockClient.moderationLog.create).not.toHaveBeenCalled();
  });

  it("대상이 없으면 404 MODERATION_TARGET_NOT_FOUND", async () => {
    mockClient.post.findUnique.mockResolvedValue(null);
    const res = await moderate({ targetType: "POST", targetId: 30, action: "hide" });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("MODERATION_TARGET_NOT_FOUND");
  });

  it("조치 도중 다른 요청이 먼저 지웠으면(P2025) 404", async () => {
    mockClient.post.delete.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "P2025" })
    );
    const res = await moderate({ targetType: "POST", targetId: 30, action: "delete" });
    expect(res.statusCode).toBe(404);
    expect(mockClient.moderationLog.create).not.toHaveBeenCalled();
  });

  it("삭제된 상품은 대상이 없는 것으로 본다", async () => {
    mockClient.product.findUnique.mockResolvedValue({
      userId: 9,
      name: "왕사슴",
      description: "",
      isDeleted: true,
    });
    const res = await moderate({ targetType: "PRODUCT", targetId: 40, action: "hide" });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/admin/moderation 조치", () => {
  it("게시글 숨김 → isHidden=true + HIDE 기록(사유 포함)", async () => {
    const res = await moderate({
      targetType: "POST",
      targetId: 30,
      action: "hide",
      reason: "  광고  ",
    });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { isHidden: true },
    });
    expect(mockClient.moderationLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 1,
        targetType: "POST",
        targetId: 30,
        targetUserId: 9,
        action: "HIDE",
        reason: "광고",
        reportId: null,
        snapshot: undefined,
      },
    });
    expect(res.body.result).toEqual({
      targetType: "POST",
      targetId: 30,
      isHidden: true,
      deleted: false,
    });
  });

  it("게시글 숨김 해제 → isHidden=false + UNHIDE 기록", async () => {
    const res = await moderate({ targetType: "POST", targetId: 30, action: "unhide" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { isHidden: false },
    });
    expect(mockClient.moderationLog.create.mock.calls[0][0].data.action).toBe("UNHIDE");
    expect(res.body.result.isHidden).toBe(false);
  });

  it("게시글 삭제 → hard delete + 원문 스냅샷 기록", async () => {
    const res = await moderate({ targetType: "POST", targetId: 30, action: "delete" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.delete).toHaveBeenCalledWith({ where: { id: 30 } });
    expect(mockClient.moderationLog.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        action: "DELETE",
        snapshot: { title: "문제 게시글", excerpt: "광고 내용입니다" },
      })
    );
    expect(res.body.result.deleted).toBe(true);
  });

  it("댓글 숨김·삭제", async () => {
    await moderate({ targetType: "COMMENT", targetId: 31, action: "hide" });
    expect(mockClient.comment.update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: { isHidden: true },
    });
    await moderate({ targetType: "COMMENT", targetId: 31, action: "delete" });
    expect(mockClient.comment.delete).toHaveBeenCalledWith({ where: { id: 31 } });
  });

  it("상품 삭제 → hard delete 대신 isDeleted=true", async () => {
    const res = await moderate({ targetType: "PRODUCT", targetId: 40, action: "delete" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.product.update).toHaveBeenCalledWith({
      where: { id: 40 },
      data: { isDeleted: true },
    });
  });

  it("진행중 경매 숨김 → 취소로 바꾸고 판매자에게 알린다", async () => {
    const res = await moderate({ targetType: "AUCTION", targetId: 50, action: "hide" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.auction.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { isHidden: true, status: "취소", winnerId: null },
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "AUCTION_END", userId: 9, targetId: 50 })
    );
  });

  it("종료된 경매 숨김 → 상태는 그대로 두고 숨기기만 한다", async () => {
    mockClient.auction.findUnique.mockResolvedValue({
      userId: 9,
      title: "왕사슴 경매",
      description: "설명",
      status: "종료",
    });
    await moderate({ targetType: "AUCTION", targetId: 50, action: "hide" });
    expect(mockClient.auction.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { isHidden: true },
    });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("경매 숨김 해제 → 상태는 되돌리지 않는다", async () => {
    await moderate({ targetType: "AUCTION", targetId: 50, action: "unhide" });
    expect(mockClient.auction.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { isHidden: false },
    });
  });

  it("경매 삭제 → hard delete + 판매자 알림", async () => {
    await moderate({ targetType: "AUCTION", targetId: 50, action: "delete" });
    expect(mockClient.auction.delete).toHaveBeenCalledWith({ where: { id: 50 } });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "AUCTION_END", userId: 9 })
    );
  });
});
