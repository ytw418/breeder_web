"use client";

import Head from "next/head";
import Link from "next/link";
import React, { useState } from "react";
import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import Image from "@components/atoms/Image";
import logo from "@images/logo.png";
import useSWR from "swr";
import { cn } from "@libs/client/utils";

interface LayoutProps {
  title?: string;
  canGoBack?: boolean;
  hasTabBar?: boolean;
  children: React.ReactNode;
  seoTitle?: string;
  icon?: boolean;
  showSearch?: boolean;
  showHome?: boolean;
}

interface UnreadCountResponse {
  success: boolean;
  unreadCount: number;
}

/** 사이드 메뉴 아이템 */
const MENU_ITEMS = [
  {
    label: "홈",
    href: "/",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    ),
  },
  {
    label: "알림",
    href: "/notifications",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    ),
  },
  {
    label: "랭킹",
    href: "/ranking",
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
    label: "설정",
    href: "/settings",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
    ),
    iconExtra: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    ),
  },
];

export default function MainLayout({
  title,
  canGoBack,
  hasTabBar,
  children,
  seoTitle,
  icon,
  showSearch,
  showHome,
}: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shouldFetchUnread, setShouldFetchUnread] = useState(true);
  const { data: unreadData } = useSWR<UnreadCountResponse>(
    shouldFetchUnread ? "/api/chat/unread-count" : null,
    {
      onError: (swrError: Error & { status?: number }) => {
        // 비로그인 상태에서는 동일 401 요청을 반복하지 않는다.
        if (swrError?.status === 401 || swrError?.status === 403) {
          setShouldFetchUnread(false);
        }
      },
      revalidateOnFocus: false,
    }
  );

  const onClick = () => {
    router.back();
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/70">
      <Head>
        <title>브리디 | {seoTitle}</title>
      </Head>
      <div className="sticky top-0 z-30 h-14 w-full border-b border-slate-200/80 bg-white/90 text-base font-medium text-slate-800 backdrop-blur-xl shadow-[0_1px_0_rgba(15,23,42,0.04)] flex items-center justify-center">
        {canGoBack ? (
          <>
            <button
              onClick={onClick}
              className="absolute left-4 rounded-full p-2 transition-colors hover:bg-slate-100"
              aria-label="뒤로가기"
            >
              <svg
                className="w-6 h-6 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
            </button>
            {showHome ? (
              <Link
                href="/"
                className="absolute left-14 rounded-full p-2 transition-colors hover:bg-slate-100"
                aria-label="홈으로 가기"
              >
                <svg
                  className="w-6 h-6 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 12l9-7 9 7v8a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1v-8z"
                  />
                </svg>
              </Link>
            ) : null}
            {/* 햄버거 메뉴 버튼 */}
            <button
              onClick={() => setMenuOpen(true)}
              className="absolute right-4 rounded-full p-2 transition-colors hover:bg-slate-100"
              aria-label="메뉴"
            >
              <svg
                className="w-6 h-6 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            </button>
          </>
        ) : null}
        {icon && (
          <>
            <Link href={"/"} className="absolute left-4 rounded-xl">
              <Image
                src={logo}
                alt="로고"
                width={32}
                height={32}
                className="rounded-lg ring-1 ring-slate-200"
              />
            </Link>
            <div className="absolute right-4 flex items-center gap-1">
              {/* 검색 버튼 */}
              {showSearch && (
                <Link
                  href="/search"
                  className="rounded-full p-2 transition-colors hover:bg-slate-100"
                  aria-label="검색"
                >
                  <svg
                    className="w-6 h-6 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    ></path>
                  </svg>
                </Link>
              )}
              {/* 햄버거 메뉴 버튼 */}
              <button
                onClick={() => setMenuOpen(true)}
                className="rounded-full p-2 transition-colors hover:bg-slate-100"
                aria-label="메뉴"
              >
                <svg
                  className="w-6 h-6 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  ></path>
                </svg>
              </button>
            </div>
          </>
        )}
        {title ? (
          <h1
            className={clsx(
              "app-title-md",
              canGoBack ? "mx-auto" : ""
            )}
          >
            {title}
          </h1>
        ) : null}
      </div>

      {/* 사이드 메뉴 오버레이 */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 transition-opacity"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* 사이드 메뉴 패널 */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-72 border-l border-slate-200 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out",
          menuOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* 메뉴 헤더 */}
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-5">
          <span className="app-title-md">메뉴</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="rounded-full p-2 transition-colors hover:bg-slate-100"
          >
            <svg
              className="w-5 h-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 메뉴 항목 */}
        <nav className="py-2">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "text-primary bg-primary/5"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {item.icon}
                {item.iconExtra}
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div
        className={clsx(
          "max-w-xl mx-auto",
          hasTabBar ? "pb-[86px]" : "pb-6"
        )}
      >
        {children}
      </div>
      {hasTabBar ? (
        <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200/80 bg-white/92 backdrop-blur-xl">
          <div className="max-w-xl mx-auto px-4 pb-safe">
            <div className="flex justify-between items-center py-3">
              <Link
                href="/"
                className={clsx(
                  "flex flex-col items-center space-y-1.5 w-full",
                  pathname === "/"
                    ? "text-primary"
                    : "text-slate-500 hover:text-slate-900 transition-colors"
                )}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  ></path>
                </svg>
                <span className="text-xs font-medium">홈</span>
              </Link>
              <Link
                href="/posts"
                className={clsx(
                  "flex flex-col items-center space-y-1.5 w-full",
                  pathname === "/posts"
                    ? "text-primary"
                    : "text-slate-500 hover:text-slate-900 transition-colors"
                )}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  ></path>
                </svg>
                <span className="text-xs font-medium">곤충생활</span>
              </Link>
              <Link
                href="/auctions"
                className={clsx(
                  "flex flex-col items-center space-y-1.5 w-full",
                  pathname?.startsWith("/auctions")
                    ? "text-primary"
                    : "text-slate-500 hover:text-slate-900 transition-colors"
                )}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span className="text-xs font-medium">경매</span>
              </Link>
              <Link
                href="/chat"
                className={clsx(
                  "flex flex-col items-center space-y-1.5 w-full relative",
                  pathname === "/chat"
                    ? "text-primary"
                    : "text-slate-500 hover:text-slate-900 transition-colors"
                )}
              >
                {unreadData?.success && unreadData.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {unreadData.unreadCount}
                  </span>
                )}
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  ></path>
                </svg>
                <span className="text-xs font-medium">채팅</span>
              </Link>
              <Link
                href="/myPage"
                className={clsx(
                  "flex flex-col items-center space-y-1.5 w-full",
                  pathname === "/myPage"
                    ? "text-primary"
                    : "text-slate-500 hover:text-slate-900 transition-colors"
                )}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  ></path>
                </svg>
                <span className="text-xs font-medium">마이페이지</span>
              </Link>
            </div>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
