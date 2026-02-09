"use client";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import React, { useEffect } from "react";

import AppleSquare from "@images/AppleSquare.svg";
import GoogleSquare from "@images/GoogleSquare.svg";
import KakaoRound from "@images/KakaoRound.svg";

import Link from "next/link";
import { LoginReqBody, LoginResponseType } from "pages/api/auth/login";
import useMutation from "hooks/useMutation";
import { USER_INFO } from "@libs/constants";
import { useRouter } from "next/navigation";

const LoginClient = () => {
  const [login] = useMutation<LoginResponseType>("/api/auth/login");
  const router = useRouter();

  // 배포 환경에서 APPLE 설정이 없거나 JSON 형식이 깨져도
  // 로그인 페이지가 런타임 에러로 죽지 않도록 방어한다.
  const getAppleAuthConfig = () => {
    const rawConfig = process.env.NEXT_PUBLIC_APPLE_AUTH_CONFIG;
    if (!rawConfig) return null;
    try {
      return JSON.parse(rawConfig.replace(/:RTN_URL/gi, window.location.host));
    } catch (error) {
      console.error("Invalid NEXT_PUBLIC_APPLE_AUTH_CONFIG:", error);
      return null;
    }
  };

  /**카카오로그인 */
  const loginWithKakao = () => {
    window.Kakao.Auth.authorize({
      redirectUri: process.env.NEXT_PUBLIC_DOMAIN_URL + `/login-loading`,
      prompt: "select_account",
      throughTalk: false,
    });
  };
  /**애플로그인 */
  const loginWithApple = async () => {
    const data = await window.AppleID.auth.signIn();
    console.log("window.AppleID.auth.signIn(); :>> ", data);
  };
  /**구글로그인 */
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    provider.setCustomParameters({
      prompt: "select_account",
    });
    const googleUser = await signInWithPopup(getAuth(), provider).catch(
      (error) => {
        console.log("error :>> ", error);
      }
    );

    console.log("googleUser :>> ", googleUser);

    if (googleUser) {
      const body: LoginReqBody = {
        snsId: googleUser.user.uid,
        name: googleUser.user.displayName ?? "구글로그인 닉네임 없음",
        provider: USER_INFO.provider.GOOGLE,
        email: googleUser.user.email,
        avatar: googleUser.user.photoURL ?? "",
      };
      login({
        data: body,
        onCompleted(result) {
          console.log("result :>> ", result);
          if (result.success) {
            router.push("/");
            router.refresh();
          } else {
            router.push("/auth/login");
            alert(`로그인에 실패했습니다:${result.error}`);
          }
        },
        onError(error) {
          router.replace("/auth/login");
          alert(error);
        },
      });
    }
  };

  const loadScript = (url: string, platform: string) => {
    const handleScript = (e: any) => {
      if (e.type === "load") {
        if (platform === "kakao") {
          // Fast Refresh 시 중복 init 경고를 막기 위해 최초 1회만 초기화한다.
          if (window.Kakao && !window.Kakao.isInitialized?.()) {
            window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY);
          }
        } else if (platform === "apple") {
          const appleConfig = getAppleAuthConfig();
          if (!appleConfig) {
            // 애플 설정이 없으면 기능만 비활성화하고 페이지는 계속 동작시킨다.
            console.warn("Apple login config is missing. Skipping Apple SDK init.");
            return;
          }
          if (window.AppleID?.auth) {
            window.AppleID.auth.init(appleConfig);
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
        if (platform === "apple" && window.AppleID?.auth) {
          const appleConfig = getAppleAuthConfig();
          if (appleConfig) {
            window.AppleID.auth.init(appleConfig);
          }
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
    loadScript(
      "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js",
      "apple"
    );
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center p-5 flex-col">
      <div className="flex flex-col items-center mb-[80px]">
        <h1 className="title-10 text-Primary">브리디</h1>
        <span className="body-3">곤충생활은 브리디에서</span>
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
        <div
          onClick={() => loginWithGoogle()}
          className="relative flex h-[54px] w-full cursor-pointer items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <GoogleSquare className="absolute left-7" width={26} height={26} />
          <span className="title-3">{"구글로 회원가입"}</span>
        </div>
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
