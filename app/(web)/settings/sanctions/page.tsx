import type { Metadata } from "next";
import AuthGuard from "@components/auth/AuthGuard";
import SanctionsClient from "./SanctionsClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "내 제재 내역 | 브리디",
  description: "브리디에서 받은 경고·이용 정지 내역을 확인합니다.",
};

export default function SanctionsPage() {
  return (
    <AuthGuard>
      <SanctionsClient />
    </AuthGuard>
  );
}
