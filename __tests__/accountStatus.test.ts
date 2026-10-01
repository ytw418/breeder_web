import {
  SUSPENSION_DAYS,
  formatKstDate,
  getLoginBlock,
  liftExpiredSuspension,
  setUserStatus,
  suspensionEndsAt,
} from "@libs/server/accountStatus";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-01T03:00:00.000Z"); // KST 2026-10-01 12:00

const mockDb = {
  user: { updateMany: jest.fn() },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.user.updateMany.mockResolvedValue({ count: 1 });
});

describe("suspensionEndsAt", () => {
  it("7일·30일 정지는 now 기준 만료 시각을, 나머지는 null 을 돌려준다", () => {
    expect(SUSPENSION_DAYS).toEqual({ SUSPENDED_7D: 7, SUSPENDED_30D: 30 });
    expect(suspensionEndsAt("SUSPENDED_7D", NOW)).toEqual(new Date(NOW.getTime() + 7 * DAY_MS));
    expect(suspensionEndsAt("SUSPENDED_30D", NOW)).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
    expect(suspensionEndsAt("BANNED", NOW)).toBeNull();
    expect(suspensionEndsAt("ACTIVE", NOW)).toBeNull();
    expect(suspensionEndsAt("DELETED", NOW)).toBeNull();
  });
});

describe("setUserStatus", () => {
  // 탈퇴(DELETED) 계정은 개인정보를 분리한 행이라 신고 BAN·관리자 변경으로 되살리지 않는다.
  const notDeleted = { id: 9, status: { not: "DELETED" } };

  it("ACTIVE 로 되돌리면 정지 만료 시각만 지우고 토큰은 그대로 둔다", async () => {
    await expect(setUserStatus(mockDb as any, 9, "ACTIVE", NOW)).resolves.toBe(true);
    expect(mockDb.user.updateMany).toHaveBeenCalledWith({
      where: notDeleted,
      data: { status: "ACTIVE", suspendedUntil: null },
    });
  });

  it("BANNED 는 만료 없이 tokenVersion 을 올려 모든 토큰을 무효화한다", async () => {
    await setUserStatus(mockDb as any, 9, "BANNED", NOW);
    expect(mockDb.user.updateMany).toHaveBeenCalledWith({
      where: notDeleted,
      data: { status: "BANNED", suspendedUntil: null, tokenVersion: { increment: 1 } },
    });
  });

  it.each([
    ["SUSPENDED_7D", 7],
    ["SUSPENDED_30D", 30],
  ] as const)("%s 는 만료 시각을 기록하고 tokenVersion 을 올린다", async (status, days) => {
    await setUserStatus(mockDb as any, 9, status, NOW);
    expect(mockDb.user.updateMany).toHaveBeenCalledWith({
      where: notDeleted,
      data: {
        status,
        suspendedUntil: new Date(NOW.getTime() + days * DAY_MS),
        tokenVersion: { increment: 1 },
      },
    });
  });

  it("대상이 없거나 탈퇴 계정이면 바꾸지 않고 false 를 돌려준다", async () => {
    mockDb.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(setUserStatus(mockDb as any, 9, "BANNED", NOW)).resolves.toBe(false);
  });
});

describe("liftExpiredSuspension", () => {
  it("읽은 정지 상태가 그대로이고 만료 시각이 지났을 때만 ACTIVE 로 되돌린다", async () => {
    await expect(
      liftExpiredSuspension(mockDb as any, { id: 9, status: "SUSPENDED_7D" }, NOW)
    ).resolves.toBe(true);
    expect(mockDb.user.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: "SUSPENDED_7D", suspendedUntil: { lte: NOW } },
      data: { status: "ACTIVE", suspendedUntil: null },
    });
  });

  it("그 사이 차단·탈퇴·재정지됐으면(갱신 0건) false", async () => {
    mockDb.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      liftExpiredSuspension(mockDb as any, { id: 9, status: "SUSPENDED_30D" }, NOW)
    ).resolves.toBe(false);
  });
});

describe("formatKstDate", () => {
  it("KST 날짜를 YYYY.MM.DD 로 만든다", () => {
    expect(formatKstDate(new Date("2026-10-07T14:59:59.000Z"))).toBe("2026.10.07");
    expect(formatKstDate(new Date("2026-10-07T15:00:00.000Z"))).toBe("2026.10.08");
  });
});

describe("getLoginBlock", () => {
  it("ACTIVE 는 막지 않는다", () => {
    expect(getLoginBlock({ status: "ACTIVE", suspendedUntil: null }, NOW)).toBeNull();
  });

  it("BANNED 는 영구 정지 안내", () => {
    expect(getLoginBlock({ status: "BANNED", suspendedUntil: null }, NOW)).toEqual({
      status: 403,
      errorCode: "ACCOUNT_BANNED",
      error: "이용이 영구 정지된 계정이에요.",
      message: "이용이 영구 정지된 계정이에요.",
    });
  });

  it("정지 기간이 남았으면 KST 해제일과 함께 막는다", () => {
    const until = new Date("2026-10-08T03:00:00.000Z");
    expect(getLoginBlock({ status: "SUSPENDED_7D", suspendedUntil: until }, NOW)).toEqual({
      status: 403,
      errorCode: "ACCOUNT_SUSPENDED",
      error: "이용이 정지된 계정이에요. 2026.10.08 이후 다시 로그인할 수 있어요.",
      message: "이용이 정지된 계정이에요. 2026.10.08 이후 다시 로그인할 수 있어요.",
      suspendedUntil: "2026-10-08T03:00:00.000Z",
    });
  });

  it("정지 기간이 지났으면 해제(lift)한다", () => {
    const past = new Date(NOW.getTime() - 1000);
    expect(getLoginBlock({ status: "SUSPENDED_30D", suspendedUntil: past }, NOW)).toEqual({
      lift: true,
    });
    expect(getLoginBlock({ status: "SUSPENDED_7D", suspendedUntil: NOW }, NOW)).toEqual({
      lift: true,
    });
  });

  it("만료 시각이 없는 정지는 날짜 없이 막는다", () => {
    const block = getLoginBlock({ status: "SUSPENDED_7D", suspendedUntil: null }, NOW);
    expect(block).toEqual({
      status: 403,
      errorCode: "ACCOUNT_SUSPENDED",
      error: "이용이 정지된 계정이에요.",
      message: "이용이 정지된 계정이에요.",
    });
  });

  it("DELETED 는 탈퇴 안내", () => {
    expect(getLoginBlock({ status: "DELETED", suspendedUntil: null }, NOW)).toEqual({
      status: 403,
      errorCode: "ACCOUNT_DELETED",
      error: "탈퇴 처리된 계정이에요.",
      message: "탈퇴 처리된 계정이에요.",
    });
  });
});
