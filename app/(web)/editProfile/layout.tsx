import React from "react";
import MainLayout from "@components/layout";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout title="프로필 수정" hasTabBar={true} canGoBack>
      {children}
    </MainLayout>
  );
}
