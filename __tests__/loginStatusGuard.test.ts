import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

const mockFindPendingDeletion = jest.fn();
jest.mock("@libs/server/accountDeletion", () => ({
  findPendingDeletion: (...args: unknown[]) => mockFindPendingDeletion(...args),
}));
const mockCreateUser = jest.fn();
jest.mock("@libs/server/breeder-programs", () => ({
  createUserWithAutomaticBreederPrograms: (...args: unknown[]) => mockCreateUser(...args),
}));
jest.mock("@libs/server/UniqueName", () => ({
  UniqueName: () => Promise.resolve("새닉네임"),
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

jest.mock("@libs/server/socialAuth", () => ({
  SocialAuthError: class SocialAuthError extends Error {},
  verifySocialLogin: () =>
    Promise.resolve({ snsId: "kakao-123", email: "new@bredy.app", avatar: null }),
}));

import loginHandler from "../pages/api/auth/login";

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

async function login(body: Record<string, unknown>) {
  const res = createRes();
  await loginHandler(
    { method: "POST", headers: {}, query: {}, body } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");
const body = {
  token: "kakao-access",
  snsId: "kakao-123",
  name: "카카오이름",
  provider: "kakao",
  email: "new@bredy.app",
};

const existing = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  role: "USER",
  status: "ACTIVE",
  snsId: "kakao-123",
  provider: "kakao",
  phone: null,
  email: "old@bredy.app",
  name: "브리더",
  avatar: null,
  deletedAt: null,
  tokenVersion: 0,
  suspendedUntil: null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

const authUserOf = (user: ReturnType<typeof existing>) => ({
  id: user.id,
  snsId: user.snsId,
  provider: user.provider,
  phone: user.phone,
  email: user.email,
  name: user.name,
  avatar: user.avatar,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.user.findUnique.mockReset();
  mockIssueTokens.mockResolvedValue({ accessToken: "a", refreshToken: "r", expiresIn: 1800 });
  mockClient.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    existing(data)
  );
  mockClient.user.updateMany.mockResolvedValue({ count: 1 });
});

describe("/api/auth/login 계정 상태 가드", () => {
  it("BANNED 는 403 ACCOUNT_BANNED, error·message 를 모두 담고 토큰·프로필 동기화를 하지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue(existing({ status: "BANNED" }));
    const res = await login(body);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      errorCode: "ACCOUNT_BANNED",
      error: "이용이 영구 정지된 계정이에요.",
      message: "이용이 영구 정지된 계정이에요.",
    });
    expect(mockIssueTokens).not.toHaveBeenCalled();
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("정지 기간이 남은 계정은 403 ACCOUNT_SUSPENDED + suspendedUntil", async () => {
    const until = new Date(Date.now() + 3 * DAY_MS);
    mockClient.user.findUnique.mockResolvedValue(
      existing({ status: "SUSPENDED_7D", suspendedUntil: until })
    );
    const res = await login(body);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        errorCode: "ACCOUNT_SUSPENDED",
        suspendedUntil: until.toISOString(),
      })
    );
    expect(res.body.error).toMatch(/^이용이 정지된 계정이에요\. \d{4}\.\d{2}\.\d{2} 이후 다시 로그인할 수 있어요\.$/);
    expect(res.body.message).toBe(res.body.error);
    expect(mockIssueTokens).not.toHaveBeenCalled();
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("raw DELETED 계정은 403 ACCOUNT_DELETED", async () => {
    mockClient.user.findUnique.mockResolvedValue(existing({ status: "DELETED" }));
    const res = await login(body);
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("ACCOUNT_DELETED");
    expect(res.body.error).toBe("탈퇴 처리된 계정이에요.");
    expect(mockIssueTokens).not.toHaveBeenCalled();
  });

  it("정지 기간이 지난 계정은 ACTIVE 로 되돌리고 로그인한다", async () => {
    const past = new Date(Date.now() - DAY_MS);
    mockClient.user.findUnique.mockResolvedValue(
      existing({ status: "SUSPENDED_30D", suspendedUntil: past, tokenVersion: 1, email: "new@bredy.app" })
    );
    const res = await login(body);

    // 읽은 뒤 관리자가 차단·탈퇴시켰으면 덮어쓰지 않도록 조건부로 해제한다.
    expect(mockClient.user.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: "SUSPENDED_30D", suspendedUntil: { lte: expect.any(Date) } },
      data: { status: "ACTIVE", suspendedUntil: null },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockIssueTokens).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }), 1);
  });

  it("정지 해제 직전에 차단됐으면(조건부 해제 0건) 다시 읽어 403 으로 막는다", async () => {
    const past = new Date(Date.now() - DAY_MS);
    mockClient.user.findUnique
      .mockResolvedValueOnce(existing({ status: "SUSPENDED_7D", suspendedUntil: past, tokenVersion: 1 }))
      .mockResolvedValueOnce(existing({ status: "BANNED", suspendedUntil: null, tokenVersion: 2 }));
    mockClient.user.updateMany.mockResolvedValue({ count: 0 });

    const res = await login(body);

    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("ACCOUNT_BANNED");
    expect(mockIssueTokens).not.toHaveBeenCalled();
    expect(mockClient.user.update).not.toHaveBeenCalled();
    expect(mockClient.user.findUnique).toHaveBeenLastCalledWith({ where: { id: 9 } });
  });

  it("다른 요청이 먼저 해제했으면(다시 읽으니 ACTIVE) 그 tokenVersion 으로 로그인한다", async () => {
    const past = new Date(Date.now() - DAY_MS);
    mockClient.user.findUnique
      .mockResolvedValueOnce(existing({ status: "SUSPENDED_7D", suspendedUntil: past, tokenVersion: 1 }))
      .mockResolvedValueOnce(existing({ status: "ACTIVE", tokenVersion: 1, email: "new@bredy.app" }));
    mockClient.user.updateMany.mockResolvedValue({ count: 0 });

    const res = await login(body);

    expect(res.statusCode).toBe(200);
    expect(mockIssueTokens).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }), 1);
  });

  it("다시 읽으니 계정이 사라졌으면 토큰을 발급하지 않는다", async () => {
    const past = new Date(Date.now() - DAY_MS);
    mockClient.user.findUnique
      .mockResolvedValueOnce(existing({ status: "SUSPENDED_7D", suspendedUntil: past }))
      .mockResolvedValueOnce(null);
    mockClient.user.updateMany.mockResolvedValue({ count: 0 });

    const res = await login(body);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(mockIssueTokens).not.toHaveBeenCalled();
  });

  it("ACTIVE 는 현재 tokenVersion 으로 토큰을 발급한다", async () => {
    const user = existing({ tokenVersion: 2, email: "new@bredy.app" });
    mockClient.user.findUnique.mockResolvedValue(user);
    const res = await login(body);

    expect(res.statusCode).toBe(200);
    expect(mockIssueTokens).toHaveBeenCalledWith(authUserOf(user), 2);
    expect(res.body.user).toEqual(authUserOf(user));
    expect(res.body.user).not.toHaveProperty("tokenVersion");
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("ACTIVE 계정의 소셜 프로필 변경은 계속 동기화한다", async () => {
    mockClient.user.findUnique.mockResolvedValue(existing({ tokenVersion: 4 }));
    mockClient.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      existing({ tokenVersion: 4, ...data })
    );
    const res = await login(body);

    expect(res.statusCode).toBe(200);
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { email: "new@bredy.app" },
    });
    expect(mockIssueTokens).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }), 4);
  });

  it("새 계정은 tokenVersion 0 으로 발급한다", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    mockFindPendingDeletion.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue(existing({ id: 10, name: "새닉네임" }));
    const res = await login(body);

    expect(res.statusCode).toBe(200);
    expect(mockIssueTokens).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }), 0);
  });

  it("탈퇴 보관 기간 응답(ACCOUNT_PENDING_DELETION)에도 error 를 담는다", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    mockFindPendingDeletion.mockResolvedValue({
      purgeAt: new Date("2026-10-31T00:00:00.000Z"),
    });
    const res = await login(body);

    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("ACCOUNT_PENDING_DELETION");
    expect(res.body.error).toBe("탈퇴 처리 중인 계정입니다. 2026.10.31 이후 다시 가입할 수 있어요.");
    expect(res.body.message).toBe(res.body.error);
  });
});
