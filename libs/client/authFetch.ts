import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./authToken";

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
      clearTokens();
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
