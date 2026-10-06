import type { Metadata } from "next";
import AuthGuard from "@components/auth/AuthGuard";
import DeleteAccountClient from "./DeleteAccountClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "회원탈퇴 | 브리디",
  description: "브리디 회원탈퇴 페이지입니다.",
};

export default function DeleteAccountPage() {
  return (
    <AuthGuard>
      <DeleteAccountClient />
    </AuthGuard>
  );
}
