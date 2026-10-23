import type { Metadata } from "next";
import { Suspense } from "react";
import OnboardingClient from "./OnboardingClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "키우는 아이 고르기",
  description: "브리디에서 키우는 아이를 고르면 홈·반려생활·분양이 그 아이들 소식을 먼저 보여 줘요.",
};

/**
 * 첫 로그인 직후 한 번 거치는 온보딩(앱은 설치 후 첫 실행 — 대응표 O-1). "어떤 아이를 키우시나요?" 카드가 먼저고
 * (docs/prd/pet-space.md §4), 건너뛰면 전체 보기.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingClient />
    </Suspense>
  );
}
