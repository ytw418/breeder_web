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

import checkNameHandler from "../pages/api/users/check-name";

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
  };
  return res;
}

const me = { id: 7, name: "브리디" } as NextApiRequest["user"];

async function call(req: Partial<NextApiRequest>) {
  const res = createRes();
  await checkNameHandler(
    { method: "GET", headers: {}, query: {}, body: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/users/check-name", () => {
  it("로그인하지 않으면 401", async () => {
    const res = await call({ query: { name: "새이름" } });
    expect(res.statusCode).toBe(401);
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
  });

  it("GET 외 메서드는 405", async () => {
    const res = await call({ method: "POST", user: me, query: { name: "새이름" } });
    expect(res.statusCode).toBe(405);
  });

  it("사용 가능한 닉네임이면 available=true, 캐시하지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    const res = await call({ user: me, query: { name: " 새이름 " } });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, available: true });
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(mockClient.user.findUnique).toHaveBeenCalledWith({
      where: { name: "새이름" },
      select: { id: true },
    });
  });

  it("본인의 현재 닉네임은 사용 가능", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 7 });
    const res = await call({ user: me, query: { name: "브리디" } });
    expect(res.body).toEqual({ success: true, available: true });
  });

  it("다른 유저가 쓰면 TAKEN 사유", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 8 });
    const res = await call({ user: me, query: { name: "남의이름" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      available: false,
      code: "TAKEN",
      reason: "중복된 닉네임입니다.",
    });
  });

  it("입력 오류도 200 + available=false 로 돌려준다", async () => {
    const empty = await call({ user: me, query: {} });
    expect(empty.statusCode).toBe(200);
    expect(empty.body).toEqual({
      success: true,
      available: false,
      code: "EMPTY",
      reason: "닉네임을 입력해주세요.",
    });

    const tooLong = await call({ user: me, query: { name: "가".repeat(11) } });
    expect(tooLong.body).toEqual(
      expect.objectContaining({ available: false, code: "TOO_LONG" })
    );

    const reserved = await call({ user: me, query: { name: "탈퇴한 사용자" } });
    expect(reserved.body).toEqual(
      expect.objectContaining({ available: false, code: "RESERVED" })
    );
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
  });

  it("DB 오류면 500 이지만 Prisma 메시지를 노출하지 않는다", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockClient.user.findUnique.mockRejectedValue(
      new Error(
        "Invalid `prisma.user.findUnique()` invocation: Can't reach database server at `db.pooler.supabase.com:6543`"
      )
    );

    const res = await call({ user: me, query: { name: "새이름" } });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      available: false,
      message: "닉네임 확인에 실패했습니다.",
    });
    expect(JSON.stringify(res.body)).not.toContain("prisma");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("name 이 여러 번 오면 첫 값을 쓴다", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    await call({ user: me, query: { name: ["첫째", "둘째"] } });
    expect(mockClient.user.findUnique).toHaveBeenCalledWith({
      where: { name: "첫째" },
      select: { id: true },
    });
  });
});
