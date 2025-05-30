import React from "react";
import MainLayout from "@components/features/MainLayout";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout title="마이페이지" hasTabBar={true} icon>
      {children}
    </MainLayout>
  );
}
