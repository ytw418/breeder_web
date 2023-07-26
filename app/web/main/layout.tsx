import React from "react";
import MainLayout from "@components/layout";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout title="홈" hasTabBar={true}>
      {children}
    </MainLayout>
  );
}
