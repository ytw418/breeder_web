import type { Metadata } from "next";
import AuthGuard from "@components/auth/AuthGuard";
import BlockedUsersClient from "./BlockedUsersClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "차단 관리 | 브리디",
  description: "브리디에서 차단한 사용자를 관리합니다.",
};

export default function BlockedUsersPage() {
  return (
    <AuthGuard>
      <BlockedUsersClient />
    </AuthGuard>
  );
}
