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

const mockHasAdminAccess = jest.fn();
jest.mock("@libs/server/adminAccess", () => ({
  hasAdminAccess: (...args: unknown[]) => mockHasAdminAccess(...args),
}));

const mockFindDeletionBlockers = jest.fn();
const mockDeleteAccount = jest.fn();
const mockFindPendingDeletion = jest.fn();
jest.mock("@libs/server/accountDeletion", () => ({
  ACCOUNT_DELETION_RETENTION_DAYS: 30,
  findDeletionBlockers: (...args: unknown[]) => mockFindDeletionBlockers(...args),
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
  findPendingDeletion: (...args: unknown[]) => mockFindPendingDeletion(...args),
}));

const mockCreateUser = jest.fn();
jest.mock("@libs/server/breeder-programs", () => ({
  createUserWithAutomaticBreederPrograms: (...args: unknown[]) => mockCreateUser(...args),
}));
jest.mock("@libs/server/UniqueName", () => ({
  UniqueName: () => Promise.resolve("새닉네임"),
}));
jest.mock("@libs/server/jwt", () => ({
  issueTokens: () =>
    Promise.resolve({ accessToken: "a", refreshToken: "r", expiresIn: 1800 }),
  toAuthUser: (user: Record<string, unknown>) => ({ id: user.id, name: user.name }),
}));

import deletionHandler from "../pages/api/users/me/deletion";
import loginHandler from "../pages/api/auth/login";
import meHandler from "../pages/api/users/me/index";

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

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: Partial<NextApiRequest>
) {
  const res = createRes();
  await handler(
    { headers: {}, query: {}, body: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const me = { id: 7, name: "브리더" } as NextApiRequest["user"];
const blocker = {
  code: "AUCTION_SELLING_ACTIVE",
  message: "진행 중인 판매 경매가 있어요.",
  items: [{ id: 1, title: "왕사슴" }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHasAdminAccess.mockResolvedValue(false);
});

describe("/api/users/me/deletion", () => {
  it("로그인하지 않으면 401", async () => {
    const res = await call(deletionHandler, { method: "GET" });
    expect(res.statusCode).toBe(401);
  });

  it("GET: 차단 사유가 있으면 eligible=false 와 사유를 돌려준다", async () => {
    mockFindDeletionBlockers.mockResolvedValue([blocker]);
    const res = await call(deletionHandler, { method: "GET", user: me });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      eligible: false,
      purgeAfterDays: 30,
      blockers: [blocker],
    });
    expect(mockFindDeletionBlockers).toHaveBeenCalledWith(7);
  });

  it("GET: 관리자 계정은 탈퇴할 수 없다고 안내한다", async () => {
    mockHasAdminAccess.mockResolvedValue(true);
    mockFindDeletionBlockers.mockResolvedValue([]);
    const res = await call(deletionHandler, { method: "GET", user: me });
    expect(res.body.eligible).toBe(false);
    expect(res.body.errorCode).toBe("ADMIN_ACCOUNT_CANNOT_SELF_DELETE");
  });

  it("POST: 관리자 계정은 403", async () => {
    mockHasAdminAccess.mockResolvedValue(true);
    const res = await call(deletionHandler, { method: "POST", user: me });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("ADMIN_ACCOUNT_CANNOT_SELF_DELETE");
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("POST: 차단되면 409 ACCOUNT_DELETION_BLOCKED + 사유", async () => {
    mockDeleteAccount.mockResolvedValue({
      ok: false,
      code: "ACCOUNT_DELETION_BLOCKED",
      blockers: [blocker],
    });
    const res = await call(deletionHandler, { method: "POST", user: me });
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        errorCode: "ACCOUNT_DELETION_BLOCKED",
        blockers: [blocker],
      })
    );
  });

  it("POST: 이미 탈퇴한 계정이면 409 ACCOUNT_ALREADY_DELETED", async () => {
    mockDeleteAccount.mockResolvedValue({ ok: false, code: "ACCOUNT_ALREADY_DELETED" });
    const res = await call(deletionHandler, { method: "POST", user: me });
    expect(res.statusCode).toBe(409);
    expect(res.body.errorCode).toBe("ACCOUNT_ALREADY_DELETED");
  });

  it("POST: 성공하면 탈퇴·파기 예정 시각을 돌려준다", async () => {
    const deletedAt = new Date("2026-10-01T00:00:00.000Z");
    const purgeAt = new Date("2026-10-31T00:00:00.000Z");
    mockDeleteAccount.mockResolvedValue({ ok: true, deletedAt, purgeAt });
    const res = await call(deletionHandler, {
      method: "POST",
      user: me,
      body: { reason: "안 써요" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      deletedAt: deletedAt.toISOString(),
      purgeAt: purgeAt.toISOString(),
    });
    expect(mockDeleteAccount).toHaveBeenCalledWith(7, { reason: "안 써요" });
  });
});

describe("/api/auth/login 탈퇴 보관 기간", () => {
  const body = { snsId: "kakao-123", name: "x", provider: "kakao" };

  it("보관 기간 중인 소셜 계정은 403 ACCOUNT_PENDING_DELETION, 계정을 만들지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    mockFindPendingDeletion.mockResolvedValue({
      purgeAt: new Date("2026-10-31T00:00:00.000Z"),
    });
    const res = await call(loginHandler, { method: "POST", body });
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        errorCode: "ACCOUNT_PENDING_DELETION",
        purgeAt: "2026-10-31T00:00:00.000Z",
      })
    );
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("보관 기간이 끝났으면 새 계정으로 가입한다", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    mockFindPendingDeletion.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({
      id: 8,
      status: "ACTIVE",
      snsId: "kakao-123",
      provider: "kakao",
      phone: null,
      email: null,
      name: "새닉네임",
      avatar: null,
      tokenVersion: 0,
      suspendedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await call(loginHandler, { method: "POST", body });
    expect(res.statusCode).toBe(200);
    expect(mockCreateUser).toHaveBeenCalled();
  });
});

describe("/api/users/me 닉네임", () => {
  it.each(["탈퇴한 사용자#1", "탈퇴한 사용자", " 탈퇴한 사용자123"])(
    "탈퇴 표시용 이름(%s)으로는 바꿀 수 없다",
    async (name) => {
      const res = await call(meHandler, { method: "POST", user: me, body: { name } });
      expect(res.body).toEqual({ success: false, error: "사용할 수 없는 닉네임입니다." });
      expect(mockClient.user.update).not.toHaveBeenCalled();
    }
  );
});
