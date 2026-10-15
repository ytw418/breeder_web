import React, { Suspense } from "react";
import type { Metadata } from "next";

import AuthGuard from "@components/auth/AuthGuard";
import TownClient from "./TownClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "동네 사랑방 | 브리디",
  description: "반경 50km 이웃 브리더와 이야기하는 동네 사랑방입니다.",
};

const page = () => (
  <AuthGuard>
    {/* ?focus= 를 읽어 Suspense 로 감싼다(알림의 답장 메시지로 스크롤). */}
    <Suspense fallback={null}>
      <TownClient />
    </Suspense>
  </AuthGuard>
);

export default page;
