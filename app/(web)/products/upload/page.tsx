import React, { Suspense } from "react";
import UploadClient from "./UploadClient";
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
  title: "분양 등록 | 브리디",
  description: "로그인 사용자 전용 분양 등록 페이지입니다.",
};

const page = () => {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <UploadClient />
      </Suspense>
    </AuthGuard>
  );
};

export default page;
