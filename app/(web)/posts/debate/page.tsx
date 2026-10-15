import React, { Suspense } from "react";
import type { Metadata } from "next";

import AuthGuard from "@components/auth/AuthGuard";
import DebateComposeClient from "./DebateComposeClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "토론 열기 | 브리디",
  description: "궁금한 걸 찬반으로 물어보는 토론 열기 화면입니다.",
};

const page = () => (
  <AuthGuard>
    {/* ?edit=·?species= 를 읽어 Suspense 로 감싼다. */}
    <Suspense fallback={null}>
      <DebateComposeClient />
    </Suspense>
  </AuthGuard>
);

export default page;
