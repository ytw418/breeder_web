"use client";

import Head from "next/head";
import Link from "next/link";
import React from "react";
import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import logo from "@images/logo.png";

interface LayoutProps {
  title?: string;
  canGoBack?: boolean;
  hasTabBar?: boolean;
  children: React.ReactNode;
  seoTitle?: string;
  icon?: boolean;
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
  const onClick = () => {
    router.back();
  };
  return (
    <div>
      <Head>
        <title>브리더 | {seoTitle}</title>
      </Head>
      <div className="sticky top-0 z-10 w-full bg-white h-12 justify-center text-base px-10 font-medium text-gray-800 flex items-center">
        {canGoBack ? (
          <button onClick={onClick} className="absolute left-4">
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
                d="M15 19l-7-7 7-7"
              ></path>
            </svg>
          </button>
        ) : null}
        {icon && (
          <Link href={"/"} className="absolute left-4">
            <Image src={logo} alt="로고" width={30} height={30} />
          </Link>
        )}
        {title ? (
          <span className={clsx(canGoBack ? "mx-auto" : "", "")}>{title}</span>
        ) : null}
      </div>
      <div className={clsx("max-w-xl mx-auto", hasTabBar ? "pb-[81px]" : "")}>
        {children}
      </div>
      {hasTabBar ? (
        <nav className="bg-white text-gray-700 border-t fixed bottom-0 w-full px-4 pb-5 pt-3 flex justify-between text-xs">
          <Link
            href="/"
            className={clsx(
              "flex flex-col items-center space-y-2 ",
              pathname === "/"
                ? "text-orange-500"
                : "hover:text-gray-500 transition-colors"
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
            <span>홈</span>
          </Link>
          {/* <Link
            href="/community"
            className={clsx(
              "flex flex-col items-center space-y-2 ",
              pathname === "/community"
                ? "text-orange-500"
                : "hover:text-gray-500 transition-colors"
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
            <span>곤충생활</span>
          </Link> */}
          <Link
            href="/chat"
            className={clsx(
              "flex flex-col items-center space-y-2 ",
              pathname === "/chat"
                ? "text-orange-500"
                : "hover:text-gray-500 transition-colors"
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
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              ></path>
            </svg>
            <span>채팅</span>
          </Link>

          <Link
            href="/myPage"
            className={clsx(
              "flex flex-col items-center space-y-2 ",
              pathname === "/myPage"
                ? "text-orange-500"
                : "hover:text-gray-500 transition-colors"
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
            <span>마이페이지</span>
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
