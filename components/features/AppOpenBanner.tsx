"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * 모바일 브라우저 상세(글·분양글·경매·프로필) 맨 위 '브리디 앱에서 보기' 띠(2026-10-21 커뮤니티 감사 18번, 당근 관습).
 * 48 띠: 앱 아이콘 28 · '브리디 앱에서 보기' 14/600 · '열기'(32, 주황 채움) · 닫기 X.
 * - 모바일(Android·iPhone) 브라우저에서만 보인다. PC·앱 안(UA `BredyApp/`)·설치한 PWA 에서는 없다.
 * - X 를 누르면 7일 동안 숨긴다(localStorage).
 * - '열기': Android 는 intent:// 로 앱을 열고 없으면 /download, iOS 는 bredy:// 를 열어 보고 1.5초 안에 화면을
 *   떠나지 않으면 /download 로 간다. 앱이 받은 주소는 앱 src/app/+native-intent.ts 가 거른다.
 * 서버 HTML·첫 렌더에는 그리지 않는다(기기 판별은 브라우저에서만 된다).
 * Parity: web-only(앱 설치 유도). 앱 쪽 짝은 앱 링크 설정(bredy_app app.config.js withAppLinks).
 */

const DISMISS_KEY = "bredy:appOpenBanner:dismissedAt";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const OPEN_FALLBACK_MS = 1500;
const APP_SCHEME = "bredy";
const ANDROID_PACKAGE = "app.bredy.mobile";
const DOWNLOAD_PATH = "/download";

type MobilePlatform = "android" | "ios";

/** 띠를 띄울 모바일 브라우저면 그 플랫폼, 아니면 null(PC·앱 안). */
export function appOpenBannerPlatform(userAgent: string): MobilePlatform | null {
  if (/BredyApp\//i.test(userAgent)) return null;
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPod/i.test(userAgent)) return "ios";
  return null;
}

/** '/posts/12?x=1' → 앱을 여는 주소. */
export function appOpenUrl(pathWithQuery: string, platform: MobilePlatform, origin: string): string {
  const path = pathWithQuery.replace(/^\/+/, "");
  if (platform === "ios") return `${APP_SCHEME}://${path}`;
  const fallback = encodeURIComponent(`${origin}${DOWNLOAD_PATH}`);
  return `intent://${path}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

function readDismissedAt(): number {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY)) || 0;
  } catch {
    return 0;
  }
}

export default function AppOpenBanner() {
  const router = useRouter();
  const [platform, setPlatform] = useState<MobilePlatform | null>(null);

  useEffect(() => {
    const detected = appOpenBannerPlatform(window.navigator.userAgent);
    if (!detected) return;
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;
    if (Date.now() - readDismissedAt() < DISMISS_MS) return;
    setPlatform(detected);
  }, []);

  if (!platform) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // 저장이 막혀 있으면 이번 화면에서만 숨긴다.
    }
    setPlatform(null);
  };

  const open = () => {
    const url = appOpenUrl(
      `${window.location.pathname}${window.location.search}`,
      platform,
      window.location.origin
    );
    if (platform === "android") {
      // Chrome 은 앱이 없으면 browser_fallback_url(/download)로 간다.
      window.location.href = url;
      return;
    }
    let left = false;
    const markLeft = () => {
      if (document.visibilityState === "hidden") left = true;
    };
    document.addEventListener("visibilitychange", markLeft);
    window.addEventListener("pagehide", markLeft);
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", markLeft);
      window.removeEventListener("pagehide", markLeft);
      if (!left && document.visibilityState === "visible") router.push(DOWNLOAD_PATH);
    }, OPEN_FALLBACK_MS);
    window.location.href = url;
  };

  return (
    <div className="border-b border-app-line bg-app-bg" data-testid="app-open-banner">
      <div className="mx-auto flex h-12 max-w-xl items-center gap-2.5 pl-4 pr-1.5">
        <Image
          src="/images/pwa/icon-192.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-md"
        />
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-5 text-app-text">
          브리디 앱에서 보기
        </p>
        <button
          type="button"
          onClick={open}
          className="h-8 shrink-0 rounded-md bg-app-brand px-3.5 text-[14px] font-semibold text-white"
        >
          열기
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="앱에서 보기 닫기"
          className="flex h-9 w-9 shrink-0 items-center justify-center text-app-muted"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
