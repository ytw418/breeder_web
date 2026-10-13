/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

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

const mockStoreAppleRefreshToken = jest.fn();
jest.mock("@libs/server/appleTokens", () => ({
  storeAppleRefreshToken: (...args: unknown[]) => mockStoreAppleRefreshToken(...args),
}));

import startHandler from "../pages/api/auth/apple/start";
import callbackHandler from "../pages/api/auth/apple/callback";
import { hashAppleNonce, signAppleState, verifyAppleState } from "@libs/server/appleOAuth";

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    redirectedTo: undefined as string | undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    send(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
    redirect(status: number, url: string) {
      res.statusCode = status;
      res.redirectedTo = url;
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

const ORIGINAL_ENV = process.env;
const nowSeconds = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    COOKIE_PASSWORD: "test-cookie-password",
    APPLE_SERVICES_ID: "app.bredy.web",
    APPLE_REDIRECT_URI: "https://bredy.app/api/auth/apple/callback",
  };
  delete process.env.APPLE_STATE_SECRET;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("GET /api/auth/apple/start", () => {
  it("Apple 로그인 주소와 원래 nonce 를 주고, 주소의 nonce 는 그 해시다", async () => {
    const res = await call(startHandler, {
      method: "GET",
      query: { target: "app", next: "/posts/3" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.success).toBe(true);
    const url = new URL(res.body.authorizeUrl);
    expect(`${url.origin}${url.pathname}`).toBe("https://appleid.apple.com/auth/authorize");
    expect(url.searchParams.get("client_id")).toBe("app.bredy.web");
    expect(url.searchParams.get("nonce")).toBe(hashAppleNonce(res.body.nonce));

    const state = verifyAppleState(url.searchParams.get("state"));
    expect(state).toMatchObject({ t: "app", n: "/posts/3", h: hashAppleNonce(res.body.nonce) });
  });

  it("다른 사이트로 가는 next 는 / 로 바꾼다", async () => {
    const res = await call(startHandler, {
      method: "GET",
      query: { target: "web", next: "//evil.example" },
    });
    const url = new URL(res.body.authorizeUrl);
    expect(verifyAppleState(url.searchParams.get("state"))).toMatchObject({ t: "web", n: "/" });
  });

  it("target 이 없거나 이상하면 400", async () => {
    expect((await call(startHandler, { method: "GET", query: {} })).statusCode).toBe(400);
    expect(
      (await call(startHandler, { method: "GET", query: { target: "ios" } })).statusCode
    ).toBe(400);
  });

  it("Services ID 설정이 없으면 500 이고 주소를 주지 않는다", async () => {
    delete process.env.APPLE_SERVICES_ID;
    const res = await call(startHandler, { method: "GET", query: { target: "app" } });
    expect(res.statusCode).toBe(500);
    expect(res.body.errorCode).toBe("APPLE_CONFIG");
    expect(res.body.authorizeUrl).toBeUndefined();
  });

  it("POST 는 405", async () => {
    expect((await call(startHandler, { method: "POST" })).statusCode).toBe(405);
  });
});

describe("POST /api/auth/apple/callback", () => {
  const stateFor = (t: "web" | "app", next = "/") =>
    signAppleState({ t, n: next, h: "nonce-hash", exp: nowSeconds() + 600 });

  it("앱: 토큰을 검증한 뒤 intent 주소로 넘긴다", async () => {
    mockVerifySocialLogin.mockResolvedValue({ snsId: "001.a.1", email: null, avatar: null });

    const res = await call(callbackHandler, {
      method: "POST",
      body: { state: stateFor("app"), id_token: "a.b.c", code: "c" },
    });

    expect(mockVerifySocialLogin).toHaveBeenCalledWith("apple", "a.b.c", {
      nonceHash: "nonce-hash",
    });
    expect(res.statusCode).toBe(303);
    expect(res.redirectedTo).toBe(
      "intent://auth/apple?id_token=a.b.c#Intent;scheme=bredy;package=app.bredy.mobile;end"
    );
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("form_post 로 받은 code 를 철회용 토큰으로 바꿔 둔다(Services ID)", async () => {
    mockVerifySocialLogin.mockResolvedValue({
      snsId: "001.a.1",
      email: null,
      avatar: null,
      appleClientId: "app.bredy.web",
    });
    mockStoreAppleRefreshToken.mockResolvedValue(true);

    const res = await call(callbackHandler, {
      method: "POST",
      body: { state: stateFor("app"), id_token: "a.b.c", code: "c.web" },
    });

    expect(res.statusCode).toBe(303);
    expect(mockStoreAppleRefreshToken).toHaveBeenCalledWith({
      snsId: "001.a.1",
      code: "c.web",
      clientId: "app.bredy.web",
    });
  });

  it("웹: 토큰을 URL 에 싣지 않고 복귀 페이지(HTML)로 완료 페이지에 넘긴다", async () => {
    mockVerifySocialLogin.mockResolvedValue({ snsId: "001.a.1", email: null, avatar: null });

    const res = await call(callbackHandler, {
      method: "POST",
      body: { state: stateFor("web", "/posts/3"), id_token: "a.b.c" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.redirectedTo).toBeUndefined();
    expect(res.headers["content-type"]).toContain("text/html");
    expect(String(res.body)).toContain('sessionStorage.setItem("bredy:apple-return","a.b.c")');
    expect(String(res.body)).toContain("/auth/apple/complete?next=%2Fposts%2F3");
  });

  it("사용자가 취소하면 토큰 없이 취소로 돌려보낸다", async () => {
    const res = await call(callbackHandler, {
      method: "POST",
      body: { state: stateFor("app"), error: "user_cancelled_authorize" },
    });
    expect(mockVerifySocialLogin).not.toHaveBeenCalled();
    expect(res.redirectedTo).toBe(
      "intent://auth/apple?error=apple_cancelled#Intent;scheme=bredy;package=app.bredy.mobile;end"
    );

    const web = await call(callbackHandler, {
      method: "POST",
      body: { state: stateFor("web"), error: "user_cancelled_authorize" },
    });
    expect(web.redirectedTo).toBe("/auth/login?error=apple_cancelled");
  });

  it("토큰 검증에 실패하면 apple_token 오류로 돌려보낸다", async () => {
    mockVerifySocialLogin.mockRejectedValue(new MockSocialAuthError("bad"));
    const res = await call(callbackHandler, {
      method: "POST",
      body: { state: stateFor("app"), id_token: "forged" },
    });
    expect(res.statusCode).toBe(303);
    expect(res.redirectedTo).toContain("error=apple_token");
    expect(res.redirectedTo).not.toContain("forged");
  });

  it("id_token 이 없으면 apple_token 오류", async () => {
    const res = await call(callbackHandler, {
      method: "POST",
      body: { state: stateFor("web") },
    });
    expect(mockVerifySocialLogin).not.toHaveBeenCalled();
    expect(res.redirectedTo).toBe("/auth/login?error=apple_token");
  });

  it("서명이 틀린 state 는 토큰을 검증하지 않고 apple_state 로 돌려보낸다", async () => {
    const forged = Buffer.from(
      JSON.stringify({ t: "app", n: "/", h: "nonce-hash", exp: nowSeconds() + 600 })
    ).toString("base64url");

    const res = await call(callbackHandler, {
      method: "POST",
      body: { state: `${forged}.bad`, id_token: "a.b.c" },
    });

    expect(mockVerifySocialLogin).not.toHaveBeenCalled();
    expect(res.redirectedTo).toBe(
      "intent://auth/apple?error=apple_state#Intent;scheme=bredy;package=app.bredy.mobile;end"
    );

    const web = await call(callbackHandler, {
      method: "POST",
      body: { state: "garbage", id_token: "a.b.c" },
    });
    expect(web.redirectedTo).toBe("/auth/login?error=apple_state");
  });

  it("GET 은 405", async () => {
    expect((await call(callbackHandler, { method: "GET" })).statusCode).toBe(405);
  });
});
