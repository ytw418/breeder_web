import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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
  canRunSensitiveAdminAction: () => false,
}));

const mockDeleteAccount = jest.fn();
jest.mock("@libs/server/accountDeletion", () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

const mockIssueTokens = jest.fn();
jest.mock("@libs/server/jwt", () => ({
  issueTokens: (...args: unknown[]) => mockIssueTokens(...args),
  toAuthUser: (user: Record<string, unknown>) => ({
    id: user.id,
    snsId: user.snsId,
    provider: user.provider,
    phone: user.phone,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }),
}));

import adminUsersHandler from "../pages/api/admin/users";

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
  };
  return res;
}

const admin = { id: 1, name: "관리자" } as NextApiRequest["user"];

async function post(body: Record<string, unknown>) {
  const res = createRes();
  await adminUsersHandler(
    { method: "POST", headers: {}, query: {}, body, user: admin } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");
const target = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  role: "USER",
  status: "ACTIVE",
  snsId: "kakao-9",
  provider: "kakao",
  phone: null,
  email: "nine@bredy.app",
  name: "구번",
  avatar: null,
  deletedAt: null,
  tokenVersion: 0,
  suspendedUntil: null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHasAdminAccess.mockResolvedValue(true);
  mockClient.user.findUnique.mockResolvedValue(target());
  mockClient.user.updateMany.mockResolvedValue({ count: 1 });
  mockIssueTokens.mockResolvedValue({ accessToken: "a", refreshToken: "r", expiresIn: 1800 });
});

describe("/api/admin/users update_status", () => {
  it("DELETED 는 탈퇴 처리(deleteAccount force)로 보낸다", async () => {
    mockDeleteAccount.mockResolvedValue({ ok: true, deletedAt: new Date(), purgeAt: new Date() });
    const res = await post({ userId: 9, action: "update_status", status: "DELETED" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockDeleteAccount).toHaveBeenCalledWith(9, {
      reason: "관리자 상태 변경",
      force: true,
    });
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
  });

  it("DELETED 처리 중 이미 탈퇴됐으면 성공으로 본다", async () => {
    mockDeleteAccount.mockResolvedValue({ ok: false, code: "ACCOUNT_ALREADY_DELETED" });
    const res = await post({ userId: 9, action: "update_status", status: "DELETED" });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("DELETED 처리 중 유저가 사라졌으면 404", async () => {
    mockDeleteAccount.mockResolvedValue({ ok: false, code: "USER_NOT_FOUND" });
    const res = await post({ userId: 9, action: "update_status", status: "DELETED" });
    expect(res.statusCode).toBe(404);
  });

  it("SUSPENDED_7D 는 만료 시각을 기록하고 tokenVersion 을 올린다", async () => {
    const before = Date.now();
    const res = await post({ userId: 9, action: "update_status", status: "SUSPENDED_7D" });
    const after = Date.now();

    expect(res.statusCode).toBe(200);
    expect(mockClient.user.updateMany).toHaveBeenCalledTimes(1);
    const { where, data } = mockClient.user.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: 9, status: { not: "DELETED" } });
    expect(data.status).toBe("SUSPENDED_7D");
    expect(data.tokenVersion).toEqual({ increment: 1 });
    expect(data.suspendedUntil.getTime()).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
    expect(data.suspendedUntil.getTime()).toBeLessThanOrEqual(after + 7 * DAY_MS);
  });

  it("BANNED 는 tokenVersion 을 올린다", async () => {
    await post({ userId: 9, action: "update_status", status: "BANNED" });
    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: { not: "DELETED" } },
      data: { status: "BANNED", suspendedUntil: null, tokenVersion: { increment: 1 } },
    });
  });

  it("ACTIVE 로 되돌리면 정지 만료 시각을 지운다", async () => {
    mockClient.user.findUnique.mockResolvedValue(target({ status: "SUSPENDED_30D" }));
    await post({ userId: 9, action: "update_status", status: "ACTIVE" });
    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: { not: "DELETED" } },
      data: { status: "ACTIVE", suspendedUntil: null },
    });
  });

  it("탈퇴한 계정의 상태는 바꿀 수 없다(400)", async () => {
    mockClient.user.findUnique.mockResolvedValue(target({ status: "DELETED" }));
    const res = await post({ userId: 9, action: "update_status", status: "ACTIVE" });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: "탈퇴한 계정의 상태는 변경할 수 없습니다.",
    });
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("대상 유저가 없으면 404", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    const res = await post({ userId: 9, action: "update_status", status: "BANNED" });
    expect(res.statusCode).toBe(404);
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
  });

  it("잘못된 상태 값은 400", async () => {
    const res = await post({ userId: 9, action: "update_status", status: "WHATEVER" });
    expect(res.statusCode).toBe(400);
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
  });

  it("자기 자신은 비활성화할 수 없다", async () => {
    const res = await post({ userId: 1, action: "update_status", status: "BANNED" });
    expect(res.statusCode).toBe(400);
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("/api/admin/users 차단 계정 탈퇴 처리", () => {
  // 탈퇴 처리는 snsId 를 해시로 바꾸고 30일 뒤 원문을 파기해, 차단 계정이 같은 소셜 계정으로 재가입할 수 있게 된다.
  const BANNED_DELETE_ERROR =
    "차단된 계정은 탈퇴 처리할 수 없어요. 탈퇴 처리하면 30일 뒤 같은 소셜 계정으로 다시 가입할 수 있어요.";

  it("update_status DELETED 는 차단 계정이면 400", async () => {
    mockClient.user.findUnique.mockResolvedValue(target({ status: "BANNED" }));
    const res = await post({ userId: 9, action: "update_status", status: "DELETED" });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: BANNED_DELETE_ERROR });
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("delete 도 차단 계정이면 400", async () => {
    mockClient.user.findUnique.mockResolvedValue(target({ status: "BANNED" }));
    const res = await post({ userId: 9, action: "delete" });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: BANNED_DELETE_ERROR });
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("delete 는 차단이 아니면 탈퇴 처리(force)로 보낸다", async () => {
    mockDeleteAccount.mockResolvedValue({ ok: true, deletedAt: new Date(), purgeAt: new Date() });
    const res = await post({ userId: 9, action: "delete" });

    expect(res.statusCode).toBe(200);
    expect(mockDeleteAccount).toHaveBeenCalledWith(9, { reason: "관리자 삭제", force: true });
  });

  it("delete 대상이 없으면 404", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    const res = await post({ userId: 9, action: "delete" });

    expect(res.statusCode).toBe(404);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });
});

describe("/api/admin/users switch_user_session", () => {
  it("대상 유저의 현재 tokenVersion 으로 토큰을 발급한다", async () => {
    const user = target({ tokenVersion: 5 });
    mockClient.user.findUnique.mockResolvedValue(user);
    const res = await post({ userId: 9, action: "switch_user_session" });

    expect(res.statusCode).toBe(200);
    expect(mockIssueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, name: "구번" }),
      5
    );
    expect(mockIssueTokens.mock.calls[0][0]).not.toHaveProperty("tokenVersion");
    expect(res.body.accessToken).toBe("a");
  });
});
