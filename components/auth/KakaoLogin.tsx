"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import useMutation from "hooks/useMutation";
import { LoginReqBody, LoginResponseType } from "pages/api/auth/login";
import { USER_INFO } from "@libs/constants";
import { Spinner } from "@components/atoms/Spinner";
import { hasTokens, setTokens } from "@libs/client/authToken";
import { toast } from "@libs/client/toast";
import { getSafeNextPath, navigateAfterSessionReady } from "@libs/client/postLogin";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import {
  ACCOUNT_RESTRICTED_LOGIN_PATH,
  saveAccountRestriction,
  toAccountRestriction,
} from "@libs/client/accountRestriction";

const getKakaoRedirectUri = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/login-loading`;
  }
  return `${process.env.NEXT_PUBLIC_DOMAIN_URL || ""}/login-loading`;
};

const KAKAO_LOGIN_FAILED = "카카오 로그인에 실패했어요. 다시 시도해 주세요";

/** 로그인 실패 기록(LoginClient·앱 login_failed 와 같은 이름). */
const trackKakaoLoginFailed = (reason: unknown) =>
  trackEvent(ANALYTICS_EVENTS.loginFailed, {
    method: "kakao",
    reason: String(reason instanceof Error ? reason.message : reason ?? "unknown").slice(0, 120),
  });

const markPostLoginGuide = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("bredy:show-post-login-guide", "1");
  } catch {
    // noop
  }
};

export const KakaoLogin = () => {
  const searchParams = useSearchParams()!;
  const router = useRouter();
  const [kakaoAuth, { data }] = useMutation("https://kauth.kakao.com");
  const [login] = useMutation<LoginResponseType>("/api/auth/login");

  useEffect(() => {
    if (searchParams.get("code")) {
      const redirectUri = getKakaoRedirectUri();
      kakaoAuth({
        data: encodeURI(
          `grant_type=authorization_code&client_id=${
            process.env.NEXT_PUBLIC_KAKAO_API_KEY
          }&code=${searchParams.get("code")}&redirect_uri=${redirectUri}`
        ),
        endpoint: "/oauth/token",
        contentType: "application/x-www-form-urlencoded;charset=utf-8",
      });
      return;
    } else if (searchParams.get("error")) {
      alert(`카카오 로그인에 오류가 생겼습니다. 다시 시도해주세요
      - ${searchParams.get("error")}
      - ${searchParams.get("error_description")}
      `);
      console.log(searchParams.get("error"));
      console.log(searchParams.get("error_description"));
      router.back();
      return;
    }
    return;
  }, []);

  useEffect(() => {
    // alert(`${data}`);

    if (data?.error) {
      // 인가 코드 교환 실패. 로그인 직후 뒤로 가기로 이 화면에 다시 오면 이미 쓴 코드라 카카오가 invalid_grant 를
      // 돌려준다 — 예전엔 여기서 스피너만 돌았다(2026-10-11 제보 '지역 설정 후 무한 로딩').
      if (hasTokens()) {
        router.replace("/");
        return;
      }
      trackKakaoLoginFailed(data.error_description || data.error);
      toast.error(KAKAO_LOGIN_FAILED);
      router.replace("/auth/login");
      return;
    }

    if (data && !data.error) {
      loginWithKakao();
      return;
    }
  }, [data]);

  const loginWithKakao = async () => {
    const userData = await fetch("https://kapi.kakao.com/v2/user/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${data.access_token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => data)
      .catch((err) => console.log(err));

    if (userData.id) {
      const {
        id,
        kakao_account: {
          email,
          profile: { is_default_image, nickname, thumbnail_image_url },
        },
      } = userData;


      const body: LoginReqBody = {
        token: data.access_token,
        snsId: id.toString(),
        name: nickname,
        provider: USER_INFO.provider.KAKAO,
        email: email,
        avatar: thumbnail_image_url,
      };
      login({
        data: body,
        onCompleted(result) {
          if (result.success) {
            if (result.accessToken && result.refreshToken) {
              setTokens({
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
              });
            }
            markPostLoginGuide();
            const redirectPath = getSafeNextPath(
              searchParams.get("state") || searchParams.get("next")
            );
            void navigateAfterSessionReady(redirectPath, { isNewUser: result.isNewUser === true });
          } else {
            // 정지·영구 정지 계정은 알림창 대신 로그인 화면의 이용 제한 안내로 보낸다.
            const restriction = toAccountRestriction(result);
            trackKakaoLoginFailed(restriction ? `restricted:${(result as { errorCode?: string }).errorCode ?? ""}` : result.error);
            if (restriction) {
              saveAccountRestriction(restriction);
              router.replace(ACCOUNT_RESTRICTED_LOGIN_PATH);
              return;
            }
            router.replace("/auth/login");
            alert(`로그인에 실패했습니다:${result.error}`);
          }
        },
        onError(error) {
          trackKakaoLoginFailed(error);
          router.replace("/auth/login");
          alert(error);
        },
      });
    } else {
      trackKakaoLoginFailed("kakao_user_me_failed");
      alert(
        "카카오로그인 요청에 오류가 생겼습니다. 잠시 후 다시 시도해주세요."
      );
      router.back();
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <Spinner />
    </div>
  );
};

export default KakaoLogin;
