import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  // 카테고리 고정 범위 헬퍼(libs/server/categories)가 읽는 트리. 비우면 범위 조건을 붙이지 않는다.
  category: { findMany: jest.fn(async () => []) },
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

const me = { id: 7, name: "브리디" } as NextApiRequest["user"];

async function call(req: Partial<NextApiRequest>) {
  const res = createRes();
  await meHandler(
    { headers: {}, query: {}, body: {}, user: me, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const save = (body: Record<string, unknown>) => call({ method: "POST", body });

const p2002 = () =>
  Object.assign(new Error("Unique constraint failed on the fields: (`name`)"), {
    code: "P2002",
    meta: { target: ["name"] },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockHasAdminAccess.mockResolvedValue(false);
  mockClient.user.update.mockResolvedValue({});
});

describe("POST /api/users/me 닉네임", () => {
  it("본인의 현재 닉네임 그대로면 성공하고 이름은 업데이트하지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 7 });
    const res = await save({ name: "브리디", avatarId: null });
    expect(res.body).toEqual({ success: true });
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("다른 유저가 쓰는 닉네임은 중복 안내", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 8 });
    const res = await save({ name: "남의이름" });
    expect(res.body).toEqual({ success: false, error: "중복된 닉네임입니다." });
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("앞뒤 공백을 지운 이름으로 저장한다", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    const res = await save({ name: "  새이름  " });
    expect(res.body).toEqual({ success: true });
    expect(mockClient.user.findUnique).toHaveBeenCalledWith({
      where: { name: "새이름" },
      select: { id: true },
    });
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { name: "새이름" },
    });
  });

  it("10글자를 넘으면 저장하지 않는다", async () => {
    const res = await save({ name: "가".repeat(11) });
    expect(res.body).toEqual({
      success: false,
      error: "닉네임은 최대 10글자까지 입력할 수 있어요.",
    });
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("빈 문자열 닉네임은 거절한다", async () => {
    const res = await save({ name: "   " });
    expect(res.body).toEqual({ success: false, error: "닉네임을 입력해주세요." });
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("검사 뒤 동시에 같은 이름이 저장돼 unique 위반(P2002)이 나면 중복 안내", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    mockClient.user.update.mockRejectedValue(p2002());
    const res = await save({ name: "새이름" });
    expect(res.body).toEqual({ success: false, error: "중복된 닉네임입니다." });
  });

  it("그 밖의 DB 오류는 Prisma 메시지를 노출하지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    mockClient.user.update.mockRejectedValue(
      new Error("Invalid `prisma.user.update()` invocation: connection refused")
    );
    const res = await save({ name: "새이름" });
    expect(res.body).toEqual({ success: false, error: "프로필 저장에 실패했습니다." });
  });

  it("아바타만 바꾸면 닉네임 검사 없이 아바타만 저장한다", async () => {
    const res = await save({ name: null, avatarId: "img-1" });
    expect(res.body).toEqual({ success: true });
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
    expect(mockClient.user.update).toHaveBeenCalledTimes(1);
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { avatar: "img-1" },
    });
  });
});

describe("POST /api/users/me 소개(bio) — 앱 docs/prd/profile.md AC-2", () => {
  it("bio 키가 없으면 소개를 건드리지 않는다", async () => {
    await save({ avatarId: "img-1" });
    expect(mockClient.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bio: expect.anything() }) })
    );
  });

  it("정규화한 소개를 저장하고 응답에 돌려준다", async () => {
    const res = await save({ bio: "  왕사슴 키워요\n\n\n\n문의는 채팅  " });
    expect(res.body).toEqual({ success: true, bio: "왕사슴 키워요\n\n문의는 채팅" });
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { bio: "왕사슴 키워요\n\n문의는 채팅" },
    });
  });

  it("빈 문자열이면 null 로 지운다", async () => {
    const res = await save({ bio: "   " });
    expect(res.body).toEqual({ success: true, bio: null });
    expect(mockClient.user.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { bio: null } });
  });

  it("300자까지 저장한다(v5)", async () => {
    const res = await save({ bio: "가".repeat(300) });
    expect(res.body).toEqual({ success: true, bio: "가".repeat(300) });
  });

  it("301자 이상이면 저장하지 않고 BIO_TOO_LONG(다른 필드도 저장하지 않는다)", async () => {
    const res = await save({ bio: "가".repeat(301), avatarId: "img-1" });
    expect(res.body).toMatchObject({ success: false, errorCode: "BIO_TOO_LONG" });
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/users/me 대표 링크·커버(v5) — 앱 docs/prd/profile.md §10", () => {
  it("링크를 정규화해 저장하고 응답에 돌려준다", async () => {
    const res = await save({ profileLink: " youtube.com/@bredy " });
    expect(res.body).toEqual({ success: true, profileLink: "https://youtube.com/@bredy" });
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { profileLink: "https://youtube.com/@bredy" },
    });
  });

  it("javascript: 링크는 저장하지 않고 LINK_INVALID(다른 필드도 저장하지 않는다)", async () => {
    const res = await save({ profileLink: "javascript:alert(1)", bio: "안녕" });
    expect(res.body).toMatchObject({ success: false, errorCode: "LINK_INVALID" });
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("커버 id 를 저장하고 null 이면 지운다", async () => {
    const saved = await save({ bannerId: "cover-1" });
    expect(saved.body).toEqual({ success: true, profileBanner: "cover-1" });
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { profileBanner: "cover-1" },
    });
    mockClient.user.update.mockClear();
    const removed = await save({ bannerId: null });
    expect(removed.body).toEqual({ success: true, profileBanner: null });
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { profileBanner: null },
    });
  });

  it("소개·링크·커버를 한 번에 저장한다", async () => {
    await save({ bio: "소개", profileLink: "https://blog.naver.com/x", bannerId: "c2" });
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { bio: "소개", profileLink: "https://blog.naver.com/x", profileBanner: "c2" },
    });
  });

  it("커버 id 형식이 아니면 BANNER_INVALID", async () => {
    const res = await save({ bannerId: "https://evil.example/x.png" });
    expect(res.body).toMatchObject({ success: false, errorCode: "BANNER_INVALID" });
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/users/me", () => {
  it("tokenVersion·suspendedUntil 은 내려주지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 7, name: "브리디", status: "ACTIVE" });
    const res = await call({ method: "GET" });

    expect(res.body).toEqual({
      success: true,
      profile: { id: 7, name: "브리디", status: "ACTIVE" },
      isAdmin: false,
    });
    expect(mockClient.user.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      omit: { tokenVersion: true, suspendedUntil: true },
    });
  });
});
