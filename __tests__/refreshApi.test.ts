import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

const mockVerifyRefreshToken = jest.fn();
const mockIssueTokens = jest.fn();
jest.mock("@libs/server/jwt", () => ({
  verifyRefreshToken: (...args: unknown[]) => mockVerifyRefreshToken(...args),
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

import refreshHandler from "../pages/api/auth/refresh";

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

async function refresh(body: Record<string, unknown> = { refreshToken: "r" }) {
  const res = createRes();
  await refreshHandler(
    { method: "POST", headers: {}, query: {}, body } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");
const dbUser = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  role: "USER",
  status: "ACTIVE",
  snsId: "kakao-7",
  provider: "kakao",
  phone: null,
  email: null,
  name: "브리더",
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
  mockIssueTokens.mockResolvedValue({ accessToken: "a2", refreshToken: "r2", expiresIn: 1800 });
});

describe("/api/auth/refresh", () => {
  it("refreshToken 이 없으면 400", async () => {
    const res = await refresh({});
    expect(res.statusCode).toBe(400);
  });

  it("서명이 잘못된 토큰은 401", async () => {
    mockVerifyRefreshToken.mockResolvedValue(null);
    const res = await refresh();
    expect(res.statusCode).toBe(401);
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(["BANNED", "SUSPENDED_7D", "DELETED"])("%s 계정은 401", async (status) => {
    mockVerifyRefreshToken.mockResolvedValue({ type: "refresh", sub: "7", tv: 0 });
    mockClient.user.findUnique.mockResolvedValue(dbUser({ status }));
    const res = await refresh();
    expect(res.statusCode).toBe(401);
    expect(mockIssueTokens).not.toHaveBeenCalled();
  });

  it("tv 가 DB tokenVersion 과 다르면 401", async () => {
    mockVerifyRefreshToken.mockResolvedValue({ type: "refresh", sub: "7", tv: 0 });
    mockClient.user.findUnique.mockResolvedValue(dbUser({ tokenVersion: 1 }));
    const res = await refresh();
    expect(res.statusCode).toBe(401);
    expect(mockIssueTokens).not.toHaveBeenCalled();
  });

  it("tv 가 없는 기존 토큰은 DB tokenVersion 이 0 일 때만 통과한다", async () => {
    mockVerifyRefreshToken.mockResolvedValue({ type: "refresh", sub: "7" });
    mockClient.user.findUnique.mockResolvedValue(dbUser({ tokenVersion: 1 }));
    expect((await refresh()).statusCode).toBe(401);

    mockClient.user.findUnique.mockResolvedValue(dbUser({ tokenVersion: 0 }));
    expect((await refresh()).statusCode).toBe(200);
  });

  it("tv 가 일치하면 현재 tokenVersion 으로 다시 발급한다", async () => {
    mockVerifyRefreshToken.mockResolvedValue({ type: "refresh", sub: "7", tv: 3 });
    const user = dbUser({ tokenVersion: 3 });
    mockClient.user.findUnique.mockResolvedValue(user);

    const res = await refresh();

    expect(res.statusCode).toBe(200);
    expect(mockClient.user.findUnique).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(mockIssueTokens).toHaveBeenCalledWith(expect.objectContaining({ id: 7, name: "브리더" }), 3);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, accessToken: "a2", refreshToken: "r2", expiresIn: 1800 })
    );
    expect(res.body.user).not.toHaveProperty("tokenVersion");
    expect(res.body.user).not.toHaveProperty("status");
  });
});
