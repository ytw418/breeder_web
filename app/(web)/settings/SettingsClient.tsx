"use client";

import Layout from "@components/features/MainLayout";
import { cn } from "@libs/client/utils";
import useUser from "hooks/useUser";
import useLogout from "hooks/useLogout";
import Link from "next/link";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";

interface PushSubscriptionStatusResponse {
  success: boolean;
  error?: string;
  configured: boolean;
  subscribed: boolean;
  vapidPublicKey: string;
}

interface PushSubscriptionUpsertBody {
  action: "subscribe" | "unsubscribe";
  subscription?: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  endpoint?: string;
}

interface SettingItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  description?: string;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

const THEME_OPTIONS = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
] as const;

const ChevronRight = () => (
  <svg
    className="h-4 w-4 text-gray-400 dark:text-slate-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 5l7 7-7 7"
    />
  </svg>
);

const SettingsClient = () => {
  const { user } = useUser();
  const handleLogout = useLogout();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushErrorMessage, setPushErrorMessage] = useState("");
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const {
    data: pushStatus,
    mutate: mutatePushStatus,
  } = useSWR<PushSubscriptionStatusResponse>("/api/push/subscription");

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const currentThemeLabel = useMemo(() => {
    if (!themeMounted || !theme) return "확인 중";
    if (theme === "system") {
      return `시스템 (${resolvedTheme === "dark" ? "다크" : "라이트"})`;
    }
    return theme === "dark" ? "다크" : "라이트";
  }, [themeMounted, theme, resolvedTheme]);

  const pushStatusLabel = useMemo(() => {
    if (!pushStatus) return "설정 확인 중";
    if (!pushStatus.configured) return "서버 설정 필요";
    return pushStatus.subscribed ? "켜짐" : "꺼짐";
  }, [pushStatus]);

  // 현재 단말 기준으로 알림 권한 복구 경로를 가볍게 안내한다.
  const permissionGuide = useMemo(() => {
    const userAgent =
      typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIOS) {
      return {
        title: "iPhone/iPad 알림 다시 켜기",
        steps: [
          "설정 앱 > Safari > 알림으로 이동",
          "Bredy 사이트 알림을 '허용'으로 변경",
          "설정 화면으로 돌아와 '알림 켜기'를 다시 눌러주세요.",
        ],
      };
    }

    if (isAndroid) {
      return {
        title: "Android 알림 다시 켜기",
        steps: [
          "브라우저 주소창 왼쪽 자물쇠(또는 사이트 정보)를 누르세요.",
          "권한 > 알림을 '허용'으로 변경하세요.",
          "설정 화면으로 돌아와 '알림 켜기'를 다시 눌러주세요.",
        ],
      };
    }

    return {
      title: "브라우저 알림 다시 켜기",
      steps: [
        "브라우저 설정 > 개인정보/권한 > 알림으로 이동",
        "Bredy 사이트 알림을 '허용'으로 변경",
        "설정 화면으로 돌아와 '알림 켜기'를 다시 눌러주세요.",
      ],
    };
  }, []);

  // VAPID 공개키(base64url)를 브라우저 Push API가 받는 Uint8Array로 변환한다.
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(normalized);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // SW가 아직 등록되지 않은 환경(개발/최초 진입)에서도 푸시 설정이 멈추지 않도록 보장한다.
  const ensureServiceWorkerReady = async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("현재 브라우저는 서비스워커를 지원하지 않습니다.");
    }

    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register("/sw.js");
    }

    // active 상태가 될 때까지 기다렸다가 반환한다.
    return navigator.serviceWorker.ready;
  };

  // 푸시 구독 API 응답을 공통 처리한다. HTTP 오류/업무 오류를 모두 에러로 승격한다.
  const requestPushApi = async (body: PushSubscriptionUpsertBody) => {
    const res = await fetch("/api/push/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await res.json().catch(() => null)) as
      | PushSubscriptionStatusResponse
      | null;

    if (!res.ok || !result?.success) {
      throw new Error(result?.error || "푸시 알림 설정 요청에 실패했습니다.");
    }

    return result;
  };

  const handleTogglePush = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    setPushErrorMessage("");
    setShowPermissionGuide(false);

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("현재 브라우저는 푸시 알림을 지원하지 않습니다.");
      }

      if (!pushStatus?.configured || !pushStatus?.vapidPublicKey) {
        throw new Error("푸시 알림 서버 설정이 완료되지 않았습니다.");
      }

      // 브라우저에서 이미 '차단(denied)' 상태면 안내 UI를 우선 노출한다.
      if (Notification.permission === "denied") {
        setShowPermissionGuide(true);
        throw new Error("알림 권한이 차단되어 있습니다. 아래 안내대로 권한을 허용해 주세요.");
      }

      const registration = await ensureServiceWorkerReady();
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        const endpoint = existingSubscription.endpoint;
        await existingSubscription.unsubscribe();
        await requestPushApi({ action: "unsubscribe", endpoint });

        await mutatePushStatus();
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") {
          setShowPermissionGuide(true);
        }
        throw new Error("알림 권한이 거부되어 설정할 수 없습니다.");
      }

      const nextSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushStatus.vapidPublicKey),
      });
      const subscriptionJson = nextSubscription.toJSON();
      const endpoint = subscriptionJson.endpoint;
      const keys = subscriptionJson.keys;

      // 일부 브라우저/환경에서는 키가 비어 돌아올 수 있어 서버 저장 전에 검증한다.
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error("푸시 구독 키를 확인할 수 없습니다. 다시 시도해 주세요.");
      }

      await requestPushApi({
        action: "subscribe",
        subscription: {
          endpoint,
          keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
        },
      });

      await mutatePushStatus();
    } catch (error: any) {
      setPushErrorMessage(error?.message || "푸시 알림 설정에 실패했습니다.");
    } finally {
      setPushLoading(false);
    }
  };

  const sections: SettingSection[] = [
    {
      title: "계정",
      items: [
        {
          label: "프로필 수정",
          href: "/editProfile",
          description: "이름, 프로필 사진 변경",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          ),
        },
        {
          label: "내 상품 관리",
          href: user?.id ? `/profiles/${user.id}/sales` : "/myPage",
          description: "판매/구매 내역 확인",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          ),
        },
      ],
    },
    {
      title: "알림",
      items: [
        {
          label: "알림 설정",
          href: "/notifications",
          description: "알림 확인",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          ),
        },
      ],
    },
    {
      title: "서비스 정보",
      items: [
        {
          label: "이용약관",
          href: "#",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          ),
        },
        {
          label: "개인정보 처리방침",
          href: "#",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          ),
        },
        {
          label: "앱 버전",
          description: "1.0.0",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          ),
        },
      ],
    },
    {
      title: "",
      items: [
        {
          label: "로그아웃",
          onClick: handleLogout,
          danger: true,
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          ),
        },
      ],
    },
  ];

  return (
    <Layout canGoBack title="설정" seoTitle="설정">
      <div className="pb-10">
        <div className="px-4 pt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                화면 테마
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                라이트, 다크, 시스템 모드를 선택할 수 있습니다.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
              {THEME_OPTIONS.map((option) => {
                const isActive = themeMounted && theme === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "h-9 rounded-lg text-xs font-semibold transition-colors",
                      isActive
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-50 dark:text-slate-900"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              현재 모드: {currentThemeLabel}
            </p>
          </div>
        </div>

        <div className="px-4 pt-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  푸시 알림
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  채팅과 주요 이벤트를 브라우저 알림으로 받을 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTogglePush}
                disabled={pushLoading}
                className={cn(
                  "h-9 rounded-full px-3 text-xs font-semibold transition-colors",
                  pushStatus?.subscribed
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200",
                  pushLoading && "cursor-not-allowed opacity-60"
                )}
              >
                {pushLoading
                  ? "처리 중..."
                  : pushStatus?.subscribed
                    ? "알림 끄기"
                    : "알림 켜기"}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                상태: {pushStatusLabel}
              </span>
              {!pushStatus?.configured && (
                <span className="text-amber-600 dark:text-amber-400">
                  VAPID 키 환경변수가 필요합니다.
                </span>
              )}
            </div>
            {pushErrorMessage && (
              <p className="mt-2 text-xs text-rose-500">{pushErrorMessage}</p>
            )}
            {showPermissionGuide && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-700/40 dark:bg-amber-950/30">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  {permissionGuide.title}
                </p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11px] text-amber-800 dark:text-amber-300">
                  {permissionGuide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx}>
            {section.title && (
              <div className="px-4 pt-6 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                  {section.title}
                </h3>
              </div>
            )}
            <div>
              {section.items.map((item, itemIdx) => {
                const content = (
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60",
                      item.danger && "hover:bg-red-50 dark:hover:bg-rose-950/20"
                    )}
                  >
                    <div
                      className={cn(
                        "h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center",
                        item.danger
                          ? "bg-red-50 text-red-500 dark:bg-rose-950/35 dark:text-rose-300"
                          : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-300"
                      )}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {item.icon}
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          item.danger ? "text-red-500 dark:text-rose-300" : "text-gray-900 dark:text-slate-100"
                        )}
                      >
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                          {item.description}
                        </p>
                      )}
                    </div>
                    {item.href && <ChevronRight />}
                  </div>
                );

                if (item.href) {
                  return (
                    <Link key={itemIdx} href={item.href}>
                      {content}
                    </Link>
                  );
                }

                if (item.onClick) {
                  return (
                    <button
                      key={itemIdx}
                      onClick={item.onClick}
                      className="w-full text-left"
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <div key={itemIdx}>{content}</div>
                );
              })}
            </div>
            {sectionIdx < sections.length - 1 && (
              <div className="mt-1 h-2 bg-gray-50 dark:bg-slate-900/70" />
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
};

export default SettingsClient;
