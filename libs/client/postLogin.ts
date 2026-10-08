"use client";
/**
 * 로그인 직후 이동(LoginClient·KakaoLogin 공용). 세션이 잡힌 뒤 이동하고, 관심 카테고리를 아직 고르지 않은
 * 계정·브라우저면 한 번 온보딩(/onboarding)을 거친다 — 앱은 설치 후 첫 실행, 웹은 첫 로그인 직후(대응표 O-1).
 */
import { authFetch } from "@libs/client/authFetch";
import { readStoredCategoryScope } from "@libs/client/categoryScope";

export const ONBOARDING_PATH = "/onboarding";

/** 같은 사이트 경로만 허용한다(외부 주소·`//host` 는 홈으로). */
export const getSafeNextPath = (rawPath: string | null | undefined) => {
  if (!rawPath) return "/";
  let normalized = rawPath.trim();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // noop
  }
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return "/";
  return normalized;
};

/**
 * 로그인 뒤 갈 곳. 계정(서버)과 이 브라우저 모두 고정이 없고, 이 브라우저에서 온보딩을 아직 안 봤으면 온보딩을 거친다.
 */
export function resolvePostLoginDestination({
  next,
  serverPinnedIds,
  localPinCount,
  onboarded,
}: {
  next: string;
  serverPinnedIds: readonly number[] | undefined;
  localPinCount: number;
  onboarded: boolean;
}) {
  const target = getSafeNextPath(next);
  if (onboarded || localPinCount > 0 || (serverPinnedIds?.length ?? 0) > 0) return target;
  if (target === ONBOARDING_PATH || target.startsWith(`${ONBOARDING_PATH}?`)) return target;
  return target === "/"
    ? ONBOARDING_PATH
    : `${ONBOARDING_PATH}?next=${encodeURIComponent(target)}`;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

/** 세션(/api/users/me)이 잡힐 때까지 잠깐 기다린 뒤 이동한다. */
export async function navigateAfterSessionReady(nextPath: string) {
  const local = readStoredCategoryScope();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const meRes = await authFetch("/api/users/me", { method: "GET", cache: "no-store" });
      if (meRes.ok) {
        const me = (await meRes.json().catch(() => null)) as {
          profile?: { pinnedCategoryIds?: number[] };
        } | null;
        window.location.assign(
          resolvePostLoginDestination({
            next: nextPath,
            serverPinnedIds: me?.profile?.pinnedCategoryIds,
            localPinCount: local.pins.length,
            onboarded: local.onboarded,
          })
        );
        return;
      }
    } catch {
      // noop
    }
    await wait(100);
  }
  window.location.assign(nextPath);
}
