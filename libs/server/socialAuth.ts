import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

/**
 * 소셜 로그인 토큰을 서버에서 검증해 계정 식별자(snsId)를 얻는다.
 *
 * 클라이언트가 보낸 snsId·email 을 그대로 믿으면 남의 snsId 만 알아도 그 계정의
 * 토큰을 받을 수 있다. 그래서 로그인 API 는 이 모듈이 돌려준 값만 쓴다.
 * - kakao: access token 으로 카카오 사용자 정보 API 를 호출한 결과의 회원번호
 * - google: Firebase ID 토큰(웹·앱 모두 Firebase Auth 경유)의 uid
 * - apple: identityToken 의 sub
 */

export type SocialProvider = "kakao" | "google" | "apple";

export interface VerifiedSocialAccount {
  snsId: string;
  /** 제공자가 인증했다고 확인한 이메일만 담는다(관리자 허용 목록이 이메일 기준이다). */
  email: string | null;
  avatar: string | null;
}

export class SocialAuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "SocialAuthError";
    this.status = status;
    // tsconfig target 이 es5 라 Error 상속 시 instanceof 가 깨지지 않게 프로토타입을 맞춘다.
    Object.setPrototypeOf(this, SocialAuthError.prototype);
  }
}

export interface SocialAuthOptions {
  fetchImpl?: typeof fetch;
  googleKeys?: JWTVerifyGetKey;
  appleKeys?: JWTVerifyGetKey;
}

const KAKAO_USER_ME_URL = "https://kapi.kakao.com/v2/user/me";
const KAKAO_TOKEN_INFO_URL = "https://kapi.kakao.com/v1/user/access_token_info";
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";
const DEFAULT_APPLE_AUDIENCES = ["app.bredy.mobile"];

let firebaseKeys: JWTVerifyGetKey | null = null;
let appleKeys: JWTVerifyGetKey | null = null;

const getFirebaseKeys = () =>
  (firebaseKeys ??= createRemoteJWKSet(new URL(FIREBASE_JWKS_URL)));
const getAppleKeys = () => (appleKeys ??= createRemoteJWKSet(new URL(APPLE_JWKS_URL)));

function parseJsonEnv(raw: string | undefined): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** 웹·앱이 같은 Firebase 프로젝트(breeder-1901f)를 쓴다. 서버 env 에서 프로젝트 ID 를 찾는다. */
function getFirebaseProjectId() {
  const fromEnv = process.env.FIREBASE_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const serviceAccount = parseJsonEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (typeof serviceAccount?.project_id === "string") return serviceAccount.project_id;

  const webConfig = parseJsonEnv(process.env.NEXT_PUBLIC_FIREBASE_CONFIG);
  if (typeof webConfig?.projectId === "string") return webConfig.projectId;

  return null;
}

function getAppleAudiences() {
  const raw = process.env.APPLE_ALLOWED_AUDIENCES?.trim();
  if (!raw) return DEFAULT_APPLE_AUDIENCES;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const normalizeEmail = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;

const nonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;

/** Apple 은 email_verified 를 "true" 문자열로 줄 때가 있다. */
const isTrueClaim = (value: unknown) => value === true || value === "true";

async function verifyKakao(
  token: string,
  fetchImpl: typeof fetch
): Promise<VerifiedSocialAccount> {
  const headers = { Authorization: `Bearer ${token}` };

  const meRes = await fetchImpl(KAKAO_USER_ME_URL, { method: "GET", headers });
  if (!meRes.ok) {
    throw new SocialAuthError("카카오 로그인 정보를 확인할 수 없습니다.");
  }
  const me = (await meRes.json()) as {
    id?: number | string;
    kakao_account?: {
      email?: string;
      is_email_valid?: boolean;
      is_email_verified?: boolean;
      profile?: { profile_image_url?: string; thumbnail_image_url?: string };
    };
  };
  if (me?.id === undefined || me?.id === null || me.id === "") {
    throw new SocialAuthError("카카오 회원번호를 확인할 수 없습니다.");
  }

  // 같은 카카오 앱(웹 JS 키·네이티브 키 공통)에서 발급한 토큰인지 확인한다.
  const expectedAppId = process.env.KAKAO_APP_ID?.trim();
  if (expectedAppId) {
    const infoRes = await fetchImpl(KAKAO_TOKEN_INFO_URL, { method: "GET", headers });
    const info = infoRes.ok ? ((await infoRes.json()) as { app_id?: number | string }) : null;
    if (!info || String(info.app_id) !== expectedAppId) {
      throw new SocialAuthError("다른 앱에서 발급된 카카오 토큰입니다.");
    }
  }

  const account = me.kakao_account;
  const emailUsable = account?.is_email_valid !== false && account?.is_email_verified === true;

  return {
    snsId: String(me.id),
    email: emailUsable ? normalizeEmail(account?.email) : null,
    avatar:
      nonEmptyString(account?.profile?.profile_image_url) ??
      nonEmptyString(account?.profile?.thumbnail_image_url),
  };
}

async function verifyJwt(
  token: string,
  keys: JWTVerifyGetKey,
  options: { issuer: string; audience: string | string[] }
): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: options.issuer,
      audience: options.audience,
      algorithms: ["RS256"],
    });
    if (!payload.sub) throw new Error("sub missing");
    return payload;
  } catch {
    throw new SocialAuthError("로그인 토큰이 유효하지 않습니다.");
  }
}

async function verifyGoogle(
  token: string,
  keys: JWTVerifyGetKey
): Promise<VerifiedSocialAccount> {
  const projectId = getFirebaseProjectId();
  if (!projectId) {
    throw new SocialAuthError("구글 로그인 서버 설정이 없습니다.", 500);
  }

  const payload = await verifyJwt(token, keys, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  return {
    snsId: payload.sub as string,
    email: isTrueClaim(payload.email_verified) ? normalizeEmail(payload.email) : null,
    avatar: nonEmptyString(payload.picture),
  };
}

async function verifyApple(
  token: string,
  keys: JWTVerifyGetKey
): Promise<VerifiedSocialAccount> {
  const payload = await verifyJwt(token, keys, {
    issuer: APPLE_ISSUER,
    audience: getAppleAudiences(),
  });

  return {
    snsId: payload.sub as string,
    email: isTrueClaim(payload.email_verified) ? normalizeEmail(payload.email) : null,
    avatar: null,
  };
}

export async function verifySocialLogin(
  provider: SocialProvider,
  token: string,
  options: SocialAuthOptions = {}
): Promise<VerifiedSocialAccount> {
  if (typeof token !== "string" || !token.trim()) {
    throw new SocialAuthError("로그인 토큰이 없습니다.");
  }

  switch (provider) {
    case "kakao":
      return verifyKakao(token, options.fetchImpl ?? fetch);
    case "google":
      return verifyGoogle(token, options.googleKeys ?? getFirebaseKeys());
    case "apple":
      return verifyApple(token, options.appleKeys ?? getAppleKeys());
    default:
      throw new SocialAuthError("지원하지 않는 로그인 방식입니다.", 400);
  }
}
