import type { Metadata } from "next";
import AuthGuard from "@components/auth/AuthGuard";
import NotificationSettingsClient from "./NotificationSettingsClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "알림 종류",
  description: "받을 알림 종류와 방해 금지 시간을 정합니다.",
};

export default function NotificationSettingsPage() {
  return (
    <AuthGuard>
      <NotificationSettingsClient />
    </AuthGuard>
  );
}
