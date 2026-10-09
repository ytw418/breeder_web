import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./authToken";
import {
  openAccountRestrictedNotice,
  saveAccountRestriction,
  toAccountRestriction,
} from "./accountRestriction";

/**
 * 쓰는 중에 계정이 정지되면 refresh 가 403 ACCOUNT_SUSPENDED/BANNED(사유·해제일)를 준다.
 * 말없이 로그아웃하지 않고 로그인 화면의 이용 제한 안내로 보낸다(앱 docs/prd/admin-moderation.md F-6).
 */
async function handleRestrictedRefresh(res: Response) {
  const restriction = toAccountRestriction(await res.json().catch(() => null));
  if (!restriction || typeof window === "undefined") return;
  saveAccountRestriction(restriction);
  openAccountRestrictedNotice();
}

/**
 * 모든 API 요청에 Bearer access 토큰을 주입하고, 401 응답 시 refresh 토큰으로
 * access 토큰을 1회 재발급한 뒤 원 요청을 재시도하는 fetch 래퍼.
 *
 * 동시에 여러 요청이 401 을 받아도 refresh 는 한 번만 수행되도록 단일 비행
 * (single-flight) 처리한다.
 */

let refreshPromise: Promise<string | null> | null = null;

async function runRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // refresh 토큰이 거절된 경우(만료·정지·차단·탈퇴)만 로그아웃한다.
      // DB 일시 장애 등 5xx 는 토큰을 남겨 다음 요청에서 다시 시도한다.
      if (res.status === 401 || res.status === 403) {
        clearTokens();
      }
      if (res.status === 403) await handleRestrictedRefresh(res);
      return null;
    }

    const data = await res.json().catch(() => null);
    if (data?.accessToken && data?.refreshToken) {
      setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return data.accessToken as string;
    }

    clearTokens();
    return null;
  } catch {
    return null;
  }
}

/** 단일 비행 refresh. 진행 중인 refresh 가 있으면 그 결과를 공유한다. */
function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = runRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function withAuthHeader(init: RequestInit, token: string | null): RequestInit {
  if (!token) return init;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/** 외부 도메인(예: 카카오 OAuth)에는 토큰을 붙이지 않는다. */
function isSameOrigin(input: RequestInfo | URL): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    // 상대 경로는 항상 same-origin
    if (url.startsWith("/")) return true;
    return new URL(url, window.location.origin).origin ===
      window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Bearer 토큰을 자동 주입하는 fetch. 사용처는 표준 fetch 와 동일한 시그니처.
 * 외부 도메인 요청에는 토큰을 주입하지 않는다.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  if (!isSameOrigin(input)) {
    return fetch(input, init);
  }

  const accessToken = getAccessToken();
  const res = await fetch(input, withAuthHeader(init, accessToken));

  // access 토큰 만료(401)면 refresh 후 1회 재시도
  if (res.status === 401 && getRefreshToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return fetch(input, withAuthHeader(init, newToken));
    }
  }

  return res;
}
