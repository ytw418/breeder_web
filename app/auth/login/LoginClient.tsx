"use client";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import React, { useEffect } from "react";

import AppleSquare from "@images/AppleSquare.svg";
import GoogleSquare from "@images/GoogleSquare.svg";
import KakaoRound from "@images/KakaoRound.svg";
import KakaoLogin from "@icons/kakaoLogin.svg";
import Link from "next/link";
import { LoginReqBody, LoginResponseType } from "pages/api/auth/login";
import useMutation from "@libs/client/useMutation";
import { USER_INFO } from "@libs/constants";
import { useRouter } from "next/navigation";

const LoginClient = () => {
  const [login] = useMutation<LoginResponseType>("/api/auth/login");
  const router = useRouter();

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
            router.replace("/");
          } else {
            router.replace("/auth/login");
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
    <div className="flex h-screen w-full items-center justify-center p-5 flex-col">
      <div className="flex flex-col items-center mb-[80px]">
        <h1 className="title-10 text-Primary">브리더</h1>
        <span className="body-3">곤충생활은 브리더에서</span>
        <span className="body-3">
          생물인들과 소통하고 브리더에서 안전거래하세요
        </span>
      </div>
      <div className="flex h-auto w-full flex-col items-center justify-center gap-y-4">
        <button
          onClick={() => loginWithKakao()}
          className="button relative flex h-[54px] w-full items-center bg-[#FAE100] justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          {/* <KakaoRound className="absolute left-7" width={26} height={26} /> */}
          <KakaoLogin className="absolute left-7" width={26} height={26} />
          <span className="title-3">{"카카오로 계속하기"}</span>
        </button>
        <Link
          href={"/"}
          className="button relative flex h-[54px] w-full items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <span className="title-3">{"서비스 둘러보기"}</span>
        </Link>
        <div
          onClick={() => loginWithGoogle()}
          className="relative flex h-[54px] w-full cursor-pointer items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <GoogleSquare className="absolute left-7" width={26} height={26} />
          <span className="title-3">{"구글로 회원가입"}</span>
        </div>
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
          서비스 이용시 브리더의{" "}
          <Link
            target="_blank"
            className="text-Primary"
            href={
              "https://breeder.notion.site/8a2ca657b9a047498c95ab42ce3d2b75"
            }
          >
            이용약관
          </Link>{" "}
          및{" "}
          <Link
            target="_blank"
            className="text-Primary"
            href={
              "https://breeder.notion.site/be44680c8d5b43848d0aff25c7c2edba"
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
