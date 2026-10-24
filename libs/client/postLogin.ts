"use client";
/**
 * 로그인 직후 이동(LoginClient·KakaoLogin 공용). 세션이 잡힌 뒤 이동하고, 관심 카테고리를 아직 고르지 않은
 * 계정·브라우저면 한 번 온보딩(/onboarding)을 거친다 — 앱은 설치 후 첫 실행, 웹은 첫 로그인 직후와
 * 홈 첫 방문 팝업(CategoryOnboardingPrompt, 비로그인 포함 — 대응표 O-1).
 */
import { authFetch } from "@libs/client/authFetch";
import { readStoredCategoryScope } from "@libs/client/categoryScope";

export const ONBOARDING_PATH = "/onboarding";
/** 가입 직후 '시작하기'(이름·사진·동네·팔로우 추천·첫 인사 글, 2026-10-21 감사 19번). 다 보면 next 로 간다. */
export const WELCOME_PATH = "/welcome";

/** 새 계정이면 시작하기를 거쳐 next 로 가는 주소. */
export const toWelcomePath = (next: string) => {
  const target = getSafeNextPath(next);
  return target === "/" ? WELCOME_PATH : `${WELCOME_PATH}?next=${encodeURIComponent(target)}`;
};

/** 같은 사이트 경로만 허용한다(외부 주소·`//host` 는 홈으로). */
export const getSafeNextPath = (rawPath: string | null | undefined) => {
  if (!rawPath) return "/";
  let normalized = rawPath.trim();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // noop
  }
  // `/\evil.com` 은 브라우저가 `//evil.com` 으로 읽어 외부로 나간다 — 역슬래시·제어 문자가 있으면 홈으로.
  if (!normalized.startsWith("/") || normalized.startsWith("//") || /[\\\u0000-\u001f]/.test(normalized)) return "/";
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

/**
 * 홈 첫 방문 팝업을 띄울지(2026-10-24 사용자 "로컬스토리지에도 계정에도 데이터가 없으면 떠야").
 * 고른 분야(고정)가 브라우저·계정 어디에도 없으면 띄운다 — 예전에 '건너뛰기'로 닫아 onboarded 만 남은 경우도 다시 묻는다.
 * 같은 방문(탭) 안에서 닫았으면 다시 띄우지 않는다(홈에 올 때마다 뜨지 않게).
 */
export function needsHomeCategoryPrompt({
  serverPinnedIds,
  localPinCount,
  dismissedThisVisit,
}: {
  serverPinnedIds: readonly number[] | undefined;
  localPinCount: number;
  dismissedThisVisit: boolean;
}) {
  return !dismissedThisVisit && localPinCount === 0 && (serverPinnedIds?.length ?? 0) === 0;
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

/**
 * 세션(/api/users/me)이 잡힐 때까지 잠깐 기다린 뒤 이동한다.
 * 새 계정(로그인 응답 isNewUser)이면 시작하기를 거친다. 관심 카테고리 온보딩이 필요하면 그게 먼저다.
 */
export async function navigateAfterSessionReady(
  rawNextPath: string,
  options: { isNewUser?: boolean } = {}
) {
  const nextPath = options.isNewUser ? toWelcomePath(rawNextPath) : rawNextPath;
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
