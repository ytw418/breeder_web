"use client";
import React, { useEffect } from "react";

import KakaoRound from "@images/KakaoRound.svg";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const getSafeNextPath = (rawPath: string | null) => {
  if (!rawPath) return "/";
  let normalized = rawPath.trim();

  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // noop
  }

  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return "/";
  }

  return normalized;
};

const LoginClient = () => {
  const searchParams = useSearchParams();

  /**카카오로그인 */
  const loginWithKakao = () => {
    const nextPath = getSafeNextPath(searchParams?.get("next") ?? null);
    window.Kakao.Auth.authorize({
      redirectUri: process.env.NEXT_PUBLIC_DOMAIN_URL + `/login-loading`,
      prompt: "select_account",
      throughTalk: false,
      state: encodeURIComponent(nextPath),
    });
  };

  const loadScript = (url: string, platform: string) => {
    const handleScript = (e: any) => {
      if (e.type === "load") {
        if (platform === "kakao") {
          // Fast Refresh 시 중복 init 경고를 막기 위해 최초 1회만 초기화한다.
          if (window.Kakao && !window.Kakao.isInitialized?.()) {
            window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY);
          }
        } else {
          console.log("error: unknown sdk platform");
        }
      } else if (e.type === "error") {
        console.log(e.error);
      }
    };
    if (typeof window !== "undefined") {
      let script = document.querySelector(`script[src="${url}"]`);
      if (!script) {
        script = document.createElement("script")!;
        script.setAttribute("type", "application/javascript");
        script.setAttribute("src", url);

        if (platform === "kakao") {
          script.setAttribute(
            "integrity",
            "sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4"
          );
          script.setAttribute("crossorigin", "anonymous");
        }

        document.body.appendChild(script);
        script.addEventListener("load", handleScript);
        script.addEventListener("error", handleScript);
        return script;
      }
      if (script) {
        // 이미 스크립트가 존재하는 경우(HMR/뒤로가기 등)도 SDK 초기화 상태를 맞춰준다.
        if (platform === "kakao" && window.Kakao && !window.Kakao.isInitialized?.()) {
          window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY);
        }
        return null;
      }
    } else return null;
  };

  useEffect(() => {
    loadScript(
      "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js",
      "kakao"
    );
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center p-5 flex-col">
      <div className="flex flex-col items-center mb-[80px]">
        <h1 className="title-10 text-Primary">브리디</h1>
        <span className="body-3">애완동물 서비스는 브리디에서</span>
        <span className="body-3">
          생물인들과 소통하고 브리디에서 안전거래하세요
        </span>
      </div>
      <div className="flex h-auto w-full flex-col items-center justify-center gap-y-4">
        <button
          onClick={() => loginWithKakao()}
          className="button relative flex h-[54px] w-full items-center bg-[#FAE100] justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <KakaoRound className="absolute left-7" width={26} height={26} />
          {/* <KakaoLogin className="absolute left-7" width={26} height={26} /> */}
          <span className="title-3">{"카카오로 계속하기"}</span>
        </button>
        <p className="mt-1 text-[11px] text-Gray-500">
          현재 경매 참여 계정은 카카오 로그인만 지원합니다.
        </p>
        <Link
          href={"/"}
          className="button relative flex h-[54px] w-full items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <span className="title-3">{"서비스 둘러보기"}</span>
        </Link>
        {/* <div
          onClick={() => loginWithApple()}
          className="relative flex h-[54px] w-full cursor-pointer items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <AppleSquare className="absolute left-7" width={26} height={26} />
          <span className="title-3">{"애플로 회원가입"}</span>
        </div> */}
      </div>
      <div className="border-t-[1px] border-Gray-300 w-full mt-[100px] mb-2">
        {" "}
      </div>
      <div className="body-1 text-Gray-400">
        <span>
          서비스 이용시 브리디의{" "}
          <Link
            target="_blank"
            className="text-Primary"
            href={
              "https://bredy.notion.site/8a2ca657b9a047498c95ab42ce3d2b75"
            }
          >
            이용약관
          </Link>{" "}
          및{" "}
          <Link
            target="_blank"
            className="text-Primary"
            href={
              "https://bredy.notion.site/be44680c8d5b43848d0aff25c7c2edba"
            }
          >
            개인정보처리동의서
          </Link>{" "}
          동의로 간주합니다.
        </span>
      </div>
    </div>
  );
};

export default LoginClient;
