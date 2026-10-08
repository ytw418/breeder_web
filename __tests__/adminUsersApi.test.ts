import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  userSanction: { groupBy: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

const mockHasAdminAccess = jest.fn();
const mockCanRunSensitive = jest.fn();
jest.mock("@libs/server/adminAccess", () => ({
  hasAdminAccess: (...args: unknown[]) => mockHasAdminAccess(...args),
  canRunSensitiveAdminAction: (...args: unknown[]) => mockCanRunSensitive(...args),
}));

const mockIssueSanction = jest.fn();
jest.mock("@libs/server/sanctions", () => {
  class SanctionError extends Error {
    constructor(
      readonly status: number,
      message: string,
      readonly code: string
    ) {
      super(message);
      Object.setPrototypeOf(this, SanctionError.prototype);
    }
  }
  return {
    SanctionError,
    isSanctionError: (error: unknown) => error instanceof SanctionError,
    issueSanction: (...args: unknown[]) => mockIssueSanction(...args),
  };
});

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

async function get(query: Record<string, string> = {}) {
  const res = createRes();
  await adminUsersHandler(
    { method: "GET", headers: {}, query, body: {}, user: admin } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

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
  mockCanRunSensitive.mockReturnValue(true);
  mockIssueSanction.mockResolvedValue({ sanction: { id: 100 }, user: { status: "SUSPENDED", suspendedUntil: null } });
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

  it("SUSPENDED_7D 는 7일 기간 정지 제재로 보낸다(이력·알림, AC-31)", async () => {
    const res = await post({ userId: 9, action: "update_status", status: "SUSPENDED_7D" });

    expect(res.statusCode).toBe(200);
    expect(mockIssueSanction).toHaveBeenCalledWith({
      actorId: 1,
      userId: 9,
      type: "SUSPENSION",
      days: 7,
      reasonCode: "OTHER",
      messageToUser: "운영정책 위반이 확인되었어요.",
      internalNote: null,
    });
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
  });

  it("SUSPENDED 는 days 와 사유를 그대로 넘긴다", async () => {
    await post({
      userId: 9,
      action: "update_status",
      status: "SUSPENDED",
      days: 10,
      reasonCode: "SPAM",
      messageToUser: "도배 글",
      internalNote: "메모",
    });
    expect(mockIssueSanction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SUSPENSION", days: 10, reasonCode: "SPAM", messageToUser: "도배 글", internalNote: "메모" })
    );
  });

  it("BANNED 는 영구 정지 제재로 보낸다", async () => {
    await post({ userId: 9, action: "update_status", status: "BANNED", reasonCode: "FRAUD" });
    expect(mockIssueSanction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "BAN", reasonCode: "FRAUD", messageToUser: null })
    );
  });

  it("정지 계정을 ACTIVE 로 되돌리면 해제 제재로 보낸다", async () => {
    mockClient.user.findUnique.mockResolvedValue(target({ status: "SUSPENDED_30D" }));
    await post({ userId: 9, action: "update_status", status: "ACTIVE" });
    expect(mockIssueSanction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LIFT", reasonCode: "OTHER", messageToUser: null })
    );
  });

  it("정상 계정을 ACTIVE 로 바꾸면 할 일 없이 성공", async () => {
    const res = await post({ userId: 9, action: "update_status", status: "ACTIVE" });
    expect(res.statusCode).toBe(200);
    expect(mockIssueSanction).not.toHaveBeenCalled();
  });

  it("제재 서비스의 거절은 상태 코드와 문구를 그대로 돌려준다", async () => {
    const { SanctionError } = jest.requireMock("@libs/server/sanctions");
    mockIssueSanction.mockRejectedValue(new SanctionError(409, "이미 영구 정지된 계정이에요.", "ALREADY_BANNED"));
    const res = await post({ userId: 9, action: "update_status", status: "BANNED" });
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ success: false, error: "이미 영구 정지된 계정이에요.", errorCode: "ALREADY_BANNED" });
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
    expect(mockIssueSanction).not.toHaveBeenCalled();
  });

  it("잘못된 상태 값은 400", async () => {
    const res = await post({ userId: 9, action: "update_status", status: "WHATEVER" });
    expect(res.statusCode).toBe(400);
    expect(mockClient.user.updateMany).not.toHaveBeenCalled();
  });

  it("자기 자신은 비활성화할 수 없다", async () => {
    const res = await post({ userId: 1, action: "update_status", status: "BANNED" });
    expect(res.statusCode).toBe(400);
    expect(mockIssueSanction).not.toHaveBeenCalled();
  });
});

describe("/api/admin/users 최고 관리자 전용 동작(AC-35)", () => {
  it.each([
    [{ userId: 9, action: "update_role", role: "ADMIN" }],
    [{ userId: 9, action: "switch_user_session" }],
    [{ userId: 9, action: "delete" }],
    [{ userId: 9, action: "update_status", status: "DELETED" }],
  ])("허용 목록 밖 관리자는 403 이고 DB 를 바꾸지 않는다: %o", async (body) => {
    mockCanRunSensitive.mockReturnValue(false);
    const res = await post(body);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("최고 관리자만 할 수 있어요.");
    expect(mockClient.user.update).not.toHaveBeenCalled();
    expect(mockIssueTokens).not.toHaveBeenCalled();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("최고 관리자는 역할을 바꿀 수 있다", async () => {
    const res = await post({ userId: 9, action: "update_role", role: "ADMIN" });
    expect(res.statusCode).toBe(200);
    expect(mockClient.user.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { role: "ADMIN" } });
  });
});

describe("/api/admin/users GET 검색·페이지(AC-29)", () => {
  beforeEach(() => {
    mockClient.user.count.mockResolvedValue(41);
    mockClient.user.findMany.mockResolvedValue([{ id: 9, name: "구번" }, { id: 10, name: "십번" }]);
    mockClient.userSanction.groupBy.mockResolvedValue([{ userId: 9, _count: { _all: 2 } }]);
  });

  it("닉네임·이메일·ID 로 찾고 20명 단위로 자른다", async () => {
    const res = await get({ q: " 9 ", status: "SUSPENDED", page: "3" });

    const where = {
      AND: [
        {
          OR: [
            { name: { contains: "9", mode: "insensitive" } },
            { email: { contains: "9", mode: "insensitive" } },
            { id: 9 },
          ],
        },
        { status: { in: ["SUSPENDED", "SUSPENDED_7D", "SUSPENDED_30D"] } },
      ],
    };
    expect(mockClient.user.count).toHaveBeenCalledWith({ where });
    expect(mockClient.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 40, take: 20 })
    );
    expect(res.body).toEqual({
      success: true,
      users: [
        { id: 9, name: "구번", recentSanctionCount: 2 },
        { id: 10, name: "십번", recentSanctionCount: 0 },
      ],
      total: 41,
      page: 3,
      pageSize: 20,
    });
  });

  it("검색어가 숫자가 아니면 ID 조건을 넣지 않고, 조건이 없으면 전체를 본다", async () => {
    await get({ q: "구" });
    expect(mockClient.user.count).toHaveBeenLastCalledWith({
      where: { AND: [{ OR: [{ name: { contains: "구", mode: "insensitive" } }, { email: { contains: "구", mode: "insensitive" } }] }] },
    });
    await get();
    expect(mockClient.user.count).toHaveBeenLastCalledWith({ where: {} });
  });

  it("비관리자는 403", async () => {
    mockHasAdminAccess.mockResolvedValue(false);
    const res = await get();
    expect(res.statusCode).toBe(403);
    expect(mockClient.user.findMany).not.toHaveBeenCalled();
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
