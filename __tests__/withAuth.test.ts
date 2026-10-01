import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

const mockVerifyAccessToken = jest.fn();
jest.mock("@libs/server/jwt", () => ({
  extractBearerToken: (header?: string | null) =>
    header?.startsWith("Bearer ") ? header.slice(7) : null,
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
}));

import { resolveAuthUser, withAuth } from "@libs/server/auth";
import withHandler from "@libs/server/withHandler";

const tokenUser = {
  id: 7,
  snsId: "kakao-7",
  provider: "kakao",
  phone: null,
  email: null,
  name: "브리더",
  avatar: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const payload = (tv?: number) => ({
  type: "access" as const,
  user: tokenUser,
  ...(tv === undefined ? {} : { tv }),
});

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res;
}

/** withAuth 로 감싼 핸들러가 받은 req.user 를 돌려준다. */
async function runWithAuth(authorization?: string) {
  let seen: NextApiRequest["user"] | "not-called" = "not-called";
  const handler = withAuth(async (req) => {
    seen = req.user;
  });
  const req = {
    method: "GET",
    headers: authorization ? { authorization } : {},
    query: {},
  } as unknown as NextApiRequest;
  await handler(req, createRes() as unknown as NextApiResponse);
  return seen;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("withAuth DB 게이트", () => {
  it("토큰이 없으면 DB 를 조회하지 않고 익명으로 통과한다", async () => {
    const user = await runWithAuth();
    expect(user).toBeUndefined();
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
  });

  it("서명 검증에 실패하면 DB 를 조회하지 않는다", async () => {
    mockVerifyAccessToken.mockResolvedValue(null);
    const user = await runWithAuth("Bearer broken");
    expect(user).toBeUndefined();
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
  });

  it("ACTIVE 이고 tv 가 일치하면 req.user 를 채운다", async () => {
    mockVerifyAccessToken.mockResolvedValue(payload(2));
    mockClient.user.findUnique.mockResolvedValue({ status: "ACTIVE", tokenVersion: 2 });

    const user = await runWithAuth("Bearer good");

    expect(user).toEqual(tokenUser);
    expect(mockVerifyAccessToken).toHaveBeenCalledWith("good");
    expect(mockClient.user.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { status: true, tokenVersion: true },
    });
  });

  it.each(["BANNED", "SUSPENDED_7D", "SUSPENDED_30D", "DELETED"])(
    "%s 계정이면 req.user 를 비운다",
    async (status) => {
      mockVerifyAccessToken.mockResolvedValue(payload(0));
      mockClient.user.findUnique.mockResolvedValue({ status, tokenVersion: 0 });
      expect(await runWithAuth("Bearer t")).toBeUndefined();
    }
  );

  it("tv 가 DB tokenVersion 과 다르면 req.user 를 비운다", async () => {
    mockVerifyAccessToken.mockResolvedValue(payload(1));
    mockClient.user.findUnique.mockResolvedValue({ status: "ACTIVE", tokenVersion: 2 });
    expect(await runWithAuth("Bearer t")).toBeUndefined();
  });

  it("tv 가 없는 기존 토큰은 tv=0 으로 본다(DB 0 → 통과)", async () => {
    mockVerifyAccessToken.mockResolvedValue(payload());
    mockClient.user.findUnique.mockResolvedValue({ status: "ACTIVE", tokenVersion: 0 });
    expect(await runWithAuth("Bearer legacy")).toEqual(tokenUser);
  });

  it("tv 가 없는 기존 토큰이라도 DB tokenVersion 이 올라갔으면 막는다", async () => {
    mockVerifyAccessToken.mockResolvedValue(payload());
    mockClient.user.findUnique.mockResolvedValue({ status: "ACTIVE", tokenVersion: 1 });
    expect(await runWithAuth("Bearer legacy")).toBeUndefined();
  });

  it("유저가 없으면 req.user 를 비운다", async () => {
    mockVerifyAccessToken.mockResolvedValue(payload(0));
    mockClient.user.findUnique.mockResolvedValue(null);
    expect(await runWithAuth("Bearer t")).toBeUndefined();
  });

  it("DB 조회가 실패하면 fail-closed 로 req.user 를 비우고 로그를 남긴다", async () => {
    mockVerifyAccessToken.mockResolvedValue(payload(0));
    mockClient.user.findUnique.mockRejectedValue(new Error("db down"));
    expect(await runWithAuth("Bearer t")).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("resolveAuthUser", () => {
  it("게이트를 통과하면 토큰의 유저를, 아니면 null 을 돌려준다", async () => {
    mockClient.user.findUnique.mockResolvedValueOnce({ status: "ACTIVE", tokenVersion: 3 });
    await expect(resolveAuthUser(payload(3))).resolves.toEqual(tokenUser);

    mockClient.user.findUnique.mockResolvedValueOnce({ status: "BANNED", tokenVersion: 3 });
    await expect(resolveAuthUser(payload(3))).resolves.toBeNull();
  });
});

describe("withAuth + withHandler", () => {
  const blockedUser = () => {
    mockVerifyAccessToken.mockResolvedValue(payload(0));
    mockClient.user.findUnique.mockResolvedValue({ status: "BANNED", tokenVersion: 1 });
  };

  it("private 라우트는 막힌 토큰이면 401", async () => {
    blockedUser();
    const inner = jest.fn();
    const route = withAuth(withHandler({ methods: ["GET"], handler: inner, isPrivate: true }));
    const res = createRes();
    await route(
      { method: "GET", headers: { authorization: "Bearer t" }, query: {} } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );
    expect(res.statusCode).toBe(401);
    expect(inner).not.toHaveBeenCalled();
  });

  it("public 라우트는 막힌 토큰이면 익명으로 처리한다", async () => {
    blockedUser();
    let seen: unknown = "not-called";
    const route = withAuth(
      withHandler({
        methods: ["GET"],
        isPrivate: false,
        handler: async (req, res) => {
          seen = req.user;
          res.status(200).json({ success: true });
        },
      })
    );
    const res = createRes();
    await route(
      { method: "GET", headers: { authorization: "Bearer t" }, query: {} } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );
    expect(res.statusCode).toBe(200);
    expect(seen).toBeUndefined();
  });
});
