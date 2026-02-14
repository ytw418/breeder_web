import type { Metadata } from "next";
import NotificationsClient from "../../notifications/NotificationsClient";

export const metadata: Metadata = {
  title: "알림 | 경매 폼 생성기",
  description: "경매 폼 생성기 관련 알림을 확인합니다.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "https://bredy.app/notifications",
  },
};

export default function ToolNotificationsPage() {
  return <NotificationsClient />;
}

