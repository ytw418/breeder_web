/**
 * @jest-environment node
 */
import { createHash } from "crypto";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";

import { SocialAuthError, verifySocialLogin } from "@libs/server/socialAuth";

const FIREBASE_PROJECT_ID = "breeder-1901f";

type KeyMaterial = {
  privateKey: CryptoKey;
  keys: ReturnType<typeof createLocalJWKSet>;
};

async function createKeys(kid: string): Promise<KeyMaterial> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256" };
  return { privateKey, keys: createLocalJWKSet({ keys: [jwk] }) };
}

function sign(
  key: KeyMaterial,
  kid: string,
  claims: Record<string, unknown>,
  { issuer, audience, subject }: { issuer: string; audience: string; subject: string }
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key.privateKey);
}

function kakaoFetch(
  me: { status: number; body?: unknown },
  tokenInfo: { status: number; body?: unknown } = { status: 200, body: { app_id: 1 } }
) {
  const mock = jest.fn(async (url: string) => {
    const target = url.includes("access_token_info") ? tokenInfo : me;
    return {
      ok: target.status >= 200 && target.status < 300,
      status: target.status,
      json: async () => target.body,
    } as Response;
  });
  return mock as unknown as typeof fetch & typeof mock;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, FIREBASE_PROJECT_ID };
  delete process.env.KAKAO_APP_ID;
  delete process.env.APPLE_ALLOWED_AUDIENCES;
  delete process.env.APPLE_SERVICES_ID;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("verifySocialLogin - kakao", () => {
  it("카카오 서버가 돌려준 회원번호와 인증된 이메일을 쓴다", async () => {
    const fetchImpl = kakaoFetch({
      status: 200,
      body: {
        id: 4242,
        kakao_account: {
          email: "User@Example.com",
          is_email_valid: true,
          is_email_verified: true,
          profile: { profile_image_url: "https://k.kakaocdn.net/p.jpg" },
        },
      },
    });

    const account = await verifySocialLogin("kakao", "kakao-access", {
      fetchImpl,
    });

    expect(account).toEqual({
      snsId: "4242",
      email: "user@example.com",
      avatar: "https://k.kakaocdn.net/p.jpg",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://kapi.kakao.com/v2/user/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer kakao-access" }),
      })
    );
  });

  it("인증되지 않은 카카오 이메일은 쓰지 않는다", async () => {
    const fetchImpl = kakaoFetch({
      status: 200,
      body: {
        id: 1,
        kakao_account: { email: "x@y.com", is_email_valid: true, is_email_verified: false },
      },
    });

    const account = await verifySocialLogin("kakao", "t", { fetchImpl });
    expect(account.email).toBeNull();
  });

  it("카카오가 토큰을 거부하면 SocialAuthError", async () => {
    const fetchImpl = kakaoFetch({ status: 401, body: { code: -401 } });
    await expect(verifySocialLogin("kakao", "bad", { fetchImpl })).rejects.toBeInstanceOf(
      SocialAuthError
    );
  });

  it("KAKAO_APP_ID 가 있으면 다른 앱에서 발급한 토큰을 거부한다", async () => {
    process.env.KAKAO_APP_ID = "1000";
    const fetchImpl = kakaoFetch(
      { status: 200, body: { id: 1 } },
      { status: 200, body: { app_id: 9999 } }
    );
    await expect(verifySocialLogin("kakao", "t", { fetchImpl })).rejects.toBeInstanceOf(
      SocialAuthError
    );
  });
});

describe("verifySocialLogin - google(Firebase ID 토큰)", () => {
  const issuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  it("서명이 맞는 Firebase ID 토큰의 uid 를 snsId 로 쓴다", async () => {
    const key = await createKeys("g1");
    const token = await sign(
      key,
      "g1",
      { email: "a@gmail.com", email_verified: true, picture: "https://lh3/p.png" },
      { issuer, audience: FIREBASE_PROJECT_ID, subject: "firebase-uid-1" }
    );

    const account = await verifySocialLogin("google", token, { googleKeys: key.keys });

    expect(account).toEqual({
      snsId: "firebase-uid-1",
      email: "a@gmail.com",
      avatar: "https://lh3/p.png",
    });
  });

  it("다른 Firebase 프로젝트의 토큰은 거부한다", async () => {
    const key = await createKeys("g1");
    const token = await sign(
      key,
      "g1",
      {},
      {
        issuer: "https://securetoken.google.com/other-project",
        audience: "other-project",
        subject: "uid",
      }
    );
    await expect(
      verifySocialLogin("google", token, { googleKeys: key.keys })
    ).rejects.toBeInstanceOf(SocialAuthError);
  });

  it("다른 키로 서명한 토큰은 거부한다", async () => {
    const trusted = await createKeys("g1");
    const attacker = await createKeys("g1");
    const token = await sign(attacker, "g1", {}, {
      issuer,
      audience: FIREBASE_PROJECT_ID,
      subject: "victim-uid",
    });
    await expect(
      verifySocialLogin("google", token, { googleKeys: trusted.keys })
    ).rejects.toBeInstanceOf(SocialAuthError);
  });

  it("email_verified 가 아니면 이메일을 쓰지 않는다", async () => {
    const key = await createKeys("g1");
    const token = await sign(key, "g1", { email: "a@gmail.com", email_verified: false }, {
      issuer,
      audience: FIREBASE_PROJECT_ID,
      subject: "uid",
    });
    const account = await verifySocialLogin("google", token, { googleKeys: key.keys });
    expect(account.email).toBeNull();
  });
});

describe("verifySocialLogin - apple", () => {
  const issuer = "https://appleid.apple.com";

  it("앱 번들 ID 로 발급된 identityToken 의 sub 를 쓴다", async () => {
    const key = await createKeys("a1");
    const token = await sign(key, "a1", { email: "r@privaterelay.appleid.com", email_verified: "true" }, {
      issuer,
      audience: "app.bredy.mobile",
      subject: "001234.abcd.0001",
    });

    const account = await verifySocialLogin("apple", token, { appleKeys: key.keys });

    expect(account).toEqual({
      snsId: "001234.abcd.0001",
      email: "r@privaterelay.appleid.com",
      avatar: null,
    });
  });

  it("다른 앱(aud) 용 토큰은 거부한다", async () => {
    const key = await createKeys("a1");
    const token = await sign(key, "a1", {}, {
      issuer,
      audience: "com.other.app",
      subject: "s",
    });
    await expect(
      verifySocialLogin("apple", token, { appleKeys: key.keys })
    ).rejects.toBeInstanceOf(SocialAuthError);
  });
});

describe("verifySocialLogin - apple 웹 로그인(Services ID, nonce)", () => {
  const issuer = "https://appleid.apple.com";
  const SERVICES_ID = "app.bredy.web";
  const RAW_NONCE = "0123456789abcdef0123456789abcdef";
  const NONCE_HASH = createHash("sha256").update(RAW_NONCE).digest("hex");

  const signApple = (key: KeyMaterial, audience: string, claims: Record<string, unknown> = {}) =>
    sign(key, "a1", claims, { issuer, audience, subject: "001234.abcd.0001" });

  beforeEach(() => {
    process.env.APPLE_SERVICES_ID = SERVICES_ID;
  });

  it("Services ID aud 에 원래 nonce 가 맞으면 같은 sub 로 통과한다", async () => {
    const key = await createKeys("a1");
    const token = await signApple(key, SERVICES_ID, { nonce: NONCE_HASH });

    const account = await verifySocialLogin("apple", token, {
      appleKeys: key.keys,
      nonce: RAW_NONCE,
    });
    expect(account.snsId).toBe("001234.abcd.0001");
  });

  it("콜백은 nonce 해시로 확인한다", async () => {
    const key = await createKeys("a1");
    const token = await signApple(key, SERVICES_ID, { nonce: NONCE_HASH });
    await expect(
      verifySocialLogin("apple", token, { appleKeys: key.keys, nonceHash: NONCE_HASH })
    ).resolves.toMatchObject({ snsId: "001234.abcd.0001" });
  });

  it("Services ID aud 인데 nonce 를 안 보내면 거부한다", async () => {
    const key = await createKeys("a1");
    const token = await signApple(key, SERVICES_ID, { nonce: NONCE_HASH });
    await expect(
      verifySocialLogin("apple", token, { appleKeys: key.keys })
    ).rejects.toBeInstanceOf(SocialAuthError);
  });

  it("nonce 가 다르면 거부한다(남이 받은 토큰을 가져온 경우)", async () => {
    const key = await createKeys("a1");
    const token = await signApple(key, SERVICES_ID, { nonce: NONCE_HASH });
    await expect(
      verifySocialLogin("apple", token, { appleKeys: key.keys, nonce: "other" })
    ).rejects.toBeInstanceOf(SocialAuthError);
  });

  it("앱 번들 aud 에 nonce 가 없는 iOS 토큰은 지금처럼 통과한다", async () => {
    const key = await createKeys("a1");
    const token = await signApple(key, "app.bredy.mobile");
    await expect(
      verifySocialLogin("apple", token, { appleKeys: key.keys })
    ).resolves.toMatchObject({ snsId: "001234.abcd.0001" });
  });

  it("앱 번들 aud 라도 토큰에 nonce 가 있으면 맞는 nonce 가 있어야 한다", async () => {
    const key = await createKeys("a1");
    const token = await signApple(key, "app.bredy.mobile", { nonce: NONCE_HASH });
    await expect(
      verifySocialLogin("apple", token, { appleKeys: key.keys })
    ).rejects.toBeInstanceOf(SocialAuthError);
    await expect(
      verifySocialLogin("apple", token, { appleKeys: key.keys, nonce: RAW_NONCE })
    ).resolves.toMatchObject({ snsId: "001234.abcd.0001" });
  });

  it("APPLE_SERVICES_ID 가 없으면 Services ID aud 를 받지 않는다", async () => {
    delete process.env.APPLE_SERVICES_ID;
    const key = await createKeys("a1");
    const token = await signApple(key, SERVICES_ID, { nonce: NONCE_HASH });
    await expect(
      verifySocialLogin("apple", token, { appleKeys: key.keys, nonce: RAW_NONCE })
    ).rejects.toBeInstanceOf(SocialAuthError);
  });
});

describe("verifySocialLogin - 공통", () => {
  it("빈 토큰은 거부한다", async () => {
    await expect(verifySocialLogin("google", "")).rejects.toBeInstanceOf(SocialAuthError);
  });
});
