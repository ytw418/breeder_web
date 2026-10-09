const mockClient = {
  $transaction: jest.fn(),
  user: { findUnique: jest.fn(), updateMany: jest.fn() },
  userSanction: { create: jest.fn(), count: jest.fn(), groupBy: jest.fn(), findFirst: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

const mockCreateNotification = jest.fn();
jest.mock("@libs/server/notification", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

import {
  SanctionError,
  getSanctionSummary,
  issueSanction,
  toUserSanctionView,
  withRestrictionNotice,
} from "@libs/server/sanctions";
import type { LoginBlock } from "@libs/server/accountStatus";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-09T05:20:00.000Z"); // KST 14:20
const ADMIN = 1;
const TARGET = 7;

const sanctionRow = (data: Record<string, unknown>) => ({
  id: 100,
  createdAt: NOW,
  acknowledgedAt: null,
  ...data,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.$transaction.mockImplementation((fn: (tx: typeof mockClient) => unknown) => fn(mockClient));
  mockClient.user.findUnique.mockResolvedValue({ status: "ACTIVE", suspendedUntil: null });
  mockClient.user.updateMany.mockResolvedValue({ count: 1 });
  mockClient.userSanction.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve(sanctionRow(data))
  );
});

const base = { actorId: ADMIN, userId: TARGET, now: NOW };

describe("issueSanction — 경고", () => {
  it("상태는 그대로 두고 제재 1건과 MODERATION 알림 1건을 만든다(AC-13)", async () => {
    const result = await issueSanction({
      ...base,
      type: "WARNING",
      reasonCode: "ABUSE",
      messageToUser: " 댓글에서 비하 표현이 확인되었어요. ",
      internalNote: "신고 3건",
      reportId: 55,
      target: { type: "COMMENT", id: 9, title: "초보면 가만히나 있지", excerpt: "초보면 가만히나 있지, 아는 척..." },
    });

    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
    expect(mockClient.userSanction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: TARGET,
        actorId: ADMIN,
        type: "WARNING",
        reasonCode: "ABUSE",
        messageToUser: "댓글에서 비하 표현이 확인되었어요.",
        internalNote: "신고 3건",
        days: null,
        endsAt: null,
        reportId: 55,
        targetType: "COMMENT",
        targetId: 9,
        snapshot: { title: "초보면 가만히나 있지", excerpt: "초보면 가만히나 있지, 아는 척..." },
      }),
    });
    expect(result.user).toEqual({ status: "ACTIVE", suspendedUntil: null });
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      type: "MODERATION",
      userId: TARGET,
      senderId: ADMIN,
      message: "운영정책 위반으로 경고를 받았어요. 사유: 욕설·비하·혐오 표현",
      targetType: "sanction",
      targetId: 100,
    });
  });

  it("정지 중인 사용자에게도 줄 수 있다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ status: "SUSPENDED", suspendedUntil: new Date(NOW.getTime() + DAY_MS) });
    await expect(issueSanction({ ...base, type: "WARNING", reasonCode: "SPAM" })).resolves.toBeTruthy();
  });

  it("notify:false 면 알림을 보내지 않는다", async () => {
    await issueSanction({ ...base, type: "WARNING", reasonCode: "SPAM", notify: false });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

describe("issueSanction — 기간 정지", () => {
  it("3일 정지는 SUSPENDED·만료 시각·tokenVersion+1·제재 1건을 남긴다(AC-7)", async () => {
    const result = await issueSanction({ ...base, type: "SUSPENSION", days: 3, reasonCode: "SPAM" });
    const until = new Date(NOW.getTime() + 3 * DAY_MS);

    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: TARGET, status: "ACTIVE", suspendedUntil: null },
      data: { status: "SUSPENDED", suspendedUntil: until, tokenVersion: { increment: 1 } },
    });
    expect(mockClient.userSanction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "SUSPENSION", days: 3, startsAt: NOW, endsAt: until }),
    });
    expect(result.user).toEqual({ status: "SUSPENDED", suspendedUntil: until });
    expect(mockCreateNotification.mock.calls[0][0].message).toBe(
      "운영정책 위반으로 3일 동안 이용이 정지되었어요. 사유: 스팸·광고"
    );
  });

  it("정지 중이면 남은 기간에 더하고 '늘어났어요' 알림을 보낸다(AC-39)", async () => {
    const current = new Date(NOW.getTime() + 2 * DAY_MS);
    mockClient.user.findUnique.mockResolvedValue({ status: "SUSPENDED_7D", suspendedUntil: current });

    const result = await issueSanction({ ...base, type: "SUSPENSION", days: 3, reasonCode: "SPAM" });
    const until = new Date(NOW.getTime() + 5 * DAY_MS);

    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: TARGET, status: "SUSPENDED_7D", suspendedUntil: current },
      data: { status: "SUSPENDED", suspendedUntil: until, tokenVersion: { increment: 1 } },
    });
    expect(result.user.suspendedUntil).toEqual(until);
    expect(mockCreateNotification.mock.calls[0][0].message).toBe(
      "운영정책 위반으로 이용 정지가 3일 늘어났어요. 2026.10.14 이후 다시 이용할 수 있어요. 사유: 스팸·광고"
    );
  });

  it("영구 정지 계정에는 409 를 주고 아무것도 바꾸지 않는다(AC-40)", async () => {
    mockClient.user.findUnique.mockResolvedValue({ status: "BANNED", suspendedUntil: null });
    await expect(issueSanction({ ...base, type: "SUSPENSION", days: 3, reasonCode: "SPAM" })).rejects.toMatchObject({
      status: 409,
      code: "USER_BANNED",
    });
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
    expect(mockClient.userSanction.create).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("읽은 뒤 다른 운영자가 상태를 바꿨으면 409", async () => {
    mockClient.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(issueSanction({ ...base, type: "SUSPENSION", days: 3, reasonCode: "SPAM" })).rejects.toMatchObject({
      status: 409,
      code: "STATUS_CHANGED",
    });
    expect(mockClient.userSanction.create).not.toHaveBeenCalled();
  });

  it("목록 밖 일수는 400 이고 DB 를 건드리지 않는다(AC-8)", async () => {
    await expect(issueSanction({ ...base, type: "SUSPENSION", days: 5, reasonCode: "SPAM" })).rejects.toMatchObject({
      status: 400,
    });
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });
});

describe("issueSanction — 영구 정지·해제", () => {
  it("영구 정지는 BANNED·tokenVersion+1(읽은 상태 그대로일 때만)", async () => {
    const result = await issueSanction({ ...base, type: "BAN", reasonCode: "FRAUD" });
    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: TARGET, status: "ACTIVE", suspendedUntil: null },
      data: { status: "BANNED", suspendedUntil: null, tokenVersion: { increment: 1 } },
    });
    expect(result.user.status).toBe("BANNED");
  });

  it("이미 영구 정지면 409", async () => {
    mockClient.user.findUnique.mockResolvedValue({ status: "BANNED", suspendedUntil: null });
    await expect(issueSanction({ ...base, type: "BAN", reasonCode: "FRAUD" })).rejects.toMatchObject({ status: 409 });
  });

  it("해제는 ACTIVE·만료 시각 삭제·LIFT 1건·해제 알림(AC-11)", async () => {
    const until = new Date(NOW.getTime() + DAY_MS);
    mockClient.user.findUnique.mockResolvedValue({ status: "SUSPENDED", suspendedUntil: until });
    const result = await issueSanction({ ...base, type: "LIFT", reasonCode: "OTHER" });
    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: TARGET, status: "SUSPENDED", suspendedUntil: until },
      data: { status: "ACTIVE", suspendedUntil: null },
    });
    expect(mockClient.userSanction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "LIFT" }) });
    expect(result.user).toEqual({ status: "ACTIVE", suspendedUntil: null });
    expect(mockCreateNotification.mock.calls[0][0].message).toBe("이용 정지가 해제되었어요.");
  });

  it("해제·영구 정지도 그 사이 상태가 바뀌었으면 409 이고 제재를 남기지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ status: "SUSPENDED", suspendedUntil: new Date(NOW.getTime() + DAY_MS) });
    mockClient.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(issueSanction({ ...base, type: "LIFT", reasonCode: "OTHER" })).rejects.toMatchObject({
      status: 409,
      code: "STATUS_CHANGED",
    });
    await expect(issueSanction({ ...base, type: "BAN", reasonCode: "FRAUD" })).rejects.toMatchObject({ status: 409 });
    expect(mockClient.userSanction.create).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("정지 중이 아니면 해제는 409(E-8)", async () => {
    await expect(issueSanction({ ...base, type: "LIFT", reasonCode: "OTHER" })).rejects.toMatchObject({
      status: 409,
      code: "NOT_RESTRICTED",
    });
  });
});

describe("issueSanction — 공통 거절", () => {
  it("자기 자신은 400(E-3)", async () => {
    await expect(issueSanction({ ...base, userId: ADMIN, type: "WARNING", reasonCode: "SPAM" })).rejects.toMatchObject({
      status: 400,
      code: "SELF_SANCTION",
    });
  });

  it("탈퇴 계정은 409(E-2), 없는 사용자는 404", async () => {
    mockClient.user.findUnique.mockResolvedValueOnce({ status: "DELETED", suspendedUntil: null });
    await expect(issueSanction({ ...base, type: "WARNING", reasonCode: "SPAM" })).rejects.toMatchObject({
      status: 409,
      code: "USER_DELETED",
    });
    mockClient.user.findUnique.mockResolvedValueOnce(null);
    await expect(issueSanction({ ...base, type: "WARNING", reasonCode: "SPAM" })).rejects.toBeInstanceOf(SanctionError);
  });

  it("사유가 기타인데 메시지가 짧으면 400(AC-14)", async () => {
    await expect(
      issueSanction({ ...base, type: "WARNING", reasonCode: "OTHER", messageToUser: "짧음" })
    ).rejects.toMatchObject({ status: 400 });
    expect(mockClient.userSanction.create).not.toHaveBeenCalled();
  });
});

describe("getSanctionSummary", () => {
  it("최근 180일 경고·정지 수와 권장 조치를 돌려준다(AC-20)", async () => {
    mockClient.userSanction.groupBy.mockResolvedValue([{ type: "WARNING", _count: { _all: 1 } }]);
    await expect(getSanctionSummary(TARGET, NOW)).resolves.toEqual({
      recentWarningCount: 1,
      recentSuspensionCount: 0,
      recommendation: { type: "SUSPENSION", days: 3 },
    });
    expect(mockClient.userSanction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: TARGET,
          type: { in: ["WARNING", "SUSPENSION"] },
          createdAt: { gte: new Date(NOW.getTime() - 180 * DAY_MS) },
        },
      })
    );
  });
});

describe("toUserSanctionView", () => {
  it("내부 메모·운영자·신고 정보는 넣지 않는다(AC-15)", () => {
    const view = toUserSanctionView({
      id: 3,
      userId: TARGET,
      actorId: ADMIN,
      type: "WARNING",
      reasonCode: "ABUSE",
      messageToUser: "메시지",
      internalNote: "신고자 홍길동",
      days: null,
      startsAt: NOW,
      endsAt: null,
      reportId: 55,
      auctionReportId: null,
      targetType: "POST",
      targetId: 9,
      snapshot: { title: "제목", excerpt: "본문" },
      acknowledgedAt: null,
      createdAt: NOW,
    });
    expect(Object.keys(view).sort()).toEqual(
      ["acknowledgedAt", "createdAt", "days", "endsAt", "id", "messageToUser", "reasonCode", "reasonLabel", "startsAt", "target", "type"].sort()
    );
    expect(JSON.stringify(view)).not.toMatch(/internalNote|actorId|reportId|홍길동/);
    expect(view.reasonLabel).toBe("욕설·비하·혐오 표현");
    expect(view.target).toEqual({ type: "POST", id: 9, title: "제목", excerpt: "본문" });
  });
});

describe("withRestrictionNotice", () => {
  const suspendedBlock: LoginBlock = {
    status: 403,
    errorCode: "ACCOUNT_SUSPENDED",
    error: "이용이 정지된 계정이에요. 2026.10.12 이후 다시 로그인할 수 있어요.",
    message: "이용이 정지된 계정이에요. 2026.10.12 이후 다시 로그인할 수 있어요.",
    suspendedUntil: "2026-10-12T00:30:00.000Z",
  };

  it("가장 최근 정지 사유와 메시지를 붙인다(AC-26)", async () => {
    mockClient.userSanction.findFirst.mockResolvedValue({ reasonCode: "SPAM", messageToUser: "도배 글이 반복됐어요." });
    const block = await withRestrictionNotice(suspendedBlock, TARGET);
    expect(mockClient.userSanction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: TARGET, type: "SUSPENSION" } })
    );
    expect(block).toEqual({
      ...suspendedBlock,
      error: `${suspendedBlock.message} 사유: 스팸·광고`,
      message: `${suspendedBlock.message} 사유: 스팸·광고`,
      reasonLabel: "스팸·광고",
      messageToUser: "도배 글이 반복됐어요.",
    });
  });

  it("이력이 없거나 조회가 실패하면 원래 응답 그대로(E-13)", async () => {
    mockClient.userSanction.findFirst.mockResolvedValueOnce(null);
    await expect(withRestrictionNotice(suspendedBlock, TARGET)).resolves.toBe(suspendedBlock);
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockClient.userSanction.findFirst.mockRejectedValueOnce(new Error("db down"));
    await expect(withRestrictionNotice(suspendedBlock, TARGET)).resolves.toBe(suspendedBlock);
    spy.mockRestore();
  });

  it("탈퇴 차단은 건드리지 않는다", async () => {
    const deleted: LoginBlock = { status: 403, errorCode: "ACCOUNT_DELETED", error: "x", message: "x" };
    await expect(withRestrictionNotice(deleted, TARGET)).resolves.toBe(deleted);
    expect(mockClient.userSanction.findFirst).not.toHaveBeenCalled();
  });
});
