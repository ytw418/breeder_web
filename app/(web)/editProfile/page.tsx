import React from "react";
import EditProfileClient from "./EditProfileClient";
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
  title: "프로필 수정 | 브리디",
  description: "브리디 사용자 프로필 수정 페이지입니다.",
};

const page = () => {
  return (
    <AuthGuard>
      <EditProfileClient />
    </AuthGuard>
  );
};

export default page;
