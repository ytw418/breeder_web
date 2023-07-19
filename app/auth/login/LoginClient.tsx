"use client";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import React, { useEffect } from "react";

import AppleSquare from "@images/AppleSquare.svg";
import GoogleSquare from "@images/GoogleSquare.svg";
import KakaoRound from "@images/KakaoRound.svg";

const LoginClient = () => {
  /**카카오로그인 */
  const loginWithKakao = () => {
    window.Kakao.Auth.authorize({
      redirectUri: process.env.NEXT_PUBLIC_DOMAIN_URL + `/login-loading`,
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
    provider.setCustomParameters({
      prompt: "select_account",
    });
    signInWithPopup(getAuth(), provider)
      .then((result) => {
        console.log("loginWithGoogle :>> ", result);
      })
      .catch((error) => {
        console.log("error :>> ", error);
      });
  };

  const loadScript = (url: string, platform: string) => {
    const handleScript = (e: any) => {
      if (e.type === "load") {
        if (platform === "kakao") {
          window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY);
        } else if (platform === "apple") {
          window.AppleID.auth.init(
            JSON.parse(
              process.env.NEXT_PUBLIC_APPLE_AUTH_CONFIG!.replace(
                /:RTN_URL/gi,
                window.location.host
              )
            )
          );
        } else {
          console.log("error: unknown sdk platform");
        }
      } else if (e.type === "error") {
        console.log(e.error);
      }
    };
    if (window) {
      let script = document.querySelector(`script[src="${url}"]`);
      if (!script) {
        script = document.createElement("script")!;
        script.setAttribute("type", "application/javascript");
        script.setAttribute("src", url);
        document.body.appendChild(script);
        script.addEventListener("load", handleScript);
        script.addEventListener("error", handleScript);
        return script;
      }
      if (script) {
        return null;
      }
    } else return null;
  };

  useEffect(() => {
    loadScript("https://developers.kakao.com/sdk/js/kakao.js", "kakao");
    loadScript(
      "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js",
      "apple"
    );
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex h-auto w-[450px] flex-col items-center justify-center gap-y-4">
        <div
          onClick={() => loginWithKakao()}
          className="relative flex h-[54px] w-[450px] cursor-pointer items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <KakaoRound className="absolute left-7" width={26} height={26} />
          <span className="title-3">{"카카오로 회원가입"}</span>
        </div>
        <div
          onClick={() => loginWithGoogle()}
          className="relative flex h-[54px] w-[450px] cursor-pointer items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <GoogleSquare className="absolute left-7" width={26} height={26} />
          <span className="title-3">{"구글로 회원가입"}</span>
        </div>
        <div
          onClick={() => loginWithApple()}
          className="relative flex h-[54px] w-[450px] cursor-pointer items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <AppleSquare className="absolute left-7" width={26} height={26} />
          <span className="title-3">{"애플로 회원가입"}</span>
        </div>
      </div>
    </div>
  );
};

export default LoginClient;
