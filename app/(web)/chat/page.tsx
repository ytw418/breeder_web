import React from "react";
import ChatsClient from "../chat/ChatClient";
import { getSessionUser } from "@libs/server/getUser";
import { redirect } from "next/navigation";
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

const Page = async () => {
  const user = await getSessionUser();

  if (!user) {
    return redirect("/auth/login");
  }
  return <ChatsClient />;
};

export default Page;
