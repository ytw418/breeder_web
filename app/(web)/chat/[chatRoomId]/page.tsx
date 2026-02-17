import React from "react";
import ChatRoomClient from "./ChatRoomClient";
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
  title: "채팅방 | 브리디",
  description: "로그인 사용자 전용 채팅방 페이지입니다.",
};

const Page = () => {
  return <ChatRoomClient />;
};

export default Page;
