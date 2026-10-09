import type { Metadata } from "next";
import { Suspense } from "react";
import CategoryScopePicker from "@components/features/category/CategoryScopePicker";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "관심 카테고리 고르기 | 브리디",
  description: "브리디에서 관심 있는 분야를 고르면 홈·반려생활·TOP 브리더가 그 분야만 보여요.",
};

/** 첫 로그인 직후 한 번 거치는 관심 카테고리 온보딩(앱은 설치 후 첫 실행 — 대응표 O-1). 건너뛰면 전체 보기. */
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <CategoryScopePicker mode="onboarding" />
    </Suspense>
  );
}
