import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn() },
  post: { findUnique: jest.fn() },
  comment: { findUnique: jest.fn() },
  product: { findUnique: jest.fn() },
  chatRoomMember: { findMany: jest.fn() },
  report: { findFirst: jest.fn(), create: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import reportHandler from "../pages/api/reports/index";
import {
  OTHER_REASON,
  REPORT_DETAIL_MAX,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  isValidReportReason,
} from "@libs/shared/report";

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
    { headers: {}, query: {}, body: {}, cookies: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const me = { id: 7, name: "신고자" } as NextApiRequest["user"];
const CREATED_AT = new Date("2026-10-01T09:00:00.000Z");
const validPostReport = { targetType: "POST", targetId: 30, reason: "스팸·광고" };

const report = (body: Record<string, unknown>, user: NextApiRequest["user"] = me) =>
  call(reportHandler, { method: "POST", user, body });

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.user.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
    Promise.resolve(
      where.id === 7
        ? { id: 7, status: "ACTIVE" }
        : where.id === 9
          ? { id: 9, status: "ACTIVE" }
          : null
    )
  );
  mockClient.post.findUnique.mockResolvedValue({ userId: 9 });
  mockClient.comment.findUnique.mockResolvedValue({ userId: 9 });
  mockClient.product.findUnique.mockResolvedValue({ userId: 9, isDeleted: false });
  mockClient.chatRoomMember.findMany.mockResolvedValue([{ userId: 7 }, { userId: 12 }]);
  mockClient.report.findFirst.mockResolvedValue(null);
  mockClient.report.create.mockResolvedValue({
    id: 100,
    status: "OPEN",
    createdAt: CREATED_AT,
  });
});

describe("신고 사유 상수(libs/shared/report)", () => {
  it("대상 유형 6종과 대상별 사유 목록, 모든 목록 끝은 기타", () => {
    expect(REPORT_TARGET_TYPES).toEqual([
      "POST",
      "COMMENT",
      "PRODUCT",
      "CHAT_ROOM",
      "USER",
      "BLOODLINE_CARD",
    ]);
    expect(REPORT_REASONS.POST).toEqual([
      "스팸·광고",
      "욕설·비하·혐오 표현",
      "음란·선정적 내용",
      "개인정보 노출",
      "허위 정보",
      "기타",
    ]);
    expect(REPORT_REASONS.COMMENT).toEqual(REPORT_REASONS.POST);
    expect(REPORT_REASONS.PRODUCT).toEqual([
      "허위 매물·사기 의심",
      "거래 금지 품목(불법 개체)",
      "중복·도배 게시",
      "욕설·부적절 내용",
      "기타",
    ]);
    expect(REPORT_REASONS.CHAT_ROOM).toEqual([
      "욕설·협박",
      "사기 의심",
      "스팸·광고",
      "음란 메시지",
      "기타",
    ]);
    expect(REPORT_REASONS.USER).toEqual([
      "사칭",
      "사기 이력 의심",
      "반복적 욕설·괴롭힘",
      "스팸 계정",
      "기타",
    ]);
    expect(REPORT_REASONS.BLOODLINE_CARD).toEqual([
      "남의 혈통 이름 도용",
      "허위 정보",
      "욕설·부적절 내용",
      "스팸·광고",
      "기타",
    ]);
    for (const type of REPORT_TARGET_TYPES) {
      expect(REPORT_REASONS[type][REPORT_REASONS[type].length - 1]).toBe(OTHER_REASON);
    }
  });

  it("isValidReportReason 은 대상 유형별 목록만 허용한다", () => {
    expect(isValidReportReason("POST", "스팸·광고")).toBe(true);
    expect(isValidReportReason("POST", "사칭")).toBe(false);
    expect(isValidReportReason("USER", "사칭")).toBe(true);
    expect(isValidReportReason("USER", "")).toBe(false);
  });
});

describe("POST /api/reports 검증", () => {
  it("로그인하지 않으면 401 REPORT_AUTH_REQUIRED", async () => {
    const res = await call(reportHandler, { method: "POST", body: validPostReport });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({ success: false, errorCode: "REPORT_AUTH_REQUIRED" })
    );
    expect(typeof res.body.error).toBe("string");
    expect(mockClient.report.create).not.toHaveBeenCalled();
  });

  it.each(["AUCTION", "", undefined, "post"])(
    "targetType=%p 은 400 REPORT_INVALID_TARGET_TYPE",
    async (targetType) => {
      const res = await report({ ...validPostReport, targetType });
      expect(res.statusCode).toBe(400);
      expect(res.body.errorCode).toBe("REPORT_INVALID_TARGET_TYPE");
      expect(res.body.success).toBe(false);
    }
  );

  it.each([0, -1, 1.5, "abc", "", null, undefined, true, 2 ** 31])(
    "targetId=%p 은 400 REPORT_INVALID_TARGET_ID",
    async (targetId) => {
      const res = await report({ ...validPostReport, targetId });
      expect(res.statusCode).toBe(400);
      expect(res.body.errorCode).toBe("REPORT_INVALID_TARGET_ID");
    }
  );

  it("대상 유형 목록에 없는 사유는 400 REPORT_INVALID_REASON", async () => {
    const res = await report({ ...validPostReport, reason: "사칭" });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("REPORT_INVALID_REASON");
  });

  it("기타 사유에 내용이 5자 미만이면 400 REPORT_DETAIL_REQUIRED", async () => {
    const res = await report({ ...validPostReport, reason: OTHER_REASON, detail: "  1234  " });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: "기타 사유는 신고 내용을 5자 이상 입력해주세요.",
      errorCode: "REPORT_DETAIL_REQUIRED",
    });
  });

  it("기타 사유에 내용이 없으면 400 REPORT_DETAIL_REQUIRED", async () => {
    const res = await report({ ...validPostReport, reason: OTHER_REASON });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("REPORT_DETAIL_REQUIRED");
  });

  it("기타 사유에 내용이 5자면 접수한다", async () => {
    const res = await report({ ...validPostReport, reason: OTHER_REASON, detail: "12345" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.report.create.mock.calls[0][0].data.detail).toBe("12345");
  });

  it("내용이 500자를 넘으면 400 REPORT_INVALID_DETAIL_LENGTH", async () => {
    const res = await report({
      ...validPostReport,
      detail: "가".repeat(REPORT_DETAIL_MAX + 1),
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("REPORT_INVALID_DETAIL_LENGTH");
  });

  it("내용이 정확히 500자면 접수한다", async () => {
    const res = await report({ ...validPostReport, detail: "가".repeat(REPORT_DETAIL_MAX) });
    expect(res.statusCode).toBe(200);
  });

  it("신고자 계정이 BANNED 면 403 REPORT_ACCOUNT_RESTRICTED, 대상 조회 안 함", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 7, status: "BANNED" });
    const res = await report(validPostReport);
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("REPORT_ACCOUNT_RESTRICTED");
    expect(mockClient.post.findUnique).not.toHaveBeenCalled();
    expect(mockClient.report.create).not.toHaveBeenCalled();
  });

  it("게시글이 없으면 404 REPORT_TARGET_NOT_FOUND", async () => {
    mockClient.post.findUnique.mockResolvedValue(null);
    const res = await report(validPostReport);
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("REPORT_TARGET_NOT_FOUND");
    expect(mockClient.report.create).not.toHaveBeenCalled();
  });

  it("삭제 처리된 상품은 404 REPORT_TARGET_NOT_FOUND", async () => {
    mockClient.product.findUnique.mockResolvedValue({ userId: 9, isDeleted: true });
    const res = await report({ targetType: "PRODUCT", targetId: 40, reason: "중복·도배 게시" });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("REPORT_TARGET_NOT_FOUND");
  });

  it("참여하지 않은 채팅방은 403 REPORT_TARGET_FORBIDDEN", async () => {
    mockClient.chatRoomMember.findMany.mockResolvedValue([{ userId: 9 }, { userId: 12 }]);
    const res = await report({ targetType: "CHAT_ROOM", targetId: 55, reason: "욕설·협박" });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("REPORT_TARGET_FORBIDDEN");
    expect(mockClient.report.create).not.toHaveBeenCalled();
  });

  it("없는 채팅방은 404 REPORT_TARGET_NOT_FOUND", async () => {
    mockClient.chatRoomMember.findMany.mockResolvedValue([]);
    const res = await report({ targetType: "CHAT_ROOM", targetId: 55, reason: "욕설·협박" });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("REPORT_TARGET_NOT_FOUND");
  });

  it("본인 게시글은 400 REPORT_SELF_NOT_ALLOWED", async () => {
    mockClient.post.findUnique.mockResolvedValue({ userId: 7 });
    const res = await report(validPostReport);
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("REPORT_SELF_NOT_ALLOWED");
    expect(mockClient.report.create).not.toHaveBeenCalled();
  });

  it("본인 계정 신고는 400 REPORT_SELF_NOT_ALLOWED", async () => {
    const res = await report({ targetType: "USER", targetId: 7, reason: "사칭" });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("REPORT_SELF_NOT_ALLOWED");
  });

  it("같은 대상에 처리 대기 중인 내 신고가 있으면 400 REPORT_ALREADY_EXISTS", async () => {
    mockClient.report.findFirst.mockResolvedValue({ id: 1 });
    const res = await report(validPostReport);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: "이미 접수된 신고가 있습니다. 운영자 검토를 기다려주세요.",
      errorCode: "REPORT_ALREADY_EXISTS",
    });
    expect(mockClient.report.findFirst.mock.calls[0][0].where).toEqual({
      targetType: "POST",
      targetId: 30,
      reporterId: 7,
      status: "OPEN",
    });
    expect(mockClient.report.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/reports 접수", () => {
  it("게시글 신고: 피신고자는 글 작성자, 내용이 없으면 detail=null", async () => {
    const res = await report(validPostReport);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      report: { id: 100, status: "OPEN", createdAt: CREATED_AT.toISOString() },
    });
    expect(mockClient.post.findUnique.mock.calls[0][0].where).toEqual({ id: 30 });
    expect(mockClient.report.create.mock.calls[0][0].data).toEqual({
      targetType: "POST",
      targetId: 30,
      reporterId: 7,
      reportedUserId: 9,
      reason: "스팸·광고",
      detail: null,
    });
  });

  it("targetId 는 숫자 문자열도 받는다, 내용은 앞뒤 공백을 자른다", async () => {
    const res = await report({ ...validPostReport, targetId: "30", detail: "  광고 글입니다  " });
    expect(res.statusCode).toBe(200);
    const data = mockClient.report.create.mock.calls[0][0].data;
    expect(data.targetId).toBe(30);
    expect(data.detail).toBe("광고 글입니다");
  });

  it("공백뿐인 내용은 detail=null 로 저장한다", async () => {
    await report({ ...validPostReport, detail: "   " });
    expect(mockClient.report.create.mock.calls[0][0].data.detail).toBeNull();
  });

  it("댓글 신고: 피신고자는 댓글 작성자", async () => {
    mockClient.comment.findUnique.mockResolvedValue({ userId: 21 });
    const res = await report({ targetType: "COMMENT", targetId: 31, reason: "허위 정보" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.report.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ targetType: "COMMENT", targetId: 31, reportedUserId: 21 })
    );
  });

  it("상품 신고: 피신고자는 판매자", async () => {
    mockClient.product.findUnique.mockResolvedValue({ userId: 22, isDeleted: false });
    const res = await report({
      targetType: "PRODUCT",
      targetId: 40,
      reason: "허위 매물·사기 의심",
    });
    expect(res.statusCode).toBe(200);
    expect(mockClient.report.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ targetType: "PRODUCT", targetId: 40, reportedUserId: 22 })
    );
  });

  it("채팅 신고: 피신고자는 채팅방의 상대 멤버", async () => {
    const res = await report({ targetType: "CHAT_ROOM", targetId: 55, reason: "사기 의심" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.chatRoomMember.findMany.mock.calls[0][0].where).toEqual({
      chatRoomId: 55,
    });
    expect(mockClient.report.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ targetType: "CHAT_ROOM", targetId: 55, reportedUserId: 12 })
    );
  });

  it("사용자 신고: 피신고자는 대상 사용자", async () => {
    const res = await report({ targetType: "USER", targetId: 9, reason: "스팸 계정" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.report.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ targetType: "USER", targetId: 9, reportedUserId: 9 })
    );
  });

  it("없는 사용자 신고는 404 REPORT_TARGET_NOT_FOUND", async () => {
    const res = await report({ targetType: "USER", targetId: 999, reason: "스팸 계정" });
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("REPORT_TARGET_NOT_FOUND");
  });
});
