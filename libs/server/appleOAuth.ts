import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

import { APPLE_WEB_RETURN_STORAGE_KEY, type AppleLoginErrorCode } from "@libs/shared/appleLogin";

/**
 * Apple 웹 로그인(Services ID) — Android 앱·웹이 쓴다. iOS 앱은 네이티브 버튼이라 이 흐름을 타지 않는다.
 *
 * 1) GET /api/auth/apple/start 가 nonce 와 서명한 state 를 만들어 Apple 로그인 주소를 준다.
 * 2) Apple 이 POST /api/auth/apple/callback 으로 id_token 을 보내면 state·토큰을 검증하고
 *    앱이면 intent 주소로, 웹이면 같은 사이트 복귀 페이지(sessionStorage)로 토큰을 넘긴다.
 * 3) 클라이언트가 그 토큰과 원래 nonce 로 기존 POST /api/auth/login(provider apple)을 부른다.
 *
 * 목적지는 state 의 t(web/app)로만 정해 열린 리다이렉트가 생기지 않는다. 원래 nonce 는 흐름을
 * 시작한 클라이언트만 알아서, 남이 받은 id_token 으로는 /api/auth/login 을 통과하지 못한다.
 */

export type AppleLoginTarget = "web" | "app";

export interface AppleStatePayload {
  /** 돌아갈 곳 */
  t: AppleLoginTarget;
  /** 로그인 뒤 갈 같은 사이트 경로(웹) */
  n: string;
  /** nonce 의 sha256 hex. Apple 이 id_token 의 nonce 클레임에 그대로 넣는다. */
  h: string;
  /** 만료(초) */
  exp: number;
}

export type AppleReturnError = Exclude<AppleLoginErrorCode, "apple_restart">;

export const APPLE_STATE_TTL_SECONDS = 60 * 10;
export const APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
export const APPLE_WEB_COMPLETE_PATH = "/auth/apple/complete";

const APP_SCHEME = "bredy";
const APP_PACKAGE = "app.bredy.mobile";
const APP_RETURN_HOST_PATH = "auth/apple";

const isTarget = (value: unknown): value is AppleLoginTarget =>
  value === "web" || value === "app";

export function getAppleOAuthConfig(): { servicesId: string; redirectUri: string } | null {
  const servicesId = process.env.APPLE_SERVICES_ID?.trim();
  const redirectUri = process.env.APPLE_REDIRECT_URI?.trim();
  if (!servicesId || !redirectUri) return null;
  return { servicesId, redirectUri };
}

function getStateSecret(): string {
  const dedicated = process.env.APPLE_STATE_SECRET?.trim();
  if (dedicated) return dedicated;
  const base = process.env.COOKIE_PASSWORD;
  if (!base) {
    throw new Error("Apple 로그인 state 서명용 시크릿이 없습니다. COOKIE_PASSWORD 를 설정하세요.");
  }
  // 세션 비밀번호를 재사용할 때는 다른 서명(JWT 등)과 키가 겹치지 않게 접미사로 분리한다.
  return `${base}:apple-state`;
}

const hmac = (body: string) =>
  createHmac("sha256", getStateSecret()).update(body).digest("base64url");

export const createAppleNonce = () => randomBytes(16).toString("hex");

export const hashAppleNonce = (rawNonce: string) =>
  createHash("sha256").update(rawNonce).digest("hex");

export function signAppleState(payload: AppleStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

function decodeStateBody(body: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function verifyAppleState(state: unknown, now = Date.now()): AppleStatePayload | null {
  if (typeof state !== "string") return null;
  const [body, signature, extra] = state.split(".");
  if (!body || !signature || extra !== undefined) return null;

  const expected = Buffer.from(hmac(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const payload = decodeStateBody(body);
  if (
    !payload ||
    !isTarget(payload.t) ||
    typeof payload.n !== "string" ||
    typeof payload.h !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp * 1000 <= now
  ) {
    return null;
  }
  return { t: payload.t, n: payload.n, h: payload.h, exp: payload.exp };
}

/**
 * 서명을 믿을 수 없을 때 오류 안내를 어디로 보낼지만 고른다. 토큰은 절대 싣지 않으므로
 * 위조돼도 두 고정 목적지 중 하나로 오류만 전달된다.
 */
export function peekAppleStateTarget(state: unknown): AppleLoginTarget | null {
  if (typeof state !== "string") return null;
  const payload = decodeStateBody(state.split(".")[0] ?? "");
  return payload && isTarget(payload.t) ? payload.t : null;
}

/** 같은 사이트 경로만 남긴다(웹 libs/client/postLogin getSafeNextPath 와 같은 규칙). */
export function sanitizeAppleNextPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "/";
  let normalized = raw.trim();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // noop
  }
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return "/";
  return normalized;
}

export function buildAppleAuthorizeUrl({
  servicesId,
  redirectUri,
  state,
  nonceHash,
}: {
  servicesId: string;
  redirectUri: string;
  state: string;
  nonceHash: string;
}): string {
  const params = new URLSearchParams({
    client_id: servicesId,
    redirect_uri: redirectUri,
    // 이름·이메일 scope 를 요청하면 Apple 은 form_post 만 허용한다.
    response_type: "code id_token",
    response_mode: "form_post",
    scope: "name email",
    state,
    nonce: nonceHash,
  });
  // 공백은 %20 으로 보낸다(값 안의 + 는 URLSearchParams 가 이미 %2B 로 바꾼다).
  return `${APPLE_AUTHORIZE_URL}?${params.toString().replace(/\+/g, "%20")}`;
}

/**
 * 앱 복귀 주소. bredy:// 대신 패키지를 지정한 intent 주소를 써서 다른 앱이 같은 스킴으로 토큰을
 * 가로채지 못하게 한다. Chrome Custom Tab 이 열어 `bredy://auth/apple?...` 로 앱에 전달된다.
 */
export function buildAppleAppReturnUrl(
  result: { idToken: string } | { error: AppleReturnError }
): string {
  const query =
    "idToken" in result
      ? `id_token=${encodeURIComponent(result.idToken)}`
      : `error=${encodeURIComponent(result.error)}`;
  return `intent://${APP_RETURN_HOST_PATH}?${query}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};end`;
}

export const buildAppleWebErrorUrl = (error: AppleReturnError) =>
  `/auth/login?error=${encodeURIComponent(error)}`;

/** `<script>` 안에 넣을 JSON 문자열. `<` 를 이스케이프해 스크립트가 끊기지 않게 한다. */
const scriptString = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * 웹 복귀 페이지. id_token 을 URL 에 실으면 분석 도구(PostHog 페이지뷰)·방문 기록에 남으니
 * 같은 사이트 sessionStorage 로 넘기고, 기록을 남기지 않게 완료 페이지로 replace 한다.
 */
export function renderAppleWebReturnPage({ idToken, next }: { idToken: string; next: string }) {
  const completeUrl = `${APPLE_WEB_COMPLETE_PATH}?next=${encodeURIComponent(
    sanitizeAppleNextPath(next)
  )}`;
  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>로그인 처리 중</title></head>
<body>
<script>
try{sessionStorage.setItem(${scriptString(APPLE_WEB_RETURN_STORAGE_KEY)},${scriptString(idToken)})}catch(e){}
location.replace(${scriptString(completeUrl)});
</script>
</body>
</html>`;
}
