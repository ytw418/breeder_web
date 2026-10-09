"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "@components/atoms/Image";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import { HeaderIconButton } from "@components/app/HeaderIconButton";
import logo from "@images/logo.png";
import useSWR from "swr";
import { cn, makeImageUrl } from "@libs/client/utils";
import useUser from "hooks/useUser";
import SanctionNoticeModal from "@components/features/moderation/SanctionNoticeModal";
import useLogout from "hooks/useLogout";
import { version as APP_VERSION } from "../../package.json";

export type HeaderVariant = "default" | "chat-list" | "profile" | "none";

interface LayoutProps {
  title?: string;
  canGoBack?: boolean;
  hasTabBar?: boolean;
  children: React.ReactNode;
  seoTitle?: string;
  icon?: boolean;
  showSearch?: boolean;
  showHome?: boolean;
  /**
   * 헤더 오른쪽을 통째로 바꾼다(기본: 알림 벨 + 메뉴). 상세 화면의 ⋮ 등.
   * headerVariant="chat-list" 에서는 알림 벨 왼쪽(검색 자리)에 들어간다.
   */
  headerRight?: React.ReactNode;
  /**
   * default: 기존 헤더(로고/뒤로가기 + 가운데 제목 + 오른쪽 아이콘)
   * chat-list: 제목 좌측 18/700 + headerRight(검색 토글) + 알림 벨
   * profile: 뒤로 · 제목 좌측 18/700 · headerRight(공유·더보기·완료). 알림 벨·메뉴 없음(앱 ProfileHeader, 사진형 A안)
   * none: 헤더를 그리지 않는다(화면이 자체 헤더를 그릴 때)
   */
  headerVariant?: HeaderVariant;
}

interface UnreadCountResponse {
  success: boolean;
  unreadCount: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const UNREAD_REFRESH_MS = 30_000;

/* ------------------------------------------------------------------ */
/* 아이콘                                                              */
/* ------------------------------------------------------------------ */

const ICON = {
  back: "M15 19l-7-7 7-7",
  homeNav: "M3 12l9-7 9 7v8a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1v-8z",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 18 18 6M6 6l12 12",
} as const;

function StrokeIcon({
  d,
  className = "h-6 w-6",
  strokeWidth = 2,
}: {
  d: string | readonly string[];
  className?: string;
  strokeWidth?: number;
}) {
  const paths = typeof d === "string" ? [d] : d;
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {paths.map((path) => (
        <path
          key={path}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          d={path}
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 하단 탭바 (앱 (tabs)/_layout.tsx)                                    */
/* ------------------------------------------------------------------ */

const BOTTOM_NAV_ITEMS: {
  label: string;
  href: string;
  requiresAuth?: boolean;
  isActive: (pathname: string) => boolean;
  d: string;
}[] = [
  {
    label: "홈",
    href: "/",
    isActive: (pathname) => pathname === "/",
    d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    label: "반려생활",
    href: "/posts",
    isActive: (pathname) => pathname.startsWith("/posts"),
    d: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
  },
  {
    label: "경매",
    href: "/auctions",
    isActive: (pathname) => pathname.startsWith("/auctions"),
    d: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    label: "채팅",
    href: "/chat",
    requiresAuth: true,
    isActive: (pathname) => pathname.startsWith("/chat"),
    d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    label: "마이페이지",
    href: "/myPage",
    requiresAuth: true,
    isActive: (pathname) => pathname.startsWith("/myPage"),
    d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
];

export const toLoginHref = (next: string) => `/auth/login?next=${encodeURIComponent(next)}`;

/* ------------------------------------------------------------------ */
/* 사이드 메뉴 (앱 SideMenu.tsx)                                         */
/* ------------------------------------------------------------------ */

/** heroicons outline(1.5px) — 앱 SideMenu ICON_PATHS / 공용 Icon 과 같은 path. */
const MENU_ICONS = {
  bell: [
    "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75v-.7V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0",
  ],
  chart: [
    "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
  ],
  book: [
    "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25",
  ],
  graph: [
    "M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z",
  ],
  card: [
    "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z",
  ],
  cart: [
    "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  ],
  bag: ["M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"],
  heart: [
    "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  ],
  settings: [
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  ],
  support: [
    "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-3 3-3-3z",
  ],
  install: ["M12 16V4m0 12l-3-3m3 3l3-3M5 20h14"],
  comment: [
    "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  ],
} as const;

type MenuIconName = keyof typeof MENU_ICONS;

interface MenuRow {
  label: string;
  icon: MenuIconName;
  href: string;
  /** 비로그인 시 로그인으로 보낸다(next=href). */
  requiresAuth?: boolean;
  /** 알림 unread 뱃지 */
  badge?: boolean;
}

function buildMenuSections(userId: number | null): { title: string; rows: MenuRow[] }[] {
  const owner = userId ?? 0;
  return [
    {
      title: "활동",
      rows: [
        { label: "알림", icon: "bell", href: "/notifications", badge: true },
        { label: "랭킹", icon: "chart", href: "/ranking" },
        { label: "브리디북", icon: "book", href: "/guinness" },
        { label: "내 댓글", icon: "comment", href: `/profiles/${owner}/comments`, requiresAuth: true },
      ],
    },
    {
      title: "거래",
      rows: [
        { label: "분양내역", icon: "cart", href: `/profiles/${owner}/sales`, requiresAuth: true },
        { label: "입양내역", icon: "bag", href: `/profiles/${owner}/purchases`, requiresAuth: true },
        { label: "관심목록", icon: "heart", href: `/profiles/${owner}/favs`, requiresAuth: true },
      ],
    },
    {
      title: "혈통",
      rows: [
        { label: "혈통관리", icon: "graph", href: "/bloodline-management" },
        {
          label: "혈통 만들기",
          icon: "card",
          href: "/bloodline-cards/create",
          requiresAuth: true,
        },
      ],
    },
    {
      title: "기타",
      rows: [
        { label: "설정", icon: "settings", href: "/settings" },
        { label: "고객센터", icon: "support", href: "/support" },
      ],
    },
  ];
}

function SideMenu({
  open,
  onClose,
  notificationUnread,
  installAvailable,
  installLoading,
  onInstall,
}: {
  open: boolean;
  onClose: () => void;
  notificationUnread: number;
  installAvailable: boolean;
  installLoading: boolean;
  onInstall: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const logout = useLogout();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const authed = Boolean(user);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const badgeLabel =
    notificationUnread > 0 ? (notificationUnread > 99 ? "99+" : String(notificationUnread)) : null;
  const sections = buildMenuSections(user?.id ?? null);

  return (
    <>
      {/* 오버레이 */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-50 bg-app-overlay transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* 패널 (우측 슬라이드, 폭 300) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        aria-hidden={!open}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[300px] max-w-[85vw] flex-col bg-app-elevated pt-[env(safe-area-inset-top)] transition-[transform,visibility] duration-300 ease-out",
          open ? "visible translate-x-0" : "invisible translate-x-full"
        )}
      >
        <div className="flex h-11 shrink-0 items-center justify-end pr-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full text-app-muted"
            aria-label="메뉴 닫기"
          >
            <StrokeIcon d={ICON.close} className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {/* 상단 프로필 */}
          {authed && user ? (
            <button
              type="button"
              onClick={() => go("/myPage")}
              className="flex w-full items-center gap-3 px-5 pb-5 text-left"
              aria-label="프로필 보기"
            >
              {user.avatar ? (
                <Image
                  src={makeImageUrl(user.avatar, "avatar")}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-app-surface text-[18px] font-bold text-app-muted">
                  {user.name?.trim().charAt(0) || "브"}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold text-app-text">{user.name}</span>
                <span className="mt-0.5 block text-[13px] text-app-muted">프로필 보기 ›</span>
              </span>
            </button>
          ) : (
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => go("/auth/login")}
                className="h-[52px] w-full rounded-md bg-app-brand text-[16px] font-semibold text-white"
              >
                로그인 / 회원가입
              </button>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.title}>
              <div className="h-2 bg-app-gap" />
              <p className="px-5 pb-1.5 pt-4 text-[13px] font-semibold text-app-muted">{section.title}</p>
              {section.rows.map((row) => {
                const active = pathname === row.href;
                return (
                  <button
                    key={row.label}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() =>
                      go(row.requiresAuth && !authed ? toLoginHref(row.href) : row.href)
                    }
                    className="flex h-12 w-full items-center gap-3 px-5 text-left text-app-text transition-colors hover:bg-app-surface"
                  >
                    <StrokeIcon d={MENU_ICONS[row.icon]} className="h-[22px] w-[22px]" strokeWidth={1.5} />
                    <span className={cn("flex-1 text-[15px]", active ? "font-bold" : "font-medium")}>
                      {row.label}
                    </span>
                    {row.badge && badgeLabel ? (
                      <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-app-brand px-[5px] text-[11px] font-bold text-white">
                        {badgeLabel}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {section.title === "기타" && installAvailable ? (
                <button
                  type="button"
                  onClick={onInstall}
                  disabled={installLoading}
                  className="flex h-12 w-full items-center gap-3 px-5 text-left text-app-text transition-colors hover:bg-app-surface disabled:opacity-60"
                >
                  <StrokeIcon d={MENU_ICONS.install} className="h-[22px] w-[22px]" strokeWidth={1.5} />
                  <span className="flex-1 text-[15px] font-medium">
                    {installLoading ? "설치 준비 중..." : "홈에 앱 설치하기"}
                  </span>
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {/* 하단 */}
        <div className="flex shrink-0 flex-col items-start gap-2 px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
          {authed ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                setLogoutConfirmOpen(true);
              }}
              className="py-1 text-[14px] text-app-muted"
            >
              로그아웃
            </button>
          ) : null}
          <p className="text-[12px] text-app-muted">버전 {APP_VERSION}</p>
        </div>
      </aside>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="로그아웃할까요?"
        confirmText="로그아웃"
        cancelText="취소"
        tone="danger"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          void logout();
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 헤더 알림 벨                                                         */
/* ------------------------------------------------------------------ */

/** 알림 벨: unread 면 app-danger 벨 + app-danger-soft 원 배경, 뱃지 99+. */
export function NotificationBell({ unread }: { unread: number }) {
  const hasUnread = unread > 0;
  return (
    <HeaderIconButton
      label="알림"
      href="/notifications"
      badge={hasUnread ? unread : null}
      className={hasUnread ? "bg-app-danger-soft text-app-danger hover:bg-app-danger-soft" : undefined}
    >
      <StrokeIcon d={ICON.bell} />
    </HeaderIconButton>
  );
}

/* ------------------------------------------------------------------ */
/* 레이아웃                                                             */
/* ------------------------------------------------------------------ */

export default function MainLayout({
  title,
  canGoBack,
  hasTabBar,
  children,
  seoTitle: _seoTitle,
  icon,
  showSearch,
  showHome,
  headerRight,
  headerVariant = "default",
}: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isToolPath = pathname?.startsWith("/tool");
  const [menuOpen, setMenuOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installLoading, setInstallLoading] = useState(false);
  const { user, isLoading: userLoading } = useUser();
  const { data: unreadData } = useSWR<UnreadCountResponse>(
    user ? "/api/chat/unread-count" : null,
    { revalidateOnFocus: false, refreshInterval: UNREAD_REFRESH_MS }
  );
  const { data: notificationUnreadData } = useSWR<UnreadCountResponse>(
    user ? "/api/notifications/unread-count" : null,
    { revalidateOnFocus: false, refreshInterval: UNREAD_REFRESH_MS }
  );
  void _seoTitle;

  const notificationUnread =
    notificationUnreadData?.success && notificationUnreadData.unreadCount > 0
      ? notificationUnreadData.unreadCount
      : 0;
  const chatUnread =
    unreadData?.success && unreadData.unreadCount > 0 ? unreadData.unreadCount : 0;
  // 사용자 정보를 받는 중에는 탭을 그대로 두고, 비로그인이 확정되면 로그인으로 보낸다.
  const loggedOut = !user && !userLoading;

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => setDeferredInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstallAppClick = async () => {
    if (!deferredInstallPrompt) return;
    try {
      setInstallLoading(true);
      setMenuOpen(false);
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
    } finally {
      setInstallLoading(false);
    }
  };

  const closeMenu = React.useCallback(() => setMenuOpen(false), []);

  const defaultRight = (
    <>
      <NotificationBell unread={notificationUnread} />
      <HeaderIconButton label="메뉴" onClick={() => setMenuOpen(true)}>
        <StrokeIcon d={ICON.menu} />
      </HeaderIconButton>
    </>
  );

  const renderHeader = () => {
    if (headerVariant === "none") return null;

    if (headerVariant === "profile") {
      return (
        <header className="sticky top-0 z-30 h-14 w-full bg-app-bg">
          <div className="mx-auto flex h-full max-w-xl items-center px-3">
            <HeaderIconButton label="뒤로가기" onClick={() => router.back()}>
              <StrokeIcon d={ICON.back} />
            </HeaderIconButton>
            <h1 className="ml-1 min-w-0 flex-1 truncate text-[18px] font-bold leading-6 text-app-text">
              {title ?? ""}
            </h1>
            {headerRight ? <div className="flex shrink-0 items-center">{headerRight}</div> : null}
          </div>
        </header>
      );
    }

    if (headerVariant === "chat-list") {
      return (
        <header className="sticky top-0 z-30 h-14 w-full bg-app-bg">
          <div className="mx-auto flex h-full max-w-xl items-center justify-between pl-4 pr-2">
            <h1 className="text-[18px] font-bold tracking-[-0.3px] text-app-text">{title}</h1>
            <div className="flex items-center gap-1">
              {headerRight}
              <NotificationBell unread={notificationUnread} />
            </div>
          </div>
        </header>
      );
    }

    return (
      <header className="sticky top-0 z-30 h-14 w-full border-b border-app-line bg-app-bg text-app-text">
        <div className="relative mx-auto flex h-full max-w-xl items-center justify-center">
          {canGoBack ? (
            <>
              <div className="absolute left-1 flex items-center">
                <HeaderIconButton label="뒤로가기" onClick={() => router.back()}>
                  <StrokeIcon d={ICON.back} />
                </HeaderIconButton>
                {showHome && !isToolPath ? (
                  <HeaderIconButton label="홈으로 가기" href="/">
                    <StrokeIcon d={ICON.homeNav} />
                  </HeaderIconButton>
                ) : null}
              </div>
              {!isToolPath ? (
                <div className="absolute right-2 flex items-center gap-0.5">
                  {headerRight ?? defaultRight}
                </div>
              ) : null}
            </>
          ) : null}
          {icon && !isToolPath ? (
            <>
              <Link href="/" className="absolute left-4 rounded-xl" aria-label="홈으로 가기">
                <Image
                  src={logo}
                  alt="로고"
                  width={32}
                  height={32}
                  priority
                  className="rounded-xl border border-app-border"
                />
              </Link>
              <div className="absolute right-2 flex items-center gap-0.5">
                {headerRight ?? (
                  <>
                    {showSearch ? (
                      <HeaderIconButton label="검색" href="/search">
                        <StrokeIcon d={ICON.search} />
                      </HeaderIconButton>
                    ) : null}
                    {defaultRight}
                  </>
                )}
              </div>
            </>
          ) : null}
          {!canGoBack && !icon && headerRight ? (
            <div className="absolute right-2 flex items-center gap-0.5">{headerRight}</div>
          ) : null}
          {title ? (
            <h1 className="max-w-[55%] truncate text-[16px] font-semibold tracking-[-0.02em] text-app-text">
              {title}
            </h1>
          ) : null}
        </div>
      </header>
    );
  };

  return (
    <div className="relative min-h-screen bg-app-bg">
      {renderHeader()}

      <SideMenu
        open={menuOpen}
        onClose={closeMenu}
        notificationUnread={notificationUnread}
        installAvailable={Boolean(deferredInstallPrompt)}
        installLoading={installLoading}
        onInstall={handleInstallAppClick}
      />

      {/* 확인하지 않은 경고·끝난 정지 안내(앱 docs/prd/admin-moderation.md S-5). 로그인했을 때만 조회한다. */}
      <SanctionNoticeModal enabled={Boolean(user)} />

      <div
        className={cn(
          "mx-auto max-w-xl",
          hasTabBar && !isToolPath
            ? "pb-[calc(72px+env(safe-area-inset-bottom))]"
            : "pb-6"
        )}
      >
        {children}
      </div>
      {hasTabBar && !isToolPath ? (
        <nav
          aria-label="하단 메뉴"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-app-line bg-app-bg pb-[env(safe-area-inset-bottom)]"
        >
          <div className="mx-auto grid h-14 max-w-xl grid-cols-5">
            {BOTTOM_NAV_ITEMS.map((item) => {
              const active = item.isActive(pathname || "");
              const href = item.requiresAuth && loggedOut ? toLoginHref(item.href) : item.href;
              const showChatBadge = item.href === "/chat" && chatUnread > 0;
              return (
                <Link
                  href={href}
                  key={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-0.5 transition-colors",
                    active ? "text-app-strong" : "text-app-muted"
                  )}
                >
                  <span className="relative inline-flex h-6 w-6 items-center justify-center">
                    <StrokeIcon d={item.d} className="h-6 w-6" strokeWidth={1.5} />
                    {showChatBadge ? (
                      <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-app-danger px-1 text-[10px] font-semibold leading-none text-white">
                        {chatUnread > 9 ? "9+" : chatUnread}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] leading-none tracking-tight",
                      active ? "font-semibold" : "font-medium"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
