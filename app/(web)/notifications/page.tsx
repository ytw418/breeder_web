import NotificationsClient from "./NotificationsClient";
import AuthGuard from "@components/auth/AuthGuard";
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
  title: "알림 | 브리디",
  description: "브리디 알림 목록 페이지입니다.",
};

const NotificationsPage = () => {
  return (
    <AuthGuard>
      <NotificationsClient />
    </AuthGuard>
  );
};

export default NotificationsPage;
