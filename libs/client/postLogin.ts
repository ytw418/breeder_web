"use client";
/**
 * 로그인 직후 이동(LoginClient·KakaoLogin 공용). 세션이 잡힌 뒤 이동하고, 관심 카테고리를 아직 고르지 않은
 * 계정·브라우저면 한 번 온보딩(/onboarding)을 거친다 — 앱은 설치 후 첫 실행, 웹은 첫 로그인 직후와
 * 홈 첫 방문 팝업(CategoryOnboardingPrompt, 비로그인 포함 — 대응표 O-1).
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

interface CategoryOnboardingRecord {
  serverPinnedIds: readonly number[] | undefined;
  /** 계정 categoryOnboardedAt 이 있다. */
  serverOnboarded?: boolean;
  localPinCount: number;
  onboarded: boolean;
}

/**
 * 관심 카테고리를 한 번도 고른 적이 없는지. 계정이 온보딩을 마쳤거나(앱에서 '전체 보기'를 고른 것 포함)
 * 계정·브라우저에 고정이 있거나 이 브라우저에서 이미 봤으면 false. 로그인 직후 이동과 홈 팝업이 같이 쓴다.
 */
export function needsCategoryOnboarding({
  serverPinnedIds,
  serverOnboarded = false,
  localPinCount,
  onboarded,
}: CategoryOnboardingRecord) {
  return !(serverOnboarded || onboarded || localPinCount > 0 || (serverPinnedIds?.length ?? 0) > 0);
}

/** 로그인 뒤 갈 곳. 관심 카테고리를 고른 적이 있으면 바로 가고, 아니면 온보딩을 거친다. */
export function resolvePostLoginDestination({ next, ...record }: CategoryOnboardingRecord & { next: string }) {
  const target = getSafeNextPath(next);
  if (!needsCategoryOnboarding(record)) return target;
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
          profile?: { pinnedCategoryIds?: number[]; categoryOnboardedAt?: string | null };
        } | null;
        window.location.assign(
          resolvePostLoginDestination({
            next: nextPath,
            serverPinnedIds: me?.profile?.pinnedCategoryIds,
            serverOnboarded: Boolean(me?.profile?.categoryOnboardedAt),
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
