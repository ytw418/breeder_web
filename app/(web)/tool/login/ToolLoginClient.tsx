"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import KakaoRound from "@images/KakaoRound.svg";

declare global {
  interface Window {
    Kakao: any;
  }
}

const getKakaoRedirectUri = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/login-loading`;
  }
  return `${process.env.NEXT_PUBLIC_DOMAIN_URL || ""}/login-loading`;
};

const getSafeToolNextPath = (rawPath: string | null) => {
  if (!rawPath) return "/tool/auctions/create";
  let normalized = rawPath.trim();

  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // noop
  }

  if (!normalized.startsWith("/tool") || normalized.startsWith("//")) {
    return "/tool/auctions/create";
  }

  return normalized;
};

const ToolLoginClient = () => {
  const searchParams = useSearchParams();
  const [isKakaoReady, setIsKakaoReady] = useState(false);
  const [isStartingLogin, setIsStartingLogin] = useState(false);
  const nextPath = useMemo(
    () => getSafeToolNextPath(searchParams?.get("next") ?? null),
    [searchParams]
  );

  const loginWithKakao = () => {
    if (isStartingLogin) return;
    if (typeof window === "undefined") return;
    if (!window.Kakao) return;

    setIsStartingLogin(true);
    window.Kakao.Auth.authorize({
      redirectUri: getKakaoRedirectUri(),
      prompt: "select_account",
      throughTalk: false,
      state: encodeURIComponent(nextPath),
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initKakao = () => {
      if (!window.Kakao) return;
      if (!window.Kakao.isInitialized?.()) {
        window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY);
      }
      setIsKakaoReady(true);
    };

    const scriptUrl = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
    if (existingScript) {
      initKakao();
      return;
    }

    const script = document.createElement("script");
    script.type = "application/javascript";
    script.src = scriptUrl;
    script.integrity =
      "sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4";
    script.crossOrigin = "anonymous";
    script.onload = () => initKakao();
    script.onerror = () => setIsKakaoReady(false);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!isKakaoReady) return;
    if (isStartingLogin) return;
    loginWithKakao();
  }, [isKakaoReady, isStartingLogin]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Auction Tool
        </p>
        <h1 className="mt-2 text-xl font-extrabold text-slate-900">카카오 로그인</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          경매 등록 도구 이용을 위해 카카오 로그인으로 자동 이동합니다.
        </p>

        <button
          type="button"
          onClick={loginWithKakao}
          disabled={isStartingLogin}
          className="mt-4 relative flex h-[52px] w-full items-center justify-center rounded-lg border border-[#e9cf00] bg-[#FAE100] px-7"
        >
          <KakaoRound className="absolute left-5" width={24} height={24} />
          <span className="text-sm font-bold text-[#191919]">
            {isStartingLogin ? "로그인 페이지로 이동 중..." : "카카오로 계속하기"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ToolLoginClient;
