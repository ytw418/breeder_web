import type { Metadata } from "next";
import { Suspense } from "react";
import AuthGuard from "@components/auth/AuthGuard";
import WelcomeClient from "./WelcomeClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "시작하기",
  description: "이름·사진·동네를 정하고 같은 생물 키우는 브리더를 팔로우해 보세요.",
};

/** 가입 직후 '시작하기'(앱 src/app/welcome.tsx). 로그인 응답 isNewUser 면 로그인 직후 한 번 거친다. */
export default function WelcomePage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <WelcomeClient />
      </Suspense>
    </AuthGuard>
  );
}
