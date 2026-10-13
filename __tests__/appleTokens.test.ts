/**
 * @jest-environment node
 */
import { generateKeyPairSync } from "crypto";
import { decodeJwt, decodeProtectedHeader } from "jose";

const mockClient = {
  appleSignInToken: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

import {
  createAppleClientSecret,
  decryptAppleToken,
  encryptAppleToken,
  getAppleKeyConfig,
  revokeAppleSignIn,
  storeAppleRefreshToken,
} from "@libs/server/appleTokens";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const ENV_KEYS = [
  "APPLE_TEAM_ID",
  "APPLE_KEY_ID",
  "APPLE_PRIVATE_KEY",
  "APPLE_SERVICES_ID",
  "APPLE_REDIRECT_URI",
  "COOKIE_PASSWORD",
  "APPLE_TOKEN_SECRET",
] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.APPLE_TEAM_ID = "TEAM123456";
  process.env.APPLE_KEY_ID = "KEY1234567";
  // Vercel 환경 변수에는 줄바꿈을 \n 글자로 넣는 경우가 많다.
  process.env.APPLE_PRIVATE_KEY = PRIVATE_KEY_PEM.replace(/\n/g, "\\n");
  process.env.APPLE_SERVICES_ID = "app.bredy.web";
  process.env.APPLE_REDIRECT_URI = "https://bredy.app/api/auth/apple/callback";
  process.env.COOKIE_PASSWORD = "cookie-password-for-test-cookie-password";
  delete process.env.APPLE_TOKEN_SECRET;
  jest.clearAllMocks();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("getAppleKeyConfig", () => {
  it("키 세 값이 모두 있어야 설정으로 본다", () => {
    expect(getAppleKeyConfig()).toMatchObject({ teamId: "TEAM123456", keyId: "KEY1234567" });
    delete process.env.APPLE_KEY_ID;
    expect(getAppleKeyConfig()).toBeNull();
  });

  it("\\n 글자로 넣은 키를 실제 줄바꿈으로 되돌린다", () => {
    expect(getAppleKeyConfig()?.privateKey).toBe(PRIVATE_KEY_PEM);
  });
});

describe("createAppleClientSecret", () => {
  it("Apple 규격(ES256, kid, iss=팀, sub=클라이언트 ID, aud=appleid)으로 서명한다", async () => {
    const config = getAppleKeyConfig()!;
    const now = new Date("2026-10-12T00:00:00Z");
    const secret = await createAppleClientSecret("app.bredy.mobile", config, now);

    expect(decodeProtectedHeader(secret)).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
    const claims = decodeJwt(secret);
    expect(claims).toMatchObject({
      iss: "TEAM123456",
      sub: "app.bredy.mobile",
      aud: "https://appleid.apple.com",
      iat: now.getTime() / 1000,
    });
    // Apple 은 최대 6개월까지 받는다. 짧게 둔다.
    expect((claims.exp as number) - (claims.iat as number)).toBeLessThanOrEqual(60 * 10);
  });
});

describe("encryptAppleToken", () => {
  it("암호문에 원문이 보이지 않고 되돌리면 같다", () => {
    const encrypted = encryptAppleToken("r.apple-refresh-token");
    expect(encrypted).not.toContain("apple-refresh-token");
    expect(decryptAppleToken(encrypted)).toBe("r.apple-refresh-token");
  });

  it("변조된 암호문은 null", () => {
    const encrypted = encryptAppleToken("r.apple-refresh-token");
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith("A") ? "BB" : "AA");
    expect(decryptAppleToken(tampered)).toBeNull();
  });
});

describe("storeAppleRefreshToken", () => {
  it("iOS 코드(번들 ID)는 redirect_uri 없이 교환하고 snsId 로 암호화 저장한다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, { refresh_token: "r.native", access_token: "a", id_token: "i" })
    );
    const stored = await storeAppleRefreshToken(
      { snsId: "apple-sub-1", code: "c.native", clientId: "app.bredy.mobile" },
      { fetchImpl }
    );

    expect(stored).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://appleid.apple.com/auth/token");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("c.native");
    expect(body.get("client_id")).toBe("app.bredy.mobile");
    expect(body.get("client_secret")).toBeTruthy();
    expect(body.has("redirect_uri")).toBe(false);

    const upsert = mockClient.appleSignInToken.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ snsId: "apple-sub-1" });
    expect(upsert.create.clientId).toBe("app.bredy.mobile");
    expect(upsert.create.refreshToken).not.toBe("r.native");
    expect(decryptAppleToken(upsert.create.refreshToken)).toBe("r.native");
  });

  it("웹 코드(Services ID)는 로그인 때 쓴 redirect_uri 를 같이 보낸다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, { refresh_token: "r.web" }));
    await storeAppleRefreshToken(
      { snsId: "apple-sub-1", code: "c.web", clientId: "app.bredy.web" },
      { fetchImpl }
    );
    const body = new URLSearchParams(fetchImpl.mock.calls[0][1].body as string);
    expect(body.get("redirect_uri")).toBe("https://bredy.app/api/auth/apple/callback");
  });

  it("키 설정이 없으면 Apple 을 부르지 않고 false", async () => {
    delete process.env.APPLE_PRIVATE_KEY;
    const fetchImpl = jest.fn();
    await expect(
      storeAppleRefreshToken({ snsId: "s", code: "c", clientId: "app.bredy.mobile" }, { fetchImpl })
    ).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("Apple 이 거절해도 던지지 않는다(로그인은 계속돼야 한다)", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(400, { error: "invalid_grant" }));
    await expect(
      storeAppleRefreshToken({ snsId: "s", code: "c", clientId: "app.bredy.mobile" }, { fetchImpl })
    ).resolves.toBe(false);
    expect(mockClient.appleSignInToken.upsert).not.toHaveBeenCalled();
  });

  it("허용하지 않은 클라이언트 ID 는 교환하지 않는다", async () => {
    const fetchImpl = jest.fn();
    await expect(
      storeAppleRefreshToken({ snsId: "s", code: "c", clientId: "evil.app" }, { fetchImpl })
    ).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("revokeAppleSignIn", () => {
  it("저장된 refresh token 으로 철회하고 행을 지운다", async () => {
    mockClient.appleSignInToken.findUnique.mockResolvedValue({
      snsId: "apple-sub-1",
      clientId: "app.bredy.web",
      refreshToken: encryptAppleToken("r.web"),
    });
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, {}));

    await expect(revokeAppleSignIn("apple-sub-1", { fetchImpl })).resolves.toBe("revoked");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://appleid.apple.com/auth/revoke");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("token")).toBe("r.web");
    expect(body.get("token_type_hint")).toBe("refresh_token");
    expect(body.get("client_id")).toBe("app.bredy.web");
    expect(mockClient.appleSignInToken.delete).toHaveBeenCalledWith({
      where: { snsId: "apple-sub-1" },
    });
  });

  it("저장된 토큰이 없으면 none", async () => {
    mockClient.appleSignInToken.findUnique.mockResolvedValue(null);
    const fetchImpl = jest.fn();
    await expect(revokeAppleSignIn("apple-sub-1", { fetchImpl })).resolves.toBe("none");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("Apple 이 실패하면 행을 남겨 나중에 다시 시도한다", async () => {
    mockClient.appleSignInToken.findUnique.mockResolvedValue({
      snsId: "apple-sub-1",
      clientId: "app.bredy.mobile",
      refreshToken: encryptAppleToken("r.native"),
    });
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(503, {}));
    await expect(revokeAppleSignIn("apple-sub-1", { fetchImpl })).resolves.toBe("failed");
    expect(mockClient.appleSignInToken.delete).not.toHaveBeenCalled();
  });

  it("복호화할 수 없는 행은 쓸모가 없어 지운다", async () => {
    mockClient.appleSignInToken.findUnique.mockResolvedValue({
      snsId: "apple-sub-1",
      clientId: "app.bredy.mobile",
      refreshToken: "broken",
    });
    const fetchImpl = jest.fn();
    await expect(revokeAppleSignIn("apple-sub-1", { fetchImpl })).resolves.toBe("failed");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mockClient.appleSignInToken.delete).toHaveBeenCalled();
  });
});
