import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn(), update: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/accountDeletion", () => ({
  findPendingDeletion: () => Promise.resolve(null),
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
}));

class MockSocialAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
    Object.setPrototypeOf(this, MockSocialAuthError.prototype);
  }
}
const mockVerifySocialLogin = jest.fn();
jest.mock("@libs/server/socialAuth", () => ({
  SocialAuthError: MockSocialAuthError,
  verifySocialLogin: (...args: unknown[]) => mockVerifySocialLogin(...args),
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

const existingUser = {
  id: 1,
  snsId: "victim-uid",
  provider: "google",
  phone: null,
  email: "victim@gmail.com",
  name: "피해자",
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIssueTokens.mockResolvedValue({ accessToken: "a", refreshToken: "r", expiresIn: 1800 });
});

describe("/api/auth/login 소셜 토큰 검증", () => {
  it("토큰 없이 snsId 만 보내면 401 이고 토큰을 발급하지 않는다", async () => {
    const res = await login({ snsId: "victim-uid", name: "x", provider: "google" });
    expect(res.statusCode).toBe(401);
    expect(res.body.errorCode).toBe("SOCIAL_TOKEN_REQUIRED");
    expect(mockVerifySocialLogin).not.toHaveBeenCalled();
    expect(mockIssueTokens).not.toHaveBeenCalled();
  });

  it("검증에 실패하면 401 이고 토큰을 발급하지 않는다", async () => {
    mockVerifySocialLogin.mockRejectedValue(new MockSocialAuthError("bad"));
    const res = await login({ token: "forged", name: "x", provider: "google" });
    expect(res.statusCode).toBe(401);
    expect(mockIssueTokens).not.toHaveBeenCalled();
  });

  it("body 의 snsId 가 검증된 계정과 다르면 401", async () => {
    mockVerifySocialLogin.mockResolvedValue({ snsId: "attacker-uid", email: null, avatar: null });
    const res = await login({
      token: "attacker-token",
      snsId: "victim-uid",
      name: "x",
      provider: "google",
    });
    expect(res.statusCode).toBe(401);
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
    expect(mockIssueTokens).not.toHaveBeenCalled();
  });

  it("검증된 snsId 로 계정을 찾고, body 의 email 로 덮어쓰지 않는다", async () => {
    mockVerifySocialLogin.mockResolvedValue({ snsId: "victim-uid", email: null, avatar: null });
    mockClient.user.findUnique.mockResolvedValue(existingUser);

    const res = await login({
      token: "valid",
      name: "x",
      provider: "google",
      email: "ytw418@gmail.com",
    });

    expect(res.statusCode).toBe(200);
    expect(mockVerifySocialLogin).toHaveBeenCalledWith("google", "valid");
    expect(mockClient.user.findUnique).toHaveBeenCalledWith({ where: { snsId: "victim-uid" } });
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("새 계정은 검증된 snsId·email 로 만든다", async () => {
    mockVerifySocialLogin.mockResolvedValue({
      snsId: "kakao-77",
      email: "verified@kakao.com",
      avatar: "https://k/p.jpg",
    });
    mockClient.user.findUnique.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ ...existingUser, id: 2, snsId: "kakao-77" });

    const res = await login({
      token: "valid",
      name: "x",
      provider: "kakao",
      email: "forged@example.com",
    });

    expect(res.statusCode).toBe(200);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        snsId: "kakao-77",
        email: "verified@kakao.com",
        avatar: "https://k/p.jpg",
        provider: "kakao",
      })
    );
  });
});
