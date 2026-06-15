import React from "react";
import ChatsClient from "../chat/ChatClient";
import AuthGuard from "@components/auth/AuthGuard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  title: "채팅 | 브리디",
  description: "로그인 사용자 전용 채팅 목록 페이지입니다.",
};

const Page = () => {
  return (
    <AuthGuard>
      <ChatsClient />
    </AuthGuard>
  );
};

export default Page;
