/**
 * access 토큰(JWT) 만료 판정 — 순수 함수. 앱 src/lib/auth/tokenExpiry.ts 와 같은 사본이다.
 *
 * 서버 withAuth 는 공개 GET(프로필·게시글 상세 등)에서 만료된 토큰을 401 없이 비로그인으로 처리한다.
 * 그래서 401 때만 refresh 하면 30분 뒤부터 isFollowing·isLiked 가 false 로 내려오고, 팔로우한 사람에게
 * '팔로우'가 보여 누르면 토글 API 가 언팔로우했다(2026-10-20 "프로필에서 팔로우가 안 된다").
 * authFetch 는 보내기 전에 이 함수로 확인하고 먼저 refresh 한다.
 * 테스트: __tests__/authFetch.test.ts (앱 npm run test:token-expiry)
 */

/** 만료 이만큼 전부터 미리 갱신한다(기기 시계 오차·요청 왕복 시간). */
export const ACCESS_TOKEN_REFRESH_MARGIN_SECONDS = 60;

/** JWT payload 의 exp(초). 형식이 틀리거나 exp 가 없으면 null. */
export function readTokenExp(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    // atob 결과는 바이트 문자열이라 한글 이름은 깨지지만 exp(숫자)는 그대로 읽힌다.
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** 만료됐거나 곧(margin 안) 만료되면 true. exp 를 못 읽으면 서버 판단에 맡긴다(false). */
export function isAccessTokenExpiring(
  token: string,
  nowMs: number,
  marginSeconds = ACCESS_TOKEN_REFRESH_MARGIN_SECONDS,
): boolean {
  const exp = readTokenExp(token);
  if (exp === null) return false;
  return exp - marginSeconds <= nowMs / 1000;
}
