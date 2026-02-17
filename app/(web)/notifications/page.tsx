import NotificationsClient from "./NotificationsClient";
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
  title: "알림 설정 | 브리디",
  description: "브리디 알림 목록 및 설정 페이지입니다.",
};

const NotificationsPage = () => {
  return <NotificationsClient />;
};

export default NotificationsPage;
