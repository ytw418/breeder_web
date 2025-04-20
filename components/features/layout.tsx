"use client";

import Head from "next/head";
import Link from "next/link";
import React from "react";
import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import logo from "@images/logo.png";
import useSWR from "swr";

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

export default function Layout({
  title,
  canGoBack,
  hasTabBar,
  children,
  seoTitle,
  icon,
}: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
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
        ) : null}
        {icon && (
          <Link href={"/"} className="absolute left-4">
            <Image
              src={logo}
              alt="로고"
              width={32}
              height={32}
              className="rounded-lg"
            />
          </Link>
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
      <div className={clsx("max-w-xl mx-auto", hasTabBar ? "pb-[81px]" : "")}>
        {children}
      </div>
      {hasTabBar ? (
        <nav className="bg-white/80 backdrop-blur-sm border-t border-gray-100 fixed bottom-0 w-full px-4 pb-5 pt-3 flex justify-between text-xs">
          <Link
            href="/"
            className={clsx(
              "flex flex-col items-center space-y-1.5",
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
            <span className="font-medium">홈</span>
          </Link>
          <Link
            href="/posts"
            className={clsx(
              "flex flex-col items-center space-y-1.5",
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
            <span className="font-medium">곤충생활</span>
          </Link>
          <Link
            href="/chat"
            className={clsx(
              "flex flex-col items-center space-y-1.5 relative",
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
            <span className="font-medium">채팅</span>
          </Link>
          <Link
            href="/myPage"
            className={clsx(
              "flex flex-col items-center space-y-1.5",
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
            <span className="font-medium">마이페이지</span>
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
