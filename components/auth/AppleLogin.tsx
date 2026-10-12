"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import useMutation from "@/hooks/useMutation";
import type { LoginReqBody, LoginResponseType } from "@/pages/api/auth/login";
import { USER_INFO } from "@libs/constants";
import { Spinner } from "@components/atoms/Spinner";
import { setTokens } from "@libs/client/authToken";
import { getSafeNextPath, navigateAfterSessionReady } from "@libs/client/postLogin";
import {
  ACCOUNT_RESTRICTED_LOGIN_PATH,
  saveAccountRestriction,
  toAccountRestriction,
} from "@libs/client/accountRestriction";
import {
  APPLE_WEB_NONCE_STORAGE_KEY,
  APPLE_WEB_RETURN_STORAGE_KEY,
} from "@libs/shared/appleLogin";

const markPostLoginGuide = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("bredy:show-post-login-guide", "1");
  } catch {
    // noop
  }
};

/** sessionStorage 값을 꺼내며 지운다(한 번만 쓰는 토큰·nonce). */
const takeSessionItem = (key: string) => {
  try {
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
};

/**
 * Apple 로그인 완료(/auth/apple/complete). 콜백 복귀 페이지가 sessionStorage 에 넣은 id_token 과
 * 로그인 화면이 보관한 원래 nonce 로 /api/auth/login 을 부른다. 흐름은 libs/server/appleOAuth.ts 참고.
 */
export const AppleLogin = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [login] = useMutation<LoginResponseType>("/api/auth/login");
  // 개발 모드 StrictMode 가 effect 를 두 번 돌려도 한 번만 쓴다(첫 실행이 저장값을 지운다).
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const idToken = takeSessionItem(APPLE_WEB_RETURN_STORAGE_KEY);
    const nonce = takeSessionItem(APPLE_WEB_NONCE_STORAGE_KEY);
    if (!idToken || !nonce) {
      router.replace("/auth/login?error=apple_restart");
      return;
    }

    const body: LoginReqBody = {
      token: idToken,
      name: "Apple User",
      provider: USER_INFO.provider.APPLE,
      nonce,
    };
    void login({
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
          void navigateAfterSessionReady(getSafeNextPath(searchParams?.get("next") ?? null));
          return;
        }
        // 정지·영구 정지 계정은 알림창 대신 로그인 화면의 이용 제한 안내로 보낸다.
        const restriction = toAccountRestriction(result);
        if (restriction) {
          saveAccountRestriction(restriction);
          router.replace(ACCOUNT_RESTRICTED_LOGIN_PATH);
          return;
        }
        // 탈퇴 보관 중 등 서버 문구가 있으면 그대로 알린다.
        const message = result.error || (result as { message?: string }).message;
        if (message) {
          alert(`로그인에 실패했습니다:${message}`);
          router.replace("/auth/login");
          return;
        }
        router.replace("/auth/login?error=apple_token");
      },
      onError() {
        router.replace("/auth/login?error=apple_token");
      },
    });
  }, [login, router, searchParams]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <Spinner />
    </div>
  );
};

export default AppleLogin;
