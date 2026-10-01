import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
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

const mockIssueTokens = jest.fn();
jest.mock("@libs/server/jwt", () => ({
  issueTokens: (...args: unknown[]) => mockIssueTokens(...args),
  toAuthUser: (user: Record<string, unknown>) => ({ id: user.id, name: user.name }),
}));

import testAccountsHandler from "../pages/api/users/test-accounts";

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

async function call(req: Partial<NextApiRequest>) {
  const res = createRes();
  await testAccountsHandler(
    { method: "GET", headers: {}, query: {}, body: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const ENV_KEYS = ["NEXT_PUBLIC_VERCEL_ENV", "VERCEL_ENV", "NEXT_PUBLIC_APP_ENV"] as const;
const savedEnv: Record<string, string | undefined> = {};

const fakeUser = {
  id: 30,
  snsId: "seed-30",
  provider: "test_user",
  role: "FAKE_USER",
  phone: null,
  email: null,
  name: "fake1234",
  avatar: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  status: "ACTIVE",
  tokenVersion: 0,
};

const FORBIDDEN = "테스트 계정 기능은 관리자 또는 테스트 계정으로 로그인해야 사용할 수 있어요.";

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  mockHasAdminAccess.mockResolvedValue(false);
  mockClient.user.findMany.mockResolvedValue([]);
  mockClient.user.findUnique.mockImplementation(({ where }: { where: { id?: number } }) =>
    Promise.resolve(where.id === fakeUser.id ? fakeUser : null)
  );
  mockIssueTokens.mockResolvedValue({ accessToken: "a", refreshToken: "r", expiresIn: 1800 });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("/api/users/test-accounts 운영 환경 접근 제한", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
  });

  it.each([
    ["GET 목록", { method: "GET" }],
    ["POST switch", { method: "POST", body: { action: "switch", userId: 30 } }],
    ["POST create", { method: "POST", body: { action: "create", count: 20 } }],
  ])("비로그인 %s 는 403, 토큰 발급·생성 없음", async (_label, req) => {
    const res = await call(req as Partial<NextApiRequest>);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: FORBIDDEN });
    expect(mockIssueTokens).not.toHaveBeenCalled();
    expect(mockClient.user.create).not.toHaveBeenCalled();
    expect(mockClient.user.findMany).not.toHaveBeenCalled();
  });

  it("일반 유저는 403", async () => {
    mockClient.user.findUnique.mockResolvedValue({ role: "USER", provider: "kakao" });
    const res = await call({
      method: "POST",
      body: { action: "switch", userId: 30 },
      user: { id: 7 } as NextApiRequest["user"],
    });

    expect(res.statusCode).toBe(403);
    expect(mockIssueTokens).not.toHaveBeenCalled();
  });

  it("관리자는 전환할 수 있다", async () => {
    mockHasAdminAccess.mockResolvedValue(true);
    const res = await call({
      method: "POST",
      body: { action: "switch", userId: 30 },
      user: { id: 1 } as NextApiRequest["user"],
    });

    expect(res.statusCode).toBe(200);
    expect(mockHasAdminAccess).toHaveBeenCalledWith(1);
    expect(mockIssueTokens).toHaveBeenCalledWith(expect.objectContaining({ id: 30 }), 0);
  });

  it("테스트 계정으로 로그인한 유저는 다른 테스트 계정으로 전환할 수 있다", async () => {
    const res = await call({
      method: "POST",
      body: { action: "switch", userId: 30 },
      user: { id: 30 } as NextApiRequest["user"],
    });

    expect(res.statusCode).toBe(200);
    expect(mockIssueTokens).toHaveBeenCalled();
  });
});

describe("/api/users/test-accounts 개발·프리뷰 환경", () => {
  it("비로그인도 목록 조회·전환이 된다(로그인 화면 테스트 로그인)", async () => {
    process.env.VERCEL_ENV = "preview";

    const list = await call({ method: "GET" });
    expect(list.statusCode).toBe(200);
    expect(list.body.success).toBe(true);

    const switched = await call({ method: "POST", body: { action: "switch", userId: 30 } });
    expect(switched.statusCode).toBe(200);
    expect(mockIssueTokens).toHaveBeenCalledWith(expect.objectContaining({ id: 30 }), 0);
    expect(mockHasAdminAccess).not.toHaveBeenCalled();
  });
});
