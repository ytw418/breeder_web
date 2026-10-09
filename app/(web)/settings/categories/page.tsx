import type { Metadata } from "next";
import { Suspense } from "react";
import CategoryScopePicker from "@components/features/category/CategoryScopePicker";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "관심 카테고리 | 브리디",
  description: "홈·반려생활·TOP 브리더에 보일 관심 분야를 고정합니다.",
};

/** 설정 > 관심 카테고리(홈 범위 바를 눌러도 여기로 온다). 비로그인도 이 브라우저에 고정할 수 있다. */
export default function CategorySettingsPage() {
  return (
    <Suspense fallback={null}>
      <CategoryScopePicker mode="settings" />
    </Suspense>
  );
}
