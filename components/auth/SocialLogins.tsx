"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import Button from "@components/atoms/Button";

import AppleRound from "@images/AppleRound.svg";
import AppleSquare from "@images/AppleSquare.svg";
import GoogleRound from "@images/GoogleRound.svg";
import GoogleSquare from "@images/GoogleSquare.svg";
import KakaoRound from "@images/KakaoRound.svg";

import { RestfulResult, useAuth } from "@libs/client/AuthProvider";
import useApiMutation from "@libs/client/useApiMutation";
import { useVariousData } from "@libs/client/VariousProvider";
import { Role } from "@libs/constants";

export const SocialLogins = ({
  isDefault = false,
  isSignUp = false,
  isExistingUser = false,
}: {
  isDefault?: boolean;
  isSignUp?: boolean;
  isExistingUser?: boolean;
}) => {
  const { googleLogin, _login, user, setUser } = useAuth();
  const { openModal, setOpenModal, setModalContent } = useVariousData();
  const router = useRouter();
  const [appleLogin, { loading: aLoading, data: aData, error: aError }] =
    useApiMutation<RestfulResult>("/api/auth/apple/callback/");
  const searchParams = useSearchParams();

  const snsRecord = searchParams?.get("sns");

  const loginWithKakao = () => {
    window.Kakao.Auth.authorize({
      redirectUri: process.env.NEXT_PUBLIC_DOMAIN_URL + `/kr/login-loading`,
    });
  };

  const loginWithGoogle = async () => {
    const googleUser = await googleLogin().catch((err) => {
      console.log(err?.message ?? "");
    });
    if (googleUser) {
      _login(googleUser, "GOOGLE");
    }
  };

  const loginWithApple = async () => {
    try {
      const data = await window.AppleID.auth.signIn();
      // Handle successful response.
      appleLogin(JSON.stringify(data), "", undefined, (result: any) => {
        if (result?.success) {
          setUser(...user, { email: result.email });
          if (user.role === Role.PUBLISHER) {
            router.push(`/${lng}/publisher/`);
            return;
          } else if (user.role === Role.PLINIST) {
            router.push(`/${lng}/creator/`);
            return;
          } else if (user.role === Role.USER) {
            router.push(`/${lng}/auth/sign-up/creator/`);
            return;
          } else {
            return;
          }
        } else if (!result.success && result.message) {
          switch (result.message) {
            case "PLINST REVIEW":
              setModalContent(
                <div className="flex w-[525px] flex-col items-start justify-center px-12">
                  <span className="title-8 pb-6">
                    {t("크리에이터 활동을 위한 심사중이에요.")}
                  </span>
                  <div className="body-5 pb-8 text-Gray-600">
                    {t(
                      "심사 승인은 영업일 기준 최대 1~5일 소요될 예정입니다.\n승인이 완료되면 등록하신 휴대번호로 자세한 내용을 보내드릴게요."
                    )}
                  </div>
                  <Button
                    type="squareDefault"
                    clickAction={() => setOpenModal(false)}
                    text={t("확인")}
                    size="large"
                    widthFull
                  />
                </div>
              );
              setOpenModal(true);
              break;
            case "PUBLISHER REVIEW":
              setModalContent(
                <div className="flex w-[525px] flex-col items-start justify-center px-12">
                  <span className="title-8 pb-6">
                    {t("퍼블리셔 활동을 위한 심사중이에요.")}
                  </span>
                  <div className="body-5 pb-8 text-Gray-600">
                    {t(
                      "심사 승인은 영업일 기준 최대 1~5일 소요될 예정입니다.\n승인이 완료되면 등록하신 휴대번호로 자세한 내용을 보내드릴게요."
                    )}
                  </div>
                  <Button
                    type="squareDefault"
                    clickAction={() => setOpenModal(false)}
                    text={t("확인")}
                    size="large"
                    widthFull
                  />
                </div>
              );
              setOpenModal(true);
              break;
            case "GOOGLE USER":
              alert("구글 계정 존재");
              break;
            case "KAKAO USER":
              alert("카카오 계정 존재");
              break;
            default:
              alert(result.message);
          }
        } else {
          alert(
            result?.error ||
              "애플 계정로그인에 실패하였습니다\n문제가 지속될 경우 고객센터에 문의주세요!"
          );
        }
      });
    } catch (error: any) {
      console.log(error?.message ?? "");
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

  const toNewSignUp = () => {
    router.push(`/${lng}/auth/login/sns`);
  };

  const loginExistingUser = () => {
    if (snsRecord === "KAKAO") {
      console.log("kakao clicked");
      loginWithKakao();
      return;
    } else if (snsRecord === "GOOGLE") {
      loginWithGoogle();
      return;
    } else if (snsRecord === "APPLE") {
      loginWithApple();
      return;
    }
  };

  return (
    <div className="flex h-auto w-full items-center justify-center">
      {isDefault && (
        <div className="SNS_ICONS flex h-auto w-full justify-center gap-x-9">
          <KakaoRound
            onClick={() => loginWithKakao()}
            className="cursor-pointer"
            width={40}
            height={40}
          />
          <GoogleRound
            onClick={() => loginWithGoogle()}
            className="cursor-pointer"
            width={40}
            height={40}
          />
          <AppleRound
            onClick={() => loginWithApple()}
            className="cursor-pointer"
            width={40}
            height={40}
          />
        </div>
      )}
      {isExistingUser && (
        <div className="flex w-full flex-col items-center justify-center text-center">
          <div className="title-8 pb-4 leading-9">
            {snsRecord === "KAKAO" && t("'카카오 간편 회원가입'으로")}
            {snsRecord === "APPLE" && t("'애플 간편 회원가입'으로")}
            {snsRecord === "GOOGLE" && t("'구글 간편 회원가입'으로")}
            <br />
            {t("이미 가입한 계정이 있습니다.")}
          </div>
          <span className="body-5 pb-12">{user.email}</span>
          <div className="flex w-full justify-center gap-x-[10px]">
            <Button
              text={t("다른 방식으로 가입")}
              type={"squareBorder"}
              size="large"
              clickAction={toNewSignUp}
            />
            <Button
              text={t("기존 계정 로그인")}
              type={"squareDefault"}
              size="large"
              clickAction={loginExistingUser}
            />
          </div>
        </div>
      )}
      {isSignUp && (
        <div className="flex h-auto w-[450px] flex-col items-center justify-center gap-y-4">
          <div
            onClick={() => loginWithKakao()}
            className="relative flex h-[54px] w-[450px] cursor-pointer items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
          >
            <KakaoRound
              onClick={() => loginWithKakao()}
              className="absolute left-7"
              width={26}
              height={26}
            />
            <span className="title-3">{t("카카오로 회원가입")}</span>
          </div>
          <div
            onClick={() => loginWithGoogle()}
            className="relative flex h-[54px] w-[450px] cursor-pointer items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
          >
            <GoogleSquare className="absolute left-7" width={26} height={26} />
            <span className="title-3">{t("구글로 회원가입")}</span>
          </div>
          <div
            onClick={() => loginWithApple()}
            className="relative flex h-[54px] w-[450px] cursor-pointer items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
          >
            <AppleSquare className="absolute left-7" width={26} height={26} />
            <span className="title-3">{t("애플로 회원가입")}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialLogins;
