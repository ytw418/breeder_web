import React from "react";
import MainLayout from "@components/features/layout";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout title="브리더" hasTabBar={true} icon>
      {children}
    </MainLayout>
  );
}
