import React from "react";
import MainLayout from "@components/features/MainLayout";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout title="프로필 수정" canGoBack>
      {children}
    </MainLayout>
  );
}
