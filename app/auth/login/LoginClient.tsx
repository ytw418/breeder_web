"use client";
import { useEffect, useState } from "react";

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
      const meRes = await fetch("/api/users/me", {
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
};

type LoginClientProps = {
  shouldShowTestLogin: boolean;
};

const LoginClient = ({ shouldShowTestLogin }: LoginClientProps) => {
  const searchParams = useSearchParams();
  const [login] = useMutation<LoginResponseType>("/api/auth/login");
  const { data: foundingData } = useSWR<FoundingCountResponseType>(
    "/api/breeder-programs/founding-count"
  );
  const foundingRemaining = foundingData?.remaining ?? null;
  const isFoundingSoldOut =
    foundingRemaining !== null && foundingRemaining <= 0;
  const [testAccounts, setTestAccounts] = useState<TestAccountItem[]>([]);
  const [isLoadingTestAccounts, setIsLoadingTestAccounts] = useState(false);
  const [testLoginError, setTestLoginError] = useState("");
  const [switchingTestUserId, setSwitchingTestUserId] = useState<number | null>(null);
  // 기본값은 노출(true). 추후 숨길 때 NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=false로 설정.
  const shouldShowGoogleLogin =
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN !== "false";

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

  useEffect(() => {
    if (!shouldShowTestLogin) return;

    let mounted = true;
    setIsLoadingTestAccounts(true);
    setTestLoginError("");

    const fetchTestAccounts = async () => {
      try {
        const res = await fetch("/api/users/test-accounts", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await res.json()) as TestAccountListResponse;
        if (!mounted) return;
        if (!res.ok || !data.success) {
          throw new Error(data.error || "테스트 계정 목록 조회에 실패했습니다.");
        }
        setTestAccounts(data.users || []);
      } catch (error) {
        if (!mounted) return;
        setTestAccounts([]);
        setTestLoginError(
          error instanceof Error ? error.message : "테스트 계정 목록 조회 중 오류가 발생했습니다."
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
      const res = await fetch("/api/users/test-accounts", {
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

      markPostLoginGuide();
      void navigateAfterSessionReady(nextPath);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "테스트 계정 전환 중 오류가 발생했습니다.";
      setTestLoginError(message);
      alert(message);
    } finally {
      setSwitchingTestUserId(null);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto px-5 py-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-md flex-col">
        <div className="mb-10 flex flex-col items-center text-center sm:mb-12">
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
        {shouldShowTestLogin ? (
          <div className="w-full rounded-lg border border-Gray-200 bg-Gray-50 p-3">
            <p className="text-[11px] text-Gray-500">테스트 로그인 (개발/테스트 환경 전용)</p>
            {isLoadingTestAccounts ? (
              <p className="mt-2 text-[11px] text-Gray-500">테스트 계정 목록 불러오는 중...</p>
            ) : null}
            {testLoginError ? <p className="mt-2 text-[11px] text-rose-500">{testLoginError}</p> : null}
            {!isLoadingTestAccounts && !testAccounts.length ? (
              <p className="mt-2 text-[11px] text-Gray-500">
                사용 가능한 테스트 계정이 없습니다.
              </p>
            ) : (
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
                {testAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => loginAsTestUser(account.id)}
                    disabled={switchingTestUserId === account.id}
                    className="button relative flex h-10 w-full items-center justify-between rounded-md border border-Gray-300 bg-white px-3 text-left"
                  >
                    <span className="text-xs text-Gray-700 truncate">{account.name}</span>
                    <span className="text-[11px] text-Gray-500">
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
        <Link
          href={"/"}
          className="button relative flex h-[54px] w-full items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <span className="title-3">{"서비스 둘러보기"}</span>
        </Link>
        <Link
          href="/content/breeder-program"
          className="w-full rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
                Founding Breeder 100
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                {isFoundingSoldOut
                  ? "창립 브리더 100인 마감"
                  : "창립 브리더 100인 한정"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {isFoundingSoldOut
                  ? "창립 브리더 100인이 모두 선정되었습니다. 프로그램 소개를 확인해보세요."
                  : "브리디를 처음 시작한 100명은 평생 경매 수수료 무료, 전용 프레임과 전용 뱃지 혜택을 받습니다."}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
              자세히
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {foundingRemaining !== null && !isFoundingSoldOut ? (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                잔여 {foundingRemaining}석
              </span>
            ) : null}
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
              평생 경매 수수료 무료
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              전용 프레임
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              전용 뱃지
            </span>
          </div>
        </Link>
        {/* <div
          onClick={() => loginWithApple()}
          className="relative flex h-[54px] w-full cursor-pointer items-center justify-center rounded-lg border border-Gray-300 px-7 py-[14px]"
        >
          <AppleSquare className="absolute left-7" width={26} height={26} />
          <span className="title-3">{"애플로 회원가입"}</span>
        </div> */}
        </div>
        <div className="mb-2 mt-10 w-full border-t-[1px] border-Gray-300" />
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
    </div>
  );
};

export default LoginClient;
