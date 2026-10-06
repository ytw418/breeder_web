"use client";
import { useEffect, useState } from "react";

import Image from "next/image";
import logo from "@images/logo.png";
import KakaoRound from "@images/KakaoRound.svg";
import GoogleRound from "@images/GoogleRound.svg";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useMutation from "hooks/useMutation";
import useSWR from "swr";
import { LoginReqBody, LoginResponseType } from "pages/api/auth/login";
import type { FoundingCountResponseType } from "pages/api/breeder-programs/founding-count";
import {
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
  USER_INFO,
} from "@libs/constants";
import { setTokens } from "@libs/client/authToken";
import { authFetch } from "@libs/client/authFetch";

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

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

const navigateAfterSessionReady = async (nextPath: string) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const meRes = await authFetch("/api/users/me", {
        method: "GET",
        cache: "no-store",
      });
      if (meRes.ok) {
        window.location.assign(nextPath);
        return;
      }
    } catch {
      // noop
    }
    await wait(100);
  }

  window.location.assign(nextPath);
};

// 구글 버튼은 브랜드 가이드(흰 버튼)대로 테마와 무관하게 라이트 색 고정.
const GOOGLE_BUTTON_STYLE = {
  backgroundColor: "#FFFFFF",
  borderColor: "#E8E9EB",
  color: "#212124",
} as const;

type TestAccountItem = {
  id: number;
  name: string;
  email: string | null;
  provider: string;
  createdAt: string;
};

type TestAccountListResponse = {
  success: boolean;
  error?: string;
  users?: TestAccountItem[];
};

type TestAccountSwitchResponse = {
  success: boolean;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
};

type LoginClientProps = {
  shouldShowTestLogin: boolean;
};

const isReactNativeWebViewWindow = () => {
  if (typeof window === "undefined") return false;

  const reactNativeWebView = (
    window as typeof window & {
      ReactNativeWebView?: {
        postMessage?: (message: string) => void;
      };
    }
  ).ReactNativeWebView;

  return typeof reactNativeWebView?.postMessage === "function";
};

const LoginClient = ({ shouldShowTestLogin }: LoginClientProps) => {
  const searchParams = useSearchParams();
  const [login] = useMutation<LoginResponseType>("/api/auth/login");
  const { data: foundingData } = useSWR<FoundingCountResponseType>(
    "/api/breeder-programs/founding-count",
  );
  const foundingRemaining = foundingData?.remaining ?? null;
  const isFoundingSoldOut =
    foundingRemaining !== null && foundingRemaining <= 0;
  const [testAccounts, setTestAccounts] = useState<TestAccountItem[]>([]);
  const [isLoadingTestAccounts, setIsLoadingTestAccounts] = useState(false);
  const [testLoginError, setTestLoginError] = useState("");
  const [switchingTestUserId, setSwitchingTestUserId] = useState<number | null>(
    null,
  );
  const [isReactNativeWebView, setIsReactNativeWebView] = useState(false);
  // 기본값은 노출(true). 추후 숨길 때 NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=false로 설정.
  const shouldShowGoogleLogin =
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN !== "false";
  const canShowGoogleLogin = shouldShowGoogleLogin && !isReactNativeWebView;

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
            "sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4",
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
        if (
          platform === "kakao" &&
          window.Kakao &&
          !window.Kakao.isInitialized?.()
        ) {
          window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY);
        }
        return null;
      }
    } else return null;
  };

  useEffect(() => {
    loadScript(
      "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js",
      "kakao",
    );
  }, []);

  useEffect(() => {
    setIsReactNativeWebView(isReactNativeWebViewWindow());
  }, []);

  useEffect(() => {
    if (!shouldShowTestLogin) return;

    let mounted = true;
    setIsLoadingTestAccounts(true);
    setTestLoginError("");

    const fetchTestAccounts = async () => {
      try {
        const res = await authFetch("/api/users/test-accounts", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await res.json()) as TestAccountListResponse;
        if (!mounted) return;
        if (!res.ok || !data.success) {
          throw new Error(
            data.error || "테스트 계정 목록 조회에 실패했습니다.",
          );
        }
        setTestAccounts(data.users || []);
      } catch (error) {
        if (!mounted) return;
        setTestAccounts([]);
        setTestLoginError(
          error instanceof Error
            ? error.message
            : "테스트 계정 목록 조회 중 오류가 발생했습니다.",
        );
      } finally {
        if (mounted) {
          setIsLoadingTestAccounts(false);
        }
      }
    };

    void fetchTestAccounts();

    return () => {
      mounted = false;
    };
  }, [shouldShowTestLogin]);

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
        token: await user.getIdToken(),
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
            if (result.accessToken && result.refreshToken) {
              setTokens({
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
              });
            }
            markPostLoginGuide();
            void navigateAfterSessionReady(nextPath);
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

  const loginAsTestUser = async (targetUserId: number) => {
    if (switchingTestUserId === targetUserId) return;

    const nextPath = getSafeNextPath(searchParams?.get("next") ?? null);
    setSwitchingTestUserId(targetUserId);
    setTestLoginError("");

    try {
      const res = await authFetch("/api/users/test-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = (await res.json()) as TestAccountSwitchResponse;

      if (!res.ok || !data.success) {
        throw new Error(data.error || "테스트 계정 전환에 실패했습니다.");
      }

      if (data.accessToken && data.refreshToken) {
        setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
      }

      markPostLoginGuide();
      void navigateAfterSessionReady(nextPath);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "테스트 계정 전환 중 오류가 발생했습니다.";
      setTestLoginError(message);
      alert(message);
    } finally {
      setSwitchingTestUserId(null);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col overflow-y-auto bg-app-bg px-5 py-8">
      <div className="mx-auto my-auto flex w-full max-w-sm flex-col">
        {/* 브랜드 */}
        <div className="mb-10 flex flex-col items-center">
          <Image
            src={logo}
            alt="브리디 로고"
            width={56}
            height={56}
            priority
            className="h-14 w-14 object-contain"
          />
          <h1 className="mt-4 text-[24px] font-bold text-app-text">브리디</h1>
          <p className="mt-2 text-center text-[15px] leading-[22px] text-app-muted">
            생물인들과 소통하고 안전하게 거래하세요
          </p>
        </div>

        {/* 소셜 로그인 */}
        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={() => loginWithKakao()}
            className="relative flex h-[52px] w-full items-center justify-center rounded-lg bg-[#FEE500] px-6 text-[#191919]"
          >
            <KakaoRound className="absolute left-5" width={24} height={24} />
            <span className="text-[15px] font-semibold">카카오로 계속하기</span>
          </button>

          {canShowGoogleLogin ? (
            <button
              type="button"
              onClick={() => loginWithGoogle()}
              className="relative flex h-[52px] w-full items-center justify-center rounded-lg border px-6"
              // 다크 모드의 레거시 .dark .bg-white 재매핑을 피하려고 inline style 로 고정한다.
              style={GOOGLE_BUTTON_STYLE}
            >
              <GoogleRound className="absolute left-5" width={24} height={24} />
              <span className="text-[15px] font-semibold">구글로 계속하기</span>
            </button>
          ) : !isReactNativeWebView ? (
            <p className="text-[13px] leading-5 text-app-muted">
              현재는 카카오 로그인만 지원합니다.
            </p>
          ) : null}

          {/* 서비스 둘러보기 */}
          <Link
            href={"/"}
            className="flex items-center justify-center py-2.5 text-[13px] text-app-muted"
          >
            서비스 둘러보기
          </Link>
        </div>

        {/* 테스트 로그인 (개발/테스트 환경 전용) */}
        {shouldShowTestLogin ? (
          <div className="mt-6 w-full">
            <p className="text-[13px] font-semibold text-app-muted">
              테스트 계정
            </p>
            {isLoadingTestAccounts ? (
              <p className="mt-2 text-[13px] text-app-muted">
                테스트 계정 목록 불러오는 중...
              </p>
            ) : null}
            {testLoginError ? (
              <p className="mt-2 text-[13px] text-app-danger">
                {testLoginError}
              </p>
            ) : null}
            {!isLoadingTestAccounts && !testAccounts.length ? (
              <p className="mt-2 text-[13px] text-app-muted">
                사용 가능한 테스트 계정이 없습니다.
              </p>
            ) : (
              <div className="mt-1 max-h-60 overflow-y-auto">
                {testAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => loginAsTestUser(account.id)}
                    disabled={switchingTestUserId === account.id}
                    className="flex h-11 w-full items-center justify-between text-left disabled:opacity-60"
                  >
                    <span className="flex-1 truncate text-[15px] text-app-text">
                      {account.name}
                    </span>
                    <span className="ml-3 text-[12px] text-app-muted">
                      {switchingTestUserId === account.id
                        ? "전환 중..."
                        : account.provider}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* 창립 브리더 */}
        <Link
          href="/content/breeder-program"
          className="mt-6 w-full rounded-xl border border-app-border p-4 text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-[15px] font-bold text-app-text">
                {isFoundingSoldOut
                  ? "창립 브리더 100인 마감"
                  : "창립 브리더 100인 한정"}
              </h2>
              <p className="mt-1 text-[14px] leading-[21px] text-app-muted">
                {isFoundingSoldOut
                  ? "창립 브리더 프로그램 소개를 확인해보세요."
                  : "초기 100명에게 평생 경매 수수료 무료와 전용 표시 혜택을 제공합니다."}
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-semibold text-app-text">
              보기
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {foundingRemaining !== null && !isFoundingSoldOut ? (
              <FoundingPill label={`잔여 ${foundingRemaining}석`} />
            ) : null}
            <FoundingPill label="수수료 무료" />
            <FoundingPill label="전용 프레임" />
            <FoundingPill label="전용 뱃지" />
          </div>
        </Link>

        {/* 약관 */}
        <p className="mt-6 text-[12px] leading-[18px] text-app-muted">
          서비스 이용시 브리디의{" "}
          <Link
            target="_blank"
            className="font-semibold text-app-sub"
            href={TERMS_OF_SERVICE_URL}
          >
            이용약관
          </Link>{" "}
          및{" "}
          <Link
            target="_blank"
            className="font-semibold text-app-sub"
            href={PRIVACY_POLICY_URL}
          >
            개인정보처리동의서
          </Link>{" "}
          동의로 간주합니다.
        </p>
      </div>
    </div>
  );
};

function FoundingPill({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-app-surface px-2 py-1 text-[12px] text-app-muted">
      {label}
    </span>
  );
}

export default LoginClient;
