/**
 * 클라이언트(브라우저/웹뷰)의 Bearer 토큰 저장소.
 *
 * 순수 헤더 방식이므로 access/refresh 토큰을 localStorage 에 보관하고
 * 모든 API 요청 시 Authorization 헤더로 전달한다.
 */

const ACCESS_TOKEN_KEY = "bredy:accessToken";
const REFRESH_TOKEN_KEY = "bredy:refreshToken";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const isBrowser = () => typeof window !== "undefined";

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTokens(tokens: AuthTokens): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } catch {
    // noop
  }
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // noop
  }
}

export function hasTokens(): boolean {
  return Boolean(getAccessToken() && getRefreshToken());
}
