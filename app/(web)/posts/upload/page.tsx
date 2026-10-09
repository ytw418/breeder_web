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
  title: "게시글 작성 | 브리디",
  description: "로그인 사용자 전용 게시글 업로드 페이지입니다.",
};

const page = () => {
  return (
    <AuthGuard>
      {/* UploadClient 가 useSearchParams(?category=)를 읽어 Suspense 로 감싼다. */}
      <Suspense fallback={null}>
        <UploadClient />
      </Suspense>
    </AuthGuard>
  );
};

export default page;
