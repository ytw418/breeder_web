"use client";
import { useEffect } from "react";

import KakaoRound from "@images/KakaoRound.svg";
import GoogleRound from "@images/GoogleRound.svg";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useMutation from "hooks/useMutation";
import { LoginReqBody, LoginResponseType } from "pages/api/auth/login";
import {
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
  USER_INFO,
} from "@libs/constants";

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

const getKakaoRedirectUri = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/login-loading`;
  }
  return `${process.env.NEXT_PUBLIC_DOMAIN_URL || ""}/login-loading`;
};

const markPostLoginGuide = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("bredy:show-post-login-guide", "1");
  } catch {
    // noop
  }
};

const LoginClient = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login] = useMutation<LoginResponseType>("/api/auth/login");
  // 기본값은 노출(true). 추후 숨길 때 NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=false로 설정.
  const shouldShowGoogleLogin =
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN !== "false";
  const isVercelPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";

  /**카카오로그인 */
  const loginWithKakao = () => {
    const nextPath = getSafeNextPath(searchParams?.get("next") ?? null);
    window.Kakao.Auth.authorize({
      redirectUri: getKakaoRedirectUri(),
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

  const loginWithPreviewTestUser = () => {
    const nextPath = getSafeNextPath(searchParams?.get("next") ?? null);

    const body: LoginReqBody = {
      snsId: "vercel-preview-test-user",
      name: "프리뷰 테스트 유저",
      provider: USER_INFO.provider.KAKAO,
      email: "preview-test-user@bredy.app",
      avatar:
        "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=200&q=80",
    };

    login({
      data: body,
      onCompleted(result) {
        if (result.success) {
          markPostLoginGuide();
          router.replace(nextPath);
          return;
        }
        alert(`테스트 로그인에 실패했습니다:${result.error}`);
      },
      onError(error) {
        alert(error);
      },
    });
  };

  const loginWithGoogle = async () => {
    try {
      const nextPath = getSafeNextPath(searchParams?.get("next") ?? null);
      const [{ getAuth, GoogleAuthProvider, signInWithPopup }, { app }] =
        await Promise.all([import("firebase/auth"), import("@/firebase")]);

      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const { user } = await signInWithPopup(auth, provider);

      if (!user?.uid) {
        throw new Error("google-user-not-found");
      }

      const body: LoginReqBody = {
        snsId: user.uid,
        name: user.displayName || user.email?.split("@")[0] || "Google User",
        provider: USER_INFO.provider.GOOGLE,
        email: user.email,
        avatar: user.photoURL || undefined,
      };

      login({
        data: body,
        onCompleted(result) {
          if (result.success) {
            markPostLoginGuide();
            router.replace(nextPath);
            return;
          }
          alert(`로그인에 실패했습니다:${result.error}`);
        },
        onError(error) {
          alert(error);
        },
      });
    } catch (error) {
      console.error(error);
      alert("구글 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

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
        {shouldShowGoogleLogin ? (
          <button
            onClick={() => loginWithGoogle()}
            className="button relative flex h-[54px] w-full items-center justify-center rounded-lg border border-Gray-300 bg-white px-7 py-[14px]"
          >
            <GoogleRound className="absolute left-7" width={26} height={26} />
            <span className="title-3">{"구글로 계속하기"}</span>
          </button>
        ) : (
          <p className="mt-1 text-[11px] text-Gray-500">
            현재는 카카오 로그인만 지원합니다.
          </p>
        )}
        {isVercelPreview ? (
          <button
            onClick={loginWithPreviewTestUser}
            className="button relative flex h-[54px] w-full items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-7 py-[14px]"
          >
            <span className="title-3 text-amber-900">{"프리뷰 테스트 유저로 로그인"}</span>
          </button>
        ) : null}
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
            href={TERMS_OF_SERVICE_URL}
          >
            이용약관
          </Link>{" "}
          및{" "}
          <Link
            target="_blank"
            className="text-Primary"
            href={PRIVACY_POLICY_URL}
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
