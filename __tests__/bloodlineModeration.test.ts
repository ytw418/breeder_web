import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 혈통 운영 조치(설계 §3.7, AC-100): POST /api/admin/moderation 의 targetType "BLOODLINE_CARD".
 * hide → INACTIVE, unhide → ACTIVE, delete(= 회수) → REVOKED + 같은 뿌리 출처 카드 연쇄 회수.
 */

const mockClient = {
  post: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  comment: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  product: { findUnique: jest.fn(), update: jest.fn() },
  auction: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  bloodlineCard: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  bloodlineCardEvent: { createMany: jest.fn() },
  moderationLog: { create: jest.fn() },
  user: { update: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn(),
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
import { MODERATION_TARGET_TYPES, isModerationTargetType } from "@libs/server/moderation";
import { applyReportAction } from "@libs/server/reports";

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

const ROOT = {
  id: 70,
  cardType: "BLOODLINE",
  status: "ACTIVE",
  creatorId: 9,
  currentOwnerId: 9,
  name: "강산 라인",
  description: "충남 공주 왕사슴 혈통",
  speciesType: "왕사슴벌레",
};

const LINE = {
  id: 71,
  cardType: "LINE",
  status: "ACTIVE",
  creatorId: 9,
  currentOwnerId: 12,
  name: "강산 라인",
  description: "잘 키워 주세요",
  speciesType: "왕사슴벌레",
};

const revokedEventRows = () =>
  mockClient.bloodlineCardEvent.createMany.mock.calls.flatMap(
    ([arg]: [{ data: Record<string, unknown>[] }]) => arg.data
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockHasAdminAccess.mockResolvedValue(true);
  mockClient.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockClient)
  );
  mockClient.bloodlineCard.findUnique.mockResolvedValue(ROOT);
  mockClient.bloodlineCard.findMany.mockResolvedValue([
    { id: 71, currentOwnerId: 12 },
    { id: 72, currentOwnerId: 13 },
  ]);
  mockClient.bloodlineCard.updateMany.mockImplementation(
    ({ where }: { where: { id: number | { in: number[] } } }) =>
      Promise.resolve({
        count: typeof where.id === "number" ? 1 : where.id.in.length,
      })
  );
  mockClient.bloodlineCardEvent.createMany.mockImplementation(
    ({ data }: { data: unknown[] }) => Promise.resolve({ count: data.length })
  );
  mockClient.moderationLog.create.mockResolvedValue({ id: 1 });
});

describe("운영 대상 유형", () => {
  it("BLOODLINE_CARD 를 운영 대상으로 받는다", () => {
    expect(MODERATION_TARGET_TYPES).toContain("BLOODLINE_CARD");
    expect(isModerationTargetType("BLOODLINE_CARD")).toBe(true);
  });
});

describe("POST /api/admin/moderation — 혈통", () => {
  it("숨기면 INACTIVE", async () => {
    const res = await moderate({
      targetType: "BLOODLINE_CARD",
      targetId: 70,
      action: "hide",
      reason: "  이름 도용 신고  ",
    });

    expect(res.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledTimes(1);
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledWith({
      where: { id: 70, status: { not: "REVOKED" } },
      data: { status: "INACTIVE" },
    });
    // 숨김은 그 카드만 바꾸고 출처 카드·이력은 건드리지 않는다.
    expect(mockClient.bloodlineCard.findMany).not.toHaveBeenCalled();
    expect(mockClient.bloodlineCardEvent.createMany).not.toHaveBeenCalled();
    expect(mockClient.moderationLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 1,
        targetType: "BLOODLINE_CARD",
        targetId: 70,
        targetUserId: 9,
        action: "HIDE",
        reason: "이름 도용 신고",
        reasonCode: null,
        reportId: null,
        snapshot: { title: "강산 라인", excerpt: "충남 공주 왕사슴 혈통" },
      },
    });
    expect(res.body.result).toEqual({
      targetType: "BLOODLINE_CARD",
      targetId: 70,
      isHidden: true,
      deleted: false,
    });
  });

  it("숨김 해제면 ACTIVE", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValue({ ...ROOT, status: "INACTIVE" });

    const res = await moderate({ targetType: "BLOODLINE_CARD", targetId: 70, action: "unhide" });

    expect(res.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledWith({
      where: { id: 70, status: { not: "REVOKED" } },
      data: { status: "ACTIVE" },
    });
    expect(mockClient.moderationLog.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ action: "UNHIDE", targetUserId: 9 })
    );
    expect(res.body.result.isHidden).toBe(false);
  });

  it("회수하면 하위 출처 카드까지 REVOKED", async () => {
    const res = await moderate({ targetType: "BLOODLINE_CARD", targetId: 70, action: "delete" });

    expect(res.statusCode).toBe(200);
    // 회수와 연쇄 회수는 한 트랜잭션(직렬화)에서 한다 — 그 사이 새 출처 카드가 끼지 않게.
    expect(mockClient.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 70, status: { not: "REVOKED" } },
      data: { status: "REVOKED" },
    });
    expect(mockClient.bloodlineCard.findMany).toHaveBeenCalledWith({
      where: {
        cardType: "LINE",
        bloodlineReferenceId: 70,
        status: { in: ["ACTIVE", "INACTIVE"] },
      },
      select: { id: true, currentOwnerId: true },
    });
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: [71, 72] }, status: { not: "REVOKED" } },
      data: { status: "REVOKED" },
    });

    // 카드마다 CARD_REVOKED 이벤트 1건(뿌리 1 + 출처 카드 2)
    const events = revokedEventRows();
    expect(events).toHaveLength(3);
    expect(events.every((event) => event.action === "CARD_REVOKED")).toBe(true);
    expect(events.map((event) => event.cardId)).toEqual([70, 71, 72]);
    expect(events).toEqual([
      expect.objectContaining({ cardId: 70, fromUserId: 9, actorUserId: null, toUserId: null }),
      expect.objectContaining({ cardId: 71, fromUserId: 12, relatedCardId: 70 }),
      expect.objectContaining({ cardId: 72, fromUserId: 13, relatedCardId: 70 }),
    ]);

    expect(mockClient.moderationLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 1,
        targetType: "BLOODLINE_CARD",
        targetId: 70,
        targetUserId: 9,
        action: "DELETE",
        reason: null,
        reasonCode: null,
        reportId: null,
        snapshot: { title: "강산 라인", excerpt: "충남 공주 왕사슴 혈통" },
      },
    });
    expect(res.body.result).toEqual({
      targetType: "BLOODLINE_CARD",
      targetId: 70,
      isHidden: false,
      deleted: true,
    });
  });

  it("받은 사람이 없으면 뿌리만 회수하고 이벤트도 1건", async () => {
    mockClient.bloodlineCard.findMany.mockResolvedValue([]);

    const res = await moderate({ targetType: "BLOODLINE_CARD", targetId: 70, action: "delete" });

    expect(res.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledTimes(1);
    expect(revokedEventRows()).toHaveLength(1);
  });

  it("출처 카드를 회수하면 그 카드만 REVOKED", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValue(LINE);

    const res = await moderate({ targetType: "BLOODLINE_CARD", targetId: 71, action: "delete" });

    expect(res.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.findMany).not.toHaveBeenCalled();
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledTimes(1);
    expect(mockClient.bloodlineCard.updateMany).toHaveBeenCalledWith({
      where: { id: 71, status: { not: "REVOKED" } },
      data: { status: "REVOKED" },
    });
    expect(revokedEventRows()).toEqual([
      expect.objectContaining({ cardId: 71, action: "CARD_REVOKED", fromUserId: 12 }),
    ]);
    expect(mockClient.moderationLog.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        targetUserId: 9,
        snapshot: { title: "강산 라인", excerpt: "잘 키워 주세요" },
      })
    );
  });

  it("소개가 없으면 스냅샷 요약은 종 이름, 둘 다 없으면 빈 문자열", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValue({ ...ROOT, description: null });
    await moderate({ targetType: "BLOODLINE_CARD", targetId: 70, action: "delete" });
    expect(mockClient.moderationLog.create.mock.calls[0][0].data.snapshot).toEqual({
      title: "강산 라인",
      excerpt: "왕사슴벌레",
    });

    mockClient.moderationLog.create.mockClear();
    mockClient.bloodlineCard.findUnique.mockResolvedValue({
      ...ROOT,
      description: null,
      speciesType: null,
    });
    await moderate({ targetType: "BLOODLINE_CARD", targetId: 70, action: "delete" });
    expect(mockClient.moderationLog.create.mock.calls[0][0].data.snapshot).toEqual({
      title: "강산 라인",
      excerpt: "",
    });
  });

  it("대상이 없으면 404", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValue(null);

    const res = await moderate({ targetType: "BLOODLINE_CARD", targetId: 999, action: "delete" });

    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("MODERATION_TARGET_NOT_FOUND");
    expect(mockClient.bloodlineCard.updateMany).not.toHaveBeenCalled();
    expect(mockClient.moderationLog.create).not.toHaveBeenCalled();
  });

  it.each(["hide", "unhide", "delete"])(
    "이미 회수된 혈통은 대상이 없는 것으로 본다(%s → 404)",
    async (action) => {
      mockClient.bloodlineCard.findUnique.mockResolvedValue({ ...ROOT, status: "REVOKED" });

      const res = await moderate({ targetType: "BLOODLINE_CARD", targetId: 70, action });

      expect(res.statusCode).toBe(404);
      expect(mockClient.bloodlineCard.updateMany).not.toHaveBeenCalled();
      expect(mockClient.bloodlineCardEvent.createMany).not.toHaveBeenCalled();
      expect(mockClient.moderationLog.create).not.toHaveBeenCalled();
    }
  );

  it("조회 뒤 다른 요청이 먼저 회수했으면 404 이고 기록을 남기지 않는다", async () => {
    mockClient.bloodlineCard.updateMany.mockResolvedValue({ count: 0 });

    const hide = await moderate({ targetType: "BLOODLINE_CARD", targetId: 70, action: "hide" });
    expect(hide.statusCode).toBe(404);

    const revoke = await moderate({ targetType: "BLOODLINE_CARD", targetId: 70, action: "delete" });
    expect(revoke.statusCode).toBe(404);
    expect(mockClient.bloodlineCard.findMany).not.toHaveBeenCalled();
    expect(mockClient.bloodlineCardEvent.createMany).not.toHaveBeenCalled();
    expect(mockClient.moderationLog.create).not.toHaveBeenCalled();
  });

  it("관리자가 아니면 403 이고 아무것도 바꾸지 않는다", async () => {
    mockHasAdminAccess.mockResolvedValue(false);

    const res = await moderate({ targetType: "BLOODLINE_CARD", targetId: 70, action: "delete" });

    expect(res.statusCode).toBe(403);
    expect(mockClient.bloodlineCard.findUnique).not.toHaveBeenCalled();
    expect(mockClient.bloodlineCard.updateMany).not.toHaveBeenCalled();
  });
});

describe("신고 처리(applyReportAction) — 혈통", () => {
  it("콘텐츠 삭제는 혈통 회수로 처리하고 신고 id 를 기록한다", async () => {
    await applyReportAction(
      { id: 5, targetType: "BLOODLINE_CARD", targetId: 70, reportedUserId: 9 },
      "REMOVE_CONTENT",
      1
    );

    expect(mockClient.bloodlineCard.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 70, status: { not: "REVOKED" } },
      data: { status: "REVOKED" },
    });
    expect(revokedEventRows()).toHaveLength(3);
    expect(mockClient.moderationLog.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        targetType: "BLOODLINE_CARD",
        action: "DELETE",
        reportId: 5,
      })
    );
  });

  it("이미 회수된 혈통이면 회수는 건너뛰고 오류를 내지 않는다", async () => {
    mockClient.bloodlineCard.findUnique.mockResolvedValue({ ...ROOT, status: "REVOKED" });

    await expect(
      applyReportAction(
        { id: 5, targetType: "BLOODLINE_CARD", targetId: 70, reportedUserId: 9 },
        "REMOVE_CONTENT",
        1
      )
    ).resolves.toBeUndefined();
    expect(mockClient.moderationLog.create).not.toHaveBeenCalled();
  });
});
