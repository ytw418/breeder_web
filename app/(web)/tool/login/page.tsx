import type { Metadata } from "next";
import LoginClient from "../../../auth/login/LoginClient";

export const metadata: Metadata = {
  title: "로그인 | 경매 폼 생성기",
  description: "경매 폼 생성기 이용을 위한 로그인 페이지입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ToolLoginPage() {
  return <LoginClient />;
}

