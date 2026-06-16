"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { hasTokens } from "@libs/client/authToken";
import useUser from "hooks/useUser";
import { Spinner } from "@components/atoms/Spinner";

/**
 * 클라이언트 사이드 로그인 가드.
 *
 * 순수 Bearer 토큰 방식에서는 서버 컴포넌트가 토큰을 읽을 수 없으므로,
 * 기존 서버측 getSessionUser 기반 리다이렉트를 이 클라이언트 가드로 대체한다.
 *
 * 1) 토큰 자체가 없으면 즉시 로그인 페이지로 보낸다(불필요한 요청 방지).
 * 2) 토큰이 있으면 useUser(/api/users/me) 로 실제 유효성까지 검증하고,
 *    만료/무효 토큰이면(refresh 실패 포함) 로그인 페이지로 보낸다.
 */
export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useUser();

  const tokenPresent = hasTokens();

  useEffect(() => {
    if (tokenPresent) return;
    redirectToLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenPresent]);

  useEffect(() => {
    // 토큰은 있으나 검증(프로필 조회)에 실패한 경우(만료/무효) 로그인으로 보낸다.
    if (tokenPresent && !isLoading && !user) {
      redirectToLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenPresent, isLoading, user]);

  function redirectToLogin() {
    const next = encodeURIComponent(pathname || "/");
    router.replace(`/auth/login?next=${next}`);
  }

  // 인증이 확정되기 전까지는 보호 콘텐츠를 렌더하지 않는다.
  if (!tokenPresent || isLoading || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;
