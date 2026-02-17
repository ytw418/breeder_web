import SettingsClient from "./SettingsClient";
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
  title: "계정 설정 | 브리디",
  description: "브리디 계정 설정 페이지입니다.",
};

const SettingsPage = () => {
  return <SettingsClient />;
};

export default SettingsPage;
