import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import client from "@libs/server/client";

/**
 * 탈퇴 시 Apple 로그인 토큰 철회(App Store 심사 가이드라인 5.1.1(v)).
 *
 * 1) 로그인할 때 Apple 이 준 authorization code 를 refresh token 으로 바꿔 Apple sub(snsId)별로 저장한다.
 *    - Android·웹: /api/auth/apple/callback 이 form_post 로 받은 code(클라이언트 ID = Services ID)
 *    - iOS: 앱이 /api/auth/login 에 보낸 authorizationCode(클라이언트 ID = 번들 ID)
 * 2) 탈퇴하면 그 refresh token 으로 /auth/revoke 를 불러 '애플로 로그인' 연결을 끊는다.
 *
 * code 는 5분 안에 한 번만 바꿀 수 있고, 만든 클라이언트 ID 로만 바꿀 수 있다.
 * 키(APPLE_TEAM_ID·APPLE_KEY_ID·APPLE_PRIVATE_KEY)가 없으면 아무것도 하지 않는다. 로그인은 막지 않는다.
 */

const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const APPLE_AUDIENCE = "https://appleid.apple.com";
const APPLE_BUNDLE_ID = "app.bredy.mobile";
const CLIENT_SECRET_TTL_SECONDS = 60 * 5;
const REQUEST_TIMEOUT_MS = 5000;

export interface AppleKeyConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
}

interface FetchOptions {
  fetchImpl?: typeof fetch;
}

export type AppleRevokeResult = "revoked" | "none" | "failed";

export function getAppleKeyConfig(): AppleKeyConfig | null {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_KEY_ID?.trim();
  // Vercel 에 .p8 내용을 한 줄로 넣으면 줄바꿈이 \n 글자로 들어온다.
  const privateKey = process.env.APPLE_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  if (!teamId || !keyId || !privateKey) return null;
  return { teamId, keyId, privateKey };
}

/** Apple 이 이 서버가 만든 토큰으로 인정하는 클라이언트 ID(iOS 번들 ID·Services ID). */
function getAllowedClientIds() {
  const servicesId = process.env.APPLE_SERVICES_ID?.trim();
  return servicesId ? [APPLE_BUNDLE_ID, servicesId] : [APPLE_BUNDLE_ID];
}

/** Apple 토큰 API 의 client_secret. 요청마다 짧게 만든다. */
export async function createAppleClientSecret(
  clientId: string,
  config: AppleKeyConfig,
  now = new Date()
): Promise<string> {
  // 로그인·탈퇴 모듈을 불러오는 곳(jsdom 테스트 포함)마다 jose 가 따라오지 않게 쓸 때만 불러온다.
  const { SignJWT, importPKCS8 } = await import("jose");
  const key = await importPKCS8(config.privateKey, "ES256");
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setSubject(clientId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + CLIENT_SECRET_TTL_SECONDS)
    .sign(key);
}

function getEncryptionKey() {
  const dedicated = process.env.APPLE_TOKEN_SECRET?.trim();
  const base = dedicated || process.env.COOKIE_PASSWORD;
  if (!base) {
    throw new Error("Apple 토큰 암호화 키가 없습니다. COOKIE_PASSWORD 를 설정하세요.");
  }
  // 세션 비밀번호를 재사용할 때는 다른 용도와 키가 겹치지 않게 접미사로 분리한다.
  return createHash("sha256").update(dedicated ? base : `${base}:apple-token`).digest();
}

/** AES-256-GCM. 저장 형식은 `iv.tag.암호문`(base64url). */
export function encryptAppleToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptAppleToken(stored: string): string | null {
  const [iv, tag, encrypted, extra] = stored.split(".");
  if (!iv || !tag || !encrypted || extra !== undefined) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

async function postForm(url: string, params: Record<string, string>, fetchImpl: typeof fetch) {
  return fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/**
 * authorization code 를 refresh token 으로 바꿔 저장한다. 실패해도 던지지 않는다(로그인을 막지 않는다).
 * 저장했으면 true.
 */
export async function storeAppleRefreshToken(
  { snsId, code, clientId }: { snsId: string; code: string; clientId: string },
  { fetchImpl = fetch }: FetchOptions = {}
): Promise<boolean> {
  const config = getAppleKeyConfig();
  if (!config || !code || !getAllowedClientIds().includes(clientId)) return false;

  try {
    const params: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: await createAppleClientSecret(clientId, config),
    };
    // 웹 로그인 code 는 authorize 때 쓴 redirect_uri 와 같아야 바꿔 준다. iOS 네이티브 code 는 보내지 않는다.
    const redirectUri = process.env.APPLE_REDIRECT_URI?.trim();
    if (clientId !== APPLE_BUNDLE_ID && redirectUri) params.redirect_uri = redirectUri;

    const response = await postForm(APPLE_TOKEN_URL, params, fetchImpl);
    const body = (await response.json().catch(() => ({}))) as { refresh_token?: unknown; error?: unknown };
    if (!response.ok || typeof body.refresh_token !== "string" || !body.refresh_token) {
      console.error("auth.apple.token.exchange.fail", response.status, body.error ?? null);
      return false;
    }

    const refreshToken = encryptAppleToken(body.refresh_token);
    await client.appleSignInToken.upsert({
      where: { snsId },
      create: { snsId, clientId, refreshToken },
      update: { clientId, refreshToken },
    });
    return true;
  } catch (error) {
    console.error("auth.apple.token.exchange.error", error);
    return false;
  }
}

/**
 * 탈퇴한 Apple 계정의 로그인 연결을 끊는다. 실패하면 행을 남겨 보관 기간 파기 때 다시 시도한다.
 */
export async function revokeAppleSignIn(
  snsId: string,
  { fetchImpl = fetch }: FetchOptions = {}
): Promise<AppleRevokeResult> {
  try {
    const row = await client.appleSignInToken.findUnique({ where: { snsId } });
    if (!row) return "none";

    const refreshToken = decryptAppleToken(row.refreshToken);
    if (!refreshToken) {
      // 암호화 키가 바뀌었거나 깨진 행이다. 다시 시도해도 소용없으니 지운다.
      console.error("auth.apple.revoke.undecryptable", snsId);
      await client.appleSignInToken.delete({ where: { snsId } });
      return "failed";
    }

    const config = getAppleKeyConfig();
    if (!config) {
      console.error("auth.apple.revoke.no_key");
      return "failed";
    }

    const response = await postForm(
      APPLE_REVOKE_URL,
      {
        client_id: row.clientId,
        client_secret: await createAppleClientSecret(row.clientId, config),
        token: refreshToken,
        token_type_hint: "refresh_token",
      },
      fetchImpl
    );
    if (!response.ok) {
      console.error("auth.apple.revoke.fail", response.status);
      return "failed";
    }

    await client.appleSignInToken.delete({ where: { snsId } });
    return "revoked";
  } catch (error) {
    console.error("auth.apple.revoke.error", error);
    return "failed";
  }
}
