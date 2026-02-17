import React from "react";
import MainLayout from "@components/features/MainLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout title="마이페이지" hasTabBar={true} icon>
      {children}
    </MainLayout>
  );
}
