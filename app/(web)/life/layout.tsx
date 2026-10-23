import React from "react";
import MainLayout from "@components/features/MainLayout";

/** 반려생활 탭(앱 docs/prd/home-v2.md S-3). 헤더는 다른 탭 루트와 같다(로고 + 검색). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout title="반려생활" hasTabBar icon showSearch>
      {children}
    </MainLayout>
  );
}
