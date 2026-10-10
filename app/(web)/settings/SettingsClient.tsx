"use client";

import { authFetch } from "@libs/client/authFetch";
import Layout, { toLoginHref } from "@components/features/MainLayout";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import { cn } from "@libs/client/utils";
import Toggle from "@components/app/Toggle";
import { toast } from "@libs/client/toast";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@libs/constants";
import useUser from "hooks/useUser";
import useCategoryScope from "hooks/useCategoryScope";
import { formatRegion, regionOf } from "@libs/shared/regions";
import {
  PUSH_SUBSCRIPTION_KEY,
  WebPushPermissionError,
  disableWebPush,
  enableWebPush,
  type PushSubscriptionStatusResponse,
} from "@libs/client/webPush";
import useLogout from "hooks/useLogout";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { version as APP_VERSION } from "../../../package.json";

interface PushTestResponse {
  success: boolean;
  error?: string;
  configured: boolean;
  subscriptionCount: number;
}

type ThemePreference = "light" | "dark" | "system";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
];

/* ------------------------------------------------------------------ */
/* 라인 아이콘 (앱 settings/index.tsx 와 같은 heroicon path, 1.5px)      */
/* ------------------------------------------------------------------ */

const ICON_PATHS = {
  pin: [
    "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
    "M15 11a3 3 0 11-6 0 3 3 0 016 0z",
  ],
  grid: [
    "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  ],
  user: ["M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"],
  box: ["M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"],
  support: [
    "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-3 3-3-3z",
  ],
  bell: [
    "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  ],
  document: [
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  ],
  shield: [
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  ],
  info: ["M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"],
  logout: [
    "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  ],
  display: [
    "M9 17.25h6M12 17.25V21M4 4.5h16a1 1 0 011 1v9.75a1 1 0 01-1 1H4a1 1 0 01-1-1V5.5a1 1 0 011-1z",
  ],
  "chevron-right": ["M9 5l7 7-7 7"],
} as const;

type LineIconName = keyof typeof ICON_PATHS;

function LineIcon({ name, size = 22, className }: { name: LineIconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="bg-app-bg px-4 pb-2 pt-[18px]">
      <h3 className="text-[13px] font-semibold text-app-muted">{title}</h3>
    </div>
  );
}

function SectionGap() {
  return <div className="h-2 bg-app-gap" aria-hidden="true" />;
}

/**
 * 56 플랫 행(아이콘 22 muted · 16/500 · 값 14 muted · chevron). sub 는 들여쓴 14/400 muted 행.
 * href(내부·외부 링크) / onClick(버튼) / 둘 다 없으면 정적 행.
 */
function Row({
  label,
  icon,
  value,
  chevron,
  right,
  href,
  onClick,
  disabled,
  sub,
  ariaExpanded,
}: {
  label: string;
  icon?: LineIconName;
  value?: string;
  chevron?: boolean;
  right?: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  sub?: boolean;
  ariaExpanded?: boolean;
}) {
  const content = (
    <>
      {icon ? <LineIcon name={icon} className="mr-3 text-app-muted" /> : null}
      <span
        className={cn(
          "flex-1 text-left",
          sub ? "text-[14px] font-normal text-app-muted" : "text-[16px] font-medium text-app-text"
        )}
      >
        {label}
      </span>
      {value ? <span className={cn("text-[14px] text-app-muted", chevron && "mr-1")}>{value}</span> : null}
      {right}
      {chevron ? <LineIcon name="chevron-right" size={18} className="text-app-caption" /> : null}
    </>
  );
  const className = cn(
    "flex min-h-[56px] w-full items-center border-b border-app-line bg-app-bg",
    sub ? "pl-[50px] pr-4" : "px-4",
    (href || onClick) && "transition-colors hover:bg-app-surface",
    disabled && "pointer-events-none opacity-50"
  );

  if (href) {
    const external = /^https?:\/\//.test(href);
    return external ? (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    ) : (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} aria-expanded={ariaExpanded} className={className}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}


const SettingsClient = () => {
  const router = useRouter();
  const { user, isAdmin } = useUser();
  const scope = useCategoryScope();
  const handleLogout = useLogout();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [themeExpanded, setThemeExpanded] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushTestLoading, setPushTestLoading] = useState(false);
  const [pushErrorMessage, setPushErrorMessage] = useState("");
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [currentPushToken, setCurrentPushToken] = useState("");
  const {
    data: pushStatus,
    mutate: mutatePushStatus,
    error: pushStatusError,
    isLoading: isPushStatusLoading,
  } = useSWR<PushSubscriptionStatusResponse>(user ? PUSH_SUBSCRIPTION_KEY : null);

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
    if (!user) return "로그인 필요";
    if (isPushStatusLoading) return "설정 확인 중";
    if (pushStatusError) return "설정 확인 실패";
    if (!pushStatus) return "설정 확인 중";
    if (!pushStatus.configured) return "지금은 사용할 수 없음";
    return pushStatus.subscribed ? "켜짐" : "꺼짐";
  }, [isPushStatusLoading, pushStatusError, pushStatus, user]);

  // 현재 단말 기준으로 알림 권한 복구 경로를 가볍게 안내한다(웹 전용).
  const permissionGuide = useMemo(() => {
    const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    if (isIOS) {
      return {
        title: "iPhone/iPad 알림 다시 켜기",
        steps: [
          "설정 앱 > Safari > 알림으로 이동",
          "Bredy 사이트 알림을 '허용'으로 변경",
          "설정 화면으로 돌아와 푸시 알림을 다시 켜주세요.",
        ],
      };
    }
    return {
      title: "브라우저 알림 다시 켜기",
      steps: [
        "브라우저 설정 > 개인정보/권한 > 알림으로 이동",
        "Bredy 사이트 알림을 '허용'으로 변경",
        "설정 화면으로 돌아와 푸시 알림을 다시 켜주세요.",
      ],
    };
  }, []);

  const handleTogglePush = async () => {
    if (pushLoading || isPushStatusLoading) return;
    if (!user) {
      router.push(toLoginHref("/settings"));
      return;
    }
    setPushLoading(true);
    setPushErrorMessage("");
    setShowPermissionGuide(false);

    try {
      if (pushStatus?.subscribed) {
        // 해제 시 브라우저 토큰 삭제 + 서버 토큰 삭제를 모두 수행한다.
        await disableWebPush(pushStatus, currentPushToken);
        setCurrentPushToken("");
        await mutatePushStatus();
        return;
      }
      const token = await enableWebPush(user.id, pushStatus);
      setCurrentPushToken(token);
      await mutatePushStatus();
      toast.success("알림이 켜졌습니다.");
    } catch (error) {
      if (error instanceof WebPushPermissionError && error.permission === "denied") setShowPermissionGuide(true);
      setPushErrorMessage(error instanceof Error ? error.message : "푸시 알림 설정에 실패했습니다.");
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendPushTest = async () => {
    if (pushTestLoading) return;
    setPushTestLoading(true);
    setPushErrorMessage("");
    try {
      const res = await authFetch("/api/push/test", { method: "POST" });
      const result = (await res.json().catch(() => null)) as PushTestResponse | null;
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || "테스트 알림 전송에 실패했습니다.");
      }
      toast.success(`테스트 알림을 전송했습니다. (${result.subscriptionCount}개 기기)`);
    } catch (error) {
      setPushErrorMessage(error instanceof Error ? error.message : "테스트 알림 전송에 실패했습니다.");
    } finally {
      setPushTestLoading(false);
    }
  };

  const pushErrorText =
    pushErrorMessage || (pushStatusError ? "푸시 설정 상태를 불러오지 못했습니다." : "");
  const showPushTest = isAdmin || process.env.NODE_ENV === "development";

  return (
    <Layout canGoBack title="설정" seoTitle="설정">
      <div className="bg-app-bg pb-10">
        <SectionTitle title="계정" />
        <Row label="프로필 수정" icon="user" chevron href="/editProfile" />
        <Row
          label="내 분양 관리"
          icon="box"
          chevron
          href={user?.id ? `/profiles/${user.id}/sales` : "/myPage"}
        />
        <Row
          label="내 동네"
          icon="pin"
          value={formatRegion(regionOf(user)) ?? "설정 안 함"}
          chevron
          href={user ? "/settings/region" : toLoginHref("/settings/region")}
        />
        <Row label="관심 카테고리" icon="grid" value={scope.label} chevron href="/settings/categories" />
        <Row label="차단 관리" icon="shield" chevron href="/settings/blocked-users" />
        <Row label="내 제재 내역" icon="document" chevron href="/settings/sanctions" />
        <Row label="회원탈퇴" icon="support" chevron href="/settings/delete-account" />

        <SectionGap />

        <SectionTitle title="화면" />
        <Row
          label="화면 테마"
          icon="display"
          value={currentThemeLabel}
          chevron
          ariaExpanded={themeExpanded}
          onClick={() => setThemeExpanded((prev) => !prev)}
        />
        {themeExpanded ? (
          <div className="border-b border-app-line bg-app-bg">
            <div className="mx-4 my-2.5 flex gap-1.5" role="radiogroup" aria-label="화면 테마">
              {THEME_OPTIONS.map((option) => {
                const isActive = themeMounted && theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "h-9 flex-1 rounded-md border text-[14px] transition-colors",
                      isActive
                        ? "border-app-border bg-app-bg font-semibold text-app-text"
                        : "border-transparent bg-app-gap font-normal text-app-muted"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <SectionGap />

        <SectionTitle title="알림" />
        <Row
          label="푸시 알림"
          icon="bell"
          value={pushLoading ? "처리 중..." : pushStatusLabel}
          right={
            <Toggle
              label="푸시 알림"
              checked={Boolean(pushStatus?.subscribed)}
              disabled={pushLoading || (Boolean(user) && isPushStatusLoading)}
              onChange={() => void handleTogglePush()}
            />
          }
        />
        {showPushTest ? (
          <Row
            label={pushTestLoading ? "전송 중..." : "테스트 알림 보내기"}
            sub
            chevron
            disabled={pushTestLoading || !pushStatus?.subscribed}
            onClick={() => void handleSendPushTest()}
          />
        ) : null}
        <Row label="알림 내역" sub chevron href="/notifications" />
        {pushErrorText ? (
          <p className="px-4 pt-2.5 text-[13px] text-app-brand" role="alert">
            {pushErrorText}
          </p>
        ) : null}
        {showPermissionGuide ? (
          <div className="px-4 pb-1 pt-1.5 text-[13px] text-app-muted">
            <p className="font-semibold text-app-sub">{permissionGuide.title}</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              {permissionGuide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ) : null}

        <SectionGap />

        <SectionTitle title="서비스 정보" />
        <Row label="이용약관" icon="document" chevron href={TERMS_OF_SERVICE_URL} />
        <Row label="개인정보 처리방침" icon="shield" chevron href={PRIVACY_POLICY_URL} />
        <Row label="고객의 소리" icon="support" chevron href="/support" />
        <Row label="서비스 버전" icon="info" value={APP_VERSION} />
        {user ? <Row label="로그아웃" icon="logout" onClick={() => setLogoutOpen(true)} /> : null}
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="로그아웃할까요?"
        confirmText="로그아웃"
        tone="danger"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          void handleLogout();
        }}
      />
    </Layout>
  );
};

export default SettingsClient;
