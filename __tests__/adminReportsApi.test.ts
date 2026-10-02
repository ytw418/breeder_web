import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  report: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  post: { findMany: jest.fn(), delete: jest.fn() },
  comment: { findMany: jest.fn(), delete: jest.fn() },
  product: { findMany: jest.fn(), update: jest.fn() },
  user: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  chatRoom: { findMany: jest.fn() },
  message: { findMany: jest.fn() },
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

import adminReportsHandler from "../pages/api/admin/reports";

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

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: Partial<NextApiRequest>
) {
  const res = createRes();
  await handler(
    { headers: {}, query: {}, body: {}, cookies: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const admin = { id: 1, name: "관리자" } as NextApiRequest["user"];
const CREATED_AT = new Date("2026-10-01T09:00:00.000Z");

type TargetType = "POST" | "COMMENT" | "PRODUCT" | "CHAT_ROOM" | "USER";

const reportRow = (id: number, targetType: TargetType, targetId: number, extra = {}) => ({
  id,
  targetType,
  targetId,
  reporterId: 7,
  reportedUserId: 9,
  reason: "스팸·광고",
  detail: null,
  status: "OPEN",
  resolutionAction: "NONE",
  resolutionNote: null,
  resolvedBy: null,
  resolvedAt: null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  reporter: { id: 7, name: "신고자", status: "ACTIVE" },
  reportedUser: { id: 9, name: "피신고자", status: "ACTIVE" },
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHasAdminAccess.mockResolvedValue(true);
  mockClient.report.groupBy.mockResolvedValue([
    { status: "OPEN", _count: { _all: 2 } },
    { status: "RESOLVED", _count: { _all: 1 } },
  ]);
  mockClient.report.findMany.mockResolvedValue([]);
  mockClient.report.findUnique.mockResolvedValue(null);
  mockClient.report.update.mockImplementation(
    ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) =>
      Promise.resolve({ ...reportRow(where.id, "POST", 30), ...data })
  );
  mockClient.post.findMany.mockResolvedValue([
    { id: 30, title: "문제 게시글", description: "광고 내용입니다" },
  ]);
  mockClient.post.delete.mockResolvedValue({ id: 30 });
  mockClient.comment.findMany.mockResolvedValue([
    { id: 31, comment: "나쁜 댓글", postId: 30, post: { title: "문제 게시글" } },
  ]);
  mockClient.comment.delete.mockResolvedValue({ id: 31 });
  mockClient.product.findMany.mockResolvedValue([
    { id: 40, name: "왕사슴", description: "허위 매물", isHidden: false, isDeleted: false },
  ]);
  mockClient.product.update.mockResolvedValue({ id: 40 });
  mockClient.user.findMany.mockResolvedValue([{ id: 9, name: "피신고자", status: "ACTIVE" }]);
  mockClient.user.update.mockResolvedValue({ id: 9 });
  mockClient.user.updateMany.mockResolvedValue({ count: 1 });
  mockClient.chatRoom.findMany.mockResolvedValue([{ id: 55 }]);
  mockClient.message.findMany.mockResolvedValue([]);
});

describe("/api/admin/reports 권한", () => {
  it.each(["GET", "POST"])("관리자가 아니면 %s 403", async (method) => {
    mockHasAdminAccess.mockResolvedValue(false);
    const res = await call(adminReportsHandler, {
      method,
      user: { id: 7, name: "일반" } as NextApiRequest["user"],
      body: { reportId: 1, decision: "RESOLVED", action: "BAN_USER" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(mockClient.report.findMany).not.toHaveBeenCalled();
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/reports", () => {
  it("상태별 개수와 대상 스냅샷을 함께 돌려준다", async () => {
    mockClient.report.findMany.mockResolvedValue([
      reportRow(1, "POST", 30),
      reportRow(2, "CHAT_ROOM", 55),
      reportRow(3, "COMMENT", 77),
    ]);
    mockClient.comment.findMany.mockResolvedValue([]); // 77 번 댓글은 이미 삭제됨
    mockClient.message.findMany.mockResolvedValue([
      { id: 3, userId: 9, message: "세번째", createdAt: CREATED_AT },
      { id: 2, userId: 7, message: "두번째", createdAt: CREATED_AT },
      { id: 1, userId: 9, message: "첫번째", createdAt: CREATED_AT },
    ]);

    const res = await call(adminReportsHandler, { method: "GET", user: admin });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.counts).toEqual({ OPEN: 2, RESOLVED: 1, REJECTED: 0 });

    const [postReport, chatReport, commentReport] = res.body.reports;
    expect(postReport.reporter).toEqual({ id: 7, name: "신고자", status: "ACTIVE" });
    expect(postReport.target).toEqual({
      exists: true,
      title: "문제 게시글",
      excerpt: "광고 내용입니다",
      href: "/posts/30-문제-게시글",
    });

    expect(chatReport.target.exists).toBe(true);
    expect(chatReport.target.href).toBeNull();
    // 최근 20개를 시간순(오래된 → 최신)으로 보여준다
    expect(chatReport.target.messages.map((m: { id: number }) => m.id)).toEqual([1, 2, 3]);
    expect(mockClient.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chatRoomId: 55 },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    );

    expect(commentReport.target).toEqual(
      expect.objectContaining({ exists: false, href: null })
    );
  });

  it("status·targetType 필터를 where 로 넘기고, 모르는 값은 무시한다", async () => {
    await call(adminReportsHandler, {
      method: "GET",
      user: admin,
      query: { status: "OPEN", targetType: "COMMENT" },
    });
    expect(mockClient.report.findMany.mock.calls[0][0].where).toEqual({
      status: "OPEN",
      targetType: "COMMENT",
    });

    await call(adminReportsHandler, {
      method: "GET",
      user: admin,
      query: { status: "ALL", targetType: "AUCTION" },
    });
    expect(mockClient.report.findMany.mock.calls[1][0].where).toEqual({});
  });
});

describe("GET /api/admin/reports 페이지", () => {
  it("기본은 1페이지 50건, 다음 페이지 여부를 알기 위해 1건 더 조회한다", async () => {
    const res = await call(adminReportsHandler, { method: "GET", user: admin });

    expect(mockClient.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
        skip: 0,
      })
    );
    expect(res.body.page).toBe(1);
    expect(res.body.hasMore).toBe(false);
  });

  it("51건이 오면 50건만 돌려주고 hasMore=true", async () => {
    mockClient.report.findMany.mockResolvedValue(
      Array.from({ length: 51 }, (_, i) => reportRow(i + 1, "POST", 30))
    );
    const res = await call(adminReportsHandler, { method: "GET", user: admin });

    expect(res.body.reports).toHaveLength(50);
    expect(res.body.reports[49].id).toBe(50);
    expect(res.body.hasMore).toBe(true);
  });

  it.each([
    ["3", 3, 100],
    ["0", 1, 0],
    ["abc", 1, 0],
    ["2.5", 1, 0],
  ])("page=%p → page %p, skip %p", async (page, expectedPage, expectedSkip) => {
    const res = await call(adminReportsHandler, { method: "GET", user: admin, query: { page } });

    expect(mockClient.report.findMany.mock.calls[0][0].skip).toBe(expectedSkip);
    expect(res.body.page).toBe(expectedPage);
  });

  it("채팅방 스냅샷 메시지는 한 번에 최대 5개 방씩만 조회한다", async () => {
    const roomIds = Array.from({ length: 12 }, (_, i) => 100 + i);
    mockClient.report.findMany.mockResolvedValue(
      roomIds.map((roomId, i) => reportRow(i + 1, "CHAT_ROOM", roomId))
    );
    mockClient.chatRoom.findMany.mockResolvedValue(roomIds.map((id) => ({ id })));

    let inFlight = 0;
    let maxInFlight = 0;
    mockClient.message.findMany.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return [];
    });

    const res = await call(adminReportsHandler, { method: "GET", user: admin });

    expect(res.statusCode).toBe(200);
    expect(mockClient.message.findMany).toHaveBeenCalledTimes(12);
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(res.body.reports.every((r: { target: { exists: boolean } }) => r.target.exists)).toBe(
      true
    );
  });

  it("숨김·삭제된 상품은 링크를 주지 않는다(웹 상세가 404)", async () => {
    mockClient.report.findMany.mockResolvedValue([
      reportRow(1, "PRODUCT", 40),
      reportRow(2, "PRODUCT", 41),
    ]);
    mockClient.product.findMany.mockResolvedValue([
      { id: 40, name: "왕사슴", description: "허위 매물", isHidden: true, isDeleted: false },
      { id: 41, name: "톱사슴", description: "정상", isHidden: false, isDeleted: false },
    ]);
    const res = await call(adminReportsHandler, { method: "GET", user: admin });

    const [hidden, visible] = res.body.reports;
    expect(hidden.target).toEqual(
      expect.objectContaining({ exists: true, title: "[숨김] 왕사슴", href: null })
    );
    expect(visible.target.href).toEqual(expect.stringContaining("/products/41"));
  });
});

describe("POST /api/admin/reports 처리", () => {
  const decide = (body: Record<string, unknown>) =>
    call(adminReportsHandler, { method: "POST", user: admin, body });

  const openReport = (targetType: TargetType, targetId: number) => {
    mockClient.report.findUnique.mockResolvedValue({
      id: 5,
      status: "OPEN",
      targetType,
      targetId,
      reportedUserId: 9,
    });
  };

  it("신고 기각에 제재 액션을 붙이면 400", async () => {
    openReport("POST", 30);
    const res = await decide({ reportId: 5, decision: "REJECTED", action: "BAN_USER" });
    expect(res.statusCode).toBe(400);
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
    expect(mockClient.report.update).not.toHaveBeenCalled();
  });

  it.each([
    ["CHAT_ROOM", "REMOVE_CONTENT"],
    ["USER", "REMOVE_CONTENT"],
    ["CHAT_ROOM", "REMOVE_CONTENT_AND_BAN"],
    ["USER", "REMOVE_CONTENT_AND_BAN"],
  ] as const)("%s 대상에 %s 는 400", async (targetType, action) => {
    openReport(targetType, 55);
    const res = await decide({ reportId: 5, decision: "RESOLVED", action });
    expect(res.statusCode).toBe(400);
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
    expect(mockClient.report.update).not.toHaveBeenCalled();
  });

  it("없는 신고는 404", async () => {
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "NONE" });
    expect(res.statusCode).toBe(404);
  });

  it("이미 처리된 신고는 400, 조치를 다시 하지 않는다", async () => {
    mockClient.report.findUnique.mockResolvedValue({
      id: 5,
      status: "RESOLVED",
      targetType: "POST",
      targetId: 30,
      reportedUserId: 9,
    });
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "REMOVE_CONTENT" });
    expect(res.statusCode).toBe(400);
    expect(mockClient.post.delete).not.toHaveBeenCalled();
    expect(mockClient.report.update).not.toHaveBeenCalled();
  });

  it("게시글 콘텐츠 삭제 → post.delete, 신고 상태 갱신", async () => {
    openReport("POST", 30);
    const res = await decide({
      reportId: 5,
      decision: "RESOLVED",
      action: "REMOVE_CONTENT",
      note: "  광고 삭제  ",
    });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.delete).toHaveBeenCalledWith({ where: { id: 30 } });
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
    const update = mockClient.report.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 5 });
    expect(update.data).toEqual({
      status: "RESOLVED",
      resolutionAction: "REMOVE_CONTENT",
      resolutionNote: "광고 삭제",
      resolvedBy: 1,
      resolvedAt: expect.any(Date),
    });
    expect(res.body.success).toBe(true);
    expect(res.body.reports).toHaveLength(1);
    expect(res.body.reports[0].id).toBe(5);
    expect(res.body.reports[0].target).toBeDefined();
    expect(res.body.counts).toEqual({ OPEN: 2, RESOLVED: 1, REJECTED: 0 });
  });

  it("댓글 콘텐츠 삭제 → comment.delete", async () => {
    openReport("COMMENT", 31);
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "REMOVE_CONTENT" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.comment.delete).toHaveBeenCalledWith({ where: { id: 31 } });
  });

  it("상품 콘텐츠 삭제 → hard delete 대신 isHidden=true", async () => {
    openReport("PRODUCT", 40);
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "REMOVE_CONTENT" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.product.update).toHaveBeenCalledWith({
      where: { id: 40 },
      data: { isHidden: true },
    });
  });

  it("유저 영구정지 → setUserStatus 로 BANNED + tokenVersion 증가", async () => {
    openReport("CHAT_ROOM", 55);
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "BAN_USER" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: { not: "DELETED" } },
      data: { status: "BANNED", suspendedUntil: null, tokenVersion: { increment: 1 } },
    });
    expect(mockClient.post.delete).not.toHaveBeenCalled();
  });

  it("삭제+정지 → 콘텐츠 삭제와 정지를 모두 한다", async () => {
    openReport("POST", 30);
    const res = await decide({
      reportId: 5,
      decision: "RESOLVED",
      action: "REMOVE_CONTENT_AND_BAN",
    });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.delete).toHaveBeenCalledWith({ where: { id: 30 } });
    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: { not: "DELETED" } },
      data: { status: "BANNED", suspendedUntil: null, tokenVersion: { increment: 1 } },
    });
  });

  it("콘텐츠가 이미 지워졌으면(P2025) 삭제는 건너뛰고 처리 완료한다", async () => {
    openReport("POST", 30);
    mockClient.post.delete.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "REMOVE_CONTENT" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.report.update).toHaveBeenCalled();
  });

  it("처리 완료(NONE)는 제재 없이 상태만 바꾼다", async () => {
    openReport("USER", 9);
    const res = await decide({ reportId: 5, decision: "RESOLVED" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
    expect(mockClient.report.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ status: "RESOLVED", resolutionAction: "NONE", resolutionNote: null })
    );
  });

  it("신고 기각(REJECTED, NONE)은 상태만 바꾼다", async () => {
    openReport("POST", 30);
    const res = await decide({ reportId: 5, decision: "REJECTED", action: "NONE" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.delete).not.toHaveBeenCalled();
    expect(mockClient.report.update.mock.calls[0][0].data.status).toBe("REJECTED");
  });
});
