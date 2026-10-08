import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  report: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  post: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  comment: { findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  product: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  moderationLog: { create: jest.fn() },
  user: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  chatRoom: { findMany: jest.fn() },
  message: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
const mockCreateNotification = jest.fn();
jest.mock("@libs/server/notification", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

const mockIssueSanction = jest.fn();
jest.mock("@libs/server/sanctions", () => {
  class SanctionError extends Error {
    constructor(
      readonly status: number,
      message: string,
      readonly code: string
    ) {
      super(message);
      Object.setPrototypeOf(this, SanctionError.prototype);
    }
  }
  return {
    SanctionError,
    isSanctionError: (error: unknown) => error instanceof SanctionError,
    issueSanction: (...args: unknown[]) => mockIssueSanction(...args),
  };
});
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
  mockClient.moderationLog.create.mockResolvedValue({ id: 1 });
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

  const openReport = (targetType: TargetType, targetId: number, extra: Record<string, unknown> = {}) => {
    mockClient.report.findUnique.mockResolvedValue({
      id: 5,
      status: "OPEN",
      targetType,
      targetId,
      reportedUserId: 9,
      reporterId: 7,
      reason: "스팸·광고",
      ...extra,
    });
  };

  beforeEach(() => {
    mockClient.report.updateMany.mockResolvedValue({ count: 1 });
    mockClient.report.findMany.mockImplementation(({ where }: { where: { id?: { in: number[] } } }) =>
      Promise.resolve((where.id?.in ?? []).map((id) => reportRow(id, "POST", 30)))
    );
    mockIssueSanction.mockResolvedValue({ sanction: { id: 100 }, user: { status: "SUSPENDED", suspendedUntil: null } });
  });

  it("신고 기각에 조치를 붙이면 400 이고 아무것도 바꾸지 않는다(AC-19)", async () => {
    openReport("POST", 30);
    for (const body of [
      { reportId: 5, decision: "REJECTED", action: "BAN_USER" },
      { reportId: 5, decision: "REJECTED", contentAction: "HIDE" },
      { reportId: 5, decision: "REJECTED", userAction: { type: "WARNING", reasonCode: "SPAM" } },
    ]) {
      const res = await decide(body);
      expect(res.statusCode).toBe(400);
    }
    expect(mockClient.report.updateMany).not.toHaveBeenCalled();
    expect(mockIssueSanction).not.toHaveBeenCalled();
  });

  it.each([
    ["CHAT_ROOM", { action: "REMOVE_CONTENT" }],
    ["USER", { action: "REMOVE_CONTENT_AND_BAN" }],
    ["CHAT_ROOM", { contentAction: "HIDE" }],
    ["USER", { contentAction: "DELETE" }],
  ] as const)("%s 대상에 콘텐츠 조치 %j 는 400", async (targetType, body) => {
    openReport(targetType, 55);
    const res = await decide({ reportId: 5, decision: "RESOLVED", ...body });
    expect(res.statusCode).toBe(400);
    expect(mockClient.report.updateMany).not.toHaveBeenCalled();
  });

  it("잘못된 조치 값은 400", async () => {
    openReport("POST", 30);
    expect((await decide({ reportId: 5, decision: "RESOLVED", contentAction: "BURN" })).statusCode).toBe(400);
    expect((await decide({ reportId: 5, decision: "RESOLVED", userAction: { type: "LIFT" } })).statusCode).toBe(400);
    expect(
      (await decide({ reportId: 5, decision: "RESOLVED", userAction: { type: "SUSPENSION", days: 5 } })).statusCode
    ).toBe(400);
  });

  it("없는 신고는 404", async () => {
    const res = await decide({ reportId: 5, decision: "RESOLVED" });
    expect(res.statusCode).toBe(404);
  });

  it("이미 처리된 신고는 409, 조치를 다시 하지 않는다(E-4)", async () => {
    openReport("POST", 30, { status: "RESOLVED" });
    const res = await decide({ reportId: 5, decision: "RESOLVED", contentAction: "HIDE" });
    expect(res.statusCode).toBe(409);
    expect(res.body.errorCode).toBe("REPORT_ALREADY_RESOLVED");
    expect(mockClient.post.update).not.toHaveBeenCalled();
    expect(mockClient.moderationLog.create).not.toHaveBeenCalled();
  });

  it("동시에 처리돼 차지하지 못하면 409 이고 조치하지 않는다(AC-18)", async () => {
    openReport("POST", 30);
    mockClient.report.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await decide({ reportId: 5, decision: "RESOLVED", userAction: { type: "WARNING" } });
    expect(res.statusCode).toBe(409);
    expect(mockIssueSanction).not.toHaveBeenCalled();
    expect(mockClient.moderationLog.create).not.toHaveBeenCalled();
  });

  it("구 방식 REMOVE_CONTENT 는 게시글을 지우지 않고 숨긴다(AC-5)", async () => {
    openReport("POST", 30);
    const res = await decide({ reportId: 5, decision: "RESOLVED", action: "REMOVE_CONTENT", note: "  광고  " });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.delete).not.toHaveBeenCalled();
    expect(mockClient.post.update).toHaveBeenCalledWith({ where: { id: 30 }, data: { isHidden: true } });
    expect(mockClient.moderationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "HIDE", reportId: 5, reasonCode: "SPAM" }),
    });
    // 먼저 신고를 차지하고, 끝나면 결과를 남긴다.
    expect(mockClient.report.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 5, status: "OPEN" },
      data: { status: "RESOLVED", resolvedBy: 1, resolvedAt: expect.any(Date), resolutionNote: "광고" },
    });
    expect(mockClient.report.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { resolutionAction: "REMOVE_CONTENT", contentAction: "HIDE", sanctionId: null },
    });
    expect(res.body.reports.map((report: { id: number }) => report.id)).toEqual([5]);
    expect(res.body.counts).toEqual({ OPEN: 2, RESOLVED: 1, REJECTED: 0 });
  });

  it("숨김 + 10일 정지를 한 번에 적용하고 결과를 남긴다(AC-16)", async () => {
    openReport("POST", 30);
    const res = await decide({
      reportId: 5,
      decision: "RESOLVED",
      contentAction: "HIDE",
      userAction: { type: "SUSPENSION", days: 10, reasonCode: "SPAM", messageToUser: "도배", internalNote: "3회째" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockIssueSanction).toHaveBeenCalledWith({
      actorId: 1,
      userId: 9,
      type: "SUSPENSION",
      days: 10,
      reasonCode: "SPAM",
      messageToUser: "도배",
      internalNote: "3회째",
      reportId: 5,
      target: { type: "POST", id: 30, title: "문제 게시글", excerpt: "광고 내용입니다" },
    });
    expect(mockClient.post.update).toHaveBeenCalledWith({ where: { id: 30 }, data: { isHidden: true } });
    expect(mockClient.report.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { resolutionAction: "REMOVE_CONTENT", contentAction: "HIDE", sanctionId: 100 },
    });
    expect(res.body.sanctionId).toBe(100);
  });

  it("사유를 고르지 않으면 신고 사유에서 기본값을 쓴다", async () => {
    openReport("CHAT_ROOM", 55, { reason: "욕설·협박" });
    await decide({ reportId: 5, decision: "RESOLVED", userAction: { type: "WARNING" } });
    expect(mockIssueSanction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "WARNING", reasonCode: "HARASSMENT", target: null })
    );
  });

  it("구 방식 BAN_USER 는 영구 정지 제재로 보낸다", async () => {
    openReport("USER", 9);
    await decide({ reportId: 5, decision: "RESOLVED", action: "BAN_USER" });
    expect(mockIssueSanction).toHaveBeenCalledWith(expect.objectContaining({ type: "BAN", reasonCode: "SPAM" }));
    expect(mockClient.report.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { resolutionAction: "BAN_USER", contentAction: null, sanctionId: 100 },
    });
  });

  it("제재가 거절되면 신고를 다시 열고 그 상태 코드를 돌려준다(E-14)", async () => {
    openReport("POST", 30);
    const { SanctionError } = jest.requireMock("@libs/server/sanctions");
    mockIssueSanction.mockRejectedValue(new SanctionError(409, "영구 정지된 계정이에요. 먼저 정지를 해제해 주세요.", "USER_BANNED"));
    const res = await decide({ reportId: 5, decision: "RESOLVED", contentAction: "HIDE", userAction: { type: "SUSPENSION", days: 3 } });
    expect(res.statusCode).toBe(409);
    expect(res.body.errorCode).toBe("USER_BANNED");
    expect(mockClient.report.updateMany).toHaveBeenLastCalledWith({
      where: { id: 5, status: "RESOLVED", resolvedBy: 1 },
      data: { status: "OPEN", resolvedBy: null, resolvedAt: null, resolutionNote: null },
    });
    expect(mockClient.moderationLog.create).not.toHaveBeenCalled();
  });

  it("같은 대상 열린 신고를 함께 닫고 제재는 1건, 신고자마다 알림 1건(AC-17·AC-33)", async () => {
    openReport("POST", 30);
    mockClient.report.findMany.mockImplementationOnce(() =>
      Promise.resolve([
        { id: 6, reporterId: 8 },
        { id: 7, reporterId: 7 },
      ])
    );
    const res = await decide({
      reportId: 5,
      decision: "RESOLVED",
      contentAction: "HIDE",
      userAction: { type: "WARNING", reasonCode: "SPAM" },
      closeSameTarget: true,
    });
    expect(res.statusCode).toBe(200);
    expect(mockIssueSanction).toHaveBeenCalledTimes(1);
    expect(mockClient.report.findMany.mock.calls[0][0].where).toEqual({
      targetType: "POST",
      targetId: 30,
      status: "OPEN",
      id: { not: 5 },
    });
    expect(mockClient.report.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: [6, 7] }, status: "OPEN" },
      data: expect.objectContaining({ status: "RESOLVED", contentAction: "HIDE", sanctionId: 100 }),
    });
    expect(res.body.closedReportIds).toEqual([5, 6, 7]);
    const reporterNotices = mockCreateNotification.mock.calls
      .map(([arg]) => arg)
      .filter((arg) => arg.message === "신고하신 게시글에 대해 운영정책에 따라 조치했어요.");
    expect(reporterNotices.map((arg) => arg.userId).sort()).toEqual([7, 8]);
  });

  it("콘텐츠가 이미 없으면 콘텐츠 조치는 건너뛰고 처리 완료한다(E-5)", async () => {
    openReport("POST", 30);
    mockClient.post.findUnique.mockResolvedValue(null);
    const res = await decide({ reportId: 5, decision: "RESOLVED", contentAction: "HIDE" });
    expect(res.statusCode).toBe(200);
    expect(res.body.contentSkipped).toBe(true);
    expect(mockClient.moderationLog.create).not.toHaveBeenCalled();
    expect(mockClient.report.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { resolutionAction: "NONE", contentAction: null, sanctionId: null },
    });
    // 아무 조치도 적용되지 않았으니 신고자에게 알리지 않는다.
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("콘텐츠 삭제는 게시글 hard delete(사유 기록)", async () => {
    openReport("POST", 30);
    const res = await decide({ reportId: 5, decision: "RESOLVED", contentAction: "DELETE" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.post.delete).toHaveBeenCalledWith({ where: { id: 30 } });
    expect(mockClient.report.update.mock.calls[0][0].data.contentAction).toBe("DELETE");
  });

  it("처리 완료(조치 없음)·기각은 상태만 바꾸고 신고자 알림을 보내지 않는다", async () => {
    openReport("USER", 9);
    expect((await decide({ reportId: 5, decision: "RESOLVED" })).statusCode).toBe(200);
    openReport("POST", 30);
    expect((await decide({ reportId: 5, decision: "REJECTED", action: "NONE" })).statusCode).toBe(200);
    expect(mockClient.report.updateMany.mock.calls.map(([arg]) => arg.data.status)).toEqual(["RESOLVED", "REJECTED"]);
    expect(mockIssueSanction).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
