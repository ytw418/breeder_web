import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 혈통 신고(설계 §3.7, AC-74·AC-101): 신고 대상 "BLOODLINE_CARD".
 * 피신고자는 혈통을 만든 사람이고, ACTIVE 가 아니면 신고 대상이 없다.
 */

const mockClient = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  post: { findUnique: jest.fn(), findMany: jest.fn() },
  comment: { findUnique: jest.fn(), findMany: jest.fn() },
  product: { findUnique: jest.fn(), findMany: jest.fn() },
  chatRoom: { findMany: jest.fn() },
  chatRoomMember: { findMany: jest.fn() },
  message: { findMany: jest.fn() },
  bloodlineCard: { findUnique: jest.fn(), findMany: jest.fn() },
  report: { findFirst: jest.fn(), create: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/notification", () => ({
  createNotification: jest.fn(),
}));

import reportHandler from "../pages/api/reports/index";
import { buildTargetSnapshots, resolveReportTarget } from "@libs/server/reports";
import {
  OTHER_REASON,
  REPORT_REASONS,
  REPORT_SHEET_TITLE,
  REPORT_TARGET_LABEL,
  REPORT_TARGET_TYPES,
  isRemovableReportTarget,
  isReportTargetType,
  isValidReportReason,
} from "@libs/shared/report";

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

async function report(body: Record<string, unknown>, userId = 7) {
  const res = createRes();
  await (reportHandler as (req: NextApiRequest, res: NextApiResponse) => unknown)(
    {
      method: "POST",
      headers: {},
      query: {},
      cookies: {},
      body,
      user: { id: userId, name: "신고자" },
    } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const CREATED_AT = new Date("2026-10-08T09:00:00.000Z");

const card = (overrides: Record<string, unknown> = {}) => ({
  id: 70,
  cardType: "BLOODLINE",
  status: "ACTIVE",
  name: "강산 라인",
  description: "충남 공주 왕사슴 혈통",
  speciesType: "왕사슴벌레",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.user.findUnique.mockResolvedValue({ id: 7, status: "ACTIVE" });
  mockClient.bloodlineCard.findUnique.mockResolvedValue({ creatorId: 9, status: "ACTIVE" });
  mockClient.report.findFirst.mockResolvedValue(null);
  mockClient.report.create.mockResolvedValue({ id: 100, status: "OPEN", createdAt: CREATED_AT });
});

describe("혈통 신고 상수(libs/shared/report)", () => {
  it("혈통 신고 사유 5개", () => {
    expect(REPORT_REASONS.BLOODLINE_CARD).toEqual([
      "남의 혈통 이름 도용",
      "허위 정보",
      "욕설·부적절 내용",
      "스팸·광고",
      OTHER_REASON,
    ]);
    expect(isValidReportReason("BLOODLINE_CARD", "남의 혈통 이름 도용")).toBe(true);
    expect(isValidReportReason("BLOODLINE_CARD", "사칭")).toBe(false);
  });

  it("BLOODLINE_CARD 는 신고 대상 유형이고 콘텐츠 조치(회수)를 할 수 있다", () => {
    expect(REPORT_TARGET_TYPES).toContain("BLOODLINE_CARD");
    expect(isReportTargetType("BLOODLINE_CARD")).toBe(true);
    expect(isRemovableReportTarget("BLOODLINE_CARD")).toBe(true);
    expect(isRemovableReportTarget("CHAT_ROOM")).toBe(false);
    expect(isRemovableReportTarget("USER")).toBe(false);
  });

  it("관리자 라벨은 '혈통', 신고 시트 제목은 '혈통 신고'", () => {
    expect(REPORT_TARGET_LABEL.BLOODLINE_CARD).toBe("혈통");
    expect(REPORT_SHEET_TITLE.BLOODLINE_CARD).toBe("혈통 신고");
  });
});

describe("resolveReportTarget(BLOODLINE_CARD)", () => {
  it("혈통 신고 대상은 만든 사람이다", async () => {
    const result = await resolveReportTarget("BLOODLINE_CARD", 70, 7);

    expect(result).toEqual({ ok: true, reportedUserId: 9 });
    expect(mockClient.bloodlineCard.findUnique).toHaveBeenCalledWith({
      where: { id: 70 },
      select: { creatorId: true, status: true },
    });
  });

  it.each([["INACTIVE"], ["REVOKED"]])("숨겨진 혈통은 신고 대상이 없다(%s)", async (status) => {
    mockClient.bloodlineCard.findUnique.mockResolvedValue({ creatorId: 9, status });

    const result = await resolveReportTarget("BLOODLINE_CARD", 70, 7);

    expect(result).toEqual(
      expect.objectContaining({ ok: false, status: 404, errorCode: "REPORT_TARGET_NOT_FOUND" })
    );
  });

  it("없는 혈통은 신고 대상이 없다", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValue(null);

    const result = await resolveReportTarget("BLOODLINE_CARD", 999, 7);

    expect(result).toEqual(expect.objectContaining({ ok: false, status: 404 }));
  });
});

describe("POST /api/reports — 혈통", () => {
  it("혈통 신고를 만든 사람을 피신고자로 접수한다", async () => {
    const res = await report({
      targetType: "BLOODLINE_CARD",
      targetId: 70,
      reason: "남의 혈통 이름 도용",
    });

    expect(res.statusCode).toBe(200);
    expect(mockClient.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetType: "BLOODLINE_CARD",
          targetId: 70,
          reporterId: 7,
          reportedUserId: 9,
          reason: "남의 혈통 이름 도용",
        }),
      })
    );
  });

  it("다른 대상의 사유로는 접수하지 않는다(400)", async () => {
    const res = await report({ targetType: "BLOODLINE_CARD", targetId: 70, reason: "사칭" });

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("REPORT_INVALID_REASON");
    expect(mockClient.report.create).not.toHaveBeenCalled();
  });

  it("자기가 만든 혈통은 신고할 수 없다(400)", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 9, status: "ACTIVE" });

    const res = await report(
      { targetType: "BLOODLINE_CARD", targetId: 70, reason: "허위 정보" },
      9
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("REPORT_SELF_NOT_ALLOWED");
    expect(mockClient.report.create).not.toHaveBeenCalled();
  });

  it("숨겨진 혈통 신고는 404", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValue({ creatorId: 9, status: "INACTIVE" });

    const res = await report({ targetType: "BLOODLINE_CARD", targetId: 70, reason: "허위 정보" });

    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("REPORT_TARGET_NOT_FOUND");
  });
});

describe("관리자 신고 스냅샷(buildTargetSnapshots) — 혈통", () => {
  const source = (targetId: number) => ({ targetType: "BLOODLINE_CARD" as const, targetId });

  it("혈통 이름·소개와 혈통 상세 링크를 준다", async () => {
    mockClient.bloodlineCard.findMany.mockResolvedValue([card()]);

    const [snapshot] = await buildTargetSnapshots([source(70)]);

    expect(mockClient.bloodlineCard.findMany).toHaveBeenCalledWith({
      where: { id: { in: [70] } },
      select: {
        id: true,
        cardType: true,
        status: true,
        name: true,
        description: true,
        speciesType: true,
      },
    });
    expect(snapshot).toEqual({
      exists: true,
      title: "강산 라인",
      excerpt: "충남 공주 왕사슴 혈통",
      href: "/bloodline-management/card/70",
    });
  });

  it("소개가 없으면 종 이름을 요약으로 쓴다", async () => {
    mockClient.bloodlineCard.findMany.mockResolvedValue([card({ description: null })]);

    const [snapshot] = await buildTargetSnapshots([source(70)]);

    expect(snapshot.excerpt).toBe("왕사슴벌레");
  });

  it("출처 카드는 제목에 표시한다", async () => {
    mockClient.bloodlineCard.findMany.mockResolvedValue([
      card({ id: 71, cardType: "LINE", description: "잘 키워 주세요" }),
    ]);

    const [snapshot] = await buildTargetSnapshots([source(71)]);

    expect(snapshot).toEqual(
      expect.objectContaining({
        title: "강산 라인 (출처 카드)",
        href: "/bloodline-management/card/71",
      })
    );
  });

  it("숨김·회수된 혈통은 상태를 붙이고 링크를 주지 않는다(상세가 404)", async () => {
    mockClient.bloodlineCard.findMany.mockResolvedValue([
      card({ id: 70, status: "INACTIVE" }),
      card({ id: 72, status: "REVOKED" }),
    ]);

    const [hidden, revoked] = await buildTargetSnapshots([source(70), source(72)]);

    expect(hidden).toEqual(
      expect.objectContaining({ exists: true, title: "[숨김] 강산 라인", href: null })
    );
    expect(revoked).toEqual(
      expect.objectContaining({ exists: true, title: "[회수] 강산 라인", href: null })
    );
  });

  it("없는 혈통은 '삭제된 혈통'", async () => {
    mockClient.bloodlineCard.findMany.mockResolvedValue([]);

    const [snapshot] = await buildTargetSnapshots([source(999)]);

    expect(snapshot).toEqual({ exists: false, title: "삭제된 혈통", excerpt: "", href: null });
  });

  it("혈통 신고가 없으면 혈통 카드를 조회하지 않는다", async () => {
    mockClient.post.findMany.mockResolvedValue([]);

    await buildTargetSnapshots([{ targetType: "POST", targetId: 30 }]);

    expect(mockClient.bloodlineCard.findMany).not.toHaveBeenCalled();
  });
});
