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
}

interface UnreadCountResponse {
  success: boolean;
  unreadCount: number;
}

/** 사이드 메뉴 아이템 */
const MENU_ITEMS = [
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
    label: "검색",
    href: "/search",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    ),
  },
  {
    label: "마이페이지",
    href: "/myPage",
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
}: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: unreadData } = useSWR<UnreadCountResponse>(
    "/api/chat/unread-count"
  );

  const onClick = () => {
    router.back();
  };

  return (
    <div>
      <Head>
        <title>브리더 | {seoTitle}</title>
      </Head>
      <div className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 h-14 flex items-center justify-center text-base font-medium text-gray-800">
        {canGoBack ? (
          <>
            <button
              onClick={onClick}
              className="absolute left-4 p-2 rounded-full hover:bg-gray-50 transition-colors"
            >
              <svg
                className="w-6 h-6 text-gray-600"
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
            <Link
              href="/"
              className="absolute right-4 p-2 rounded-full hover:bg-gray-50 transition-colors"
              aria-label="홈으로 이동"
            >
              <svg
                className="w-6 h-6 text-gray-600"
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
            </Link>
          </>
        ) : null}
        {icon && (
          <>
            <Link href={"/"} className="absolute left-4">
              <Image
                src={logo}
                alt="로고"
                width={32}
                height={32}
                className="rounded-lg"
              />
            </Link>
            {/* 햄버거 메뉴 버튼 */}
            <button
              onClick={() => setMenuOpen(true)}
              className="absolute right-4 p-2 rounded-full hover:bg-gray-50 transition-colors"
              aria-label="메뉴"
            >
              <svg
                className="w-6 h-6 text-gray-600"
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
        )}
        {title ? (
          <h1
            className={clsx(
              "text-lg font-semibold tracking-tight",
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
          className="fixed inset-0 z-50 bg-black/40 transition-opacity"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* 사이드 메뉴 패널 */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out",
          menuOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* 메뉴 헤더 */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-100">
          <span className="text-lg font-semibold text-gray-900">메뉴</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 rounded-full hover:bg-gray-50 transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-500"
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
                  : "text-gray-700 hover:bg-gray-50"
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

      <div className={clsx("max-w-xl mx-auto", hasTabBar ? "pb-[81px]" : "")}>
        {children}
      </div>
      {hasTabBar ? (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-100">
          <div className="max-w-xl mx-auto px-4 pb-safe">
            <div className="flex justify-between items-center py-3">
              <Link
                href="/"
                className={clsx(
                  "flex flex-col items-center space-y-1.5 w-full",
                  pathname === "/"
                    ? "text-primary"
                    : "text-gray-600 hover:text-gray-900 transition-colors"
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
                    : "text-gray-600 hover:text-gray-900 transition-colors"
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
                    : "text-gray-600 hover:text-gray-900 transition-colors"
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
                    : "text-gray-600 hover:text-gray-900 transition-colors"
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
                    : "text-gray-600 hover:text-gray-900 transition-colors"
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
