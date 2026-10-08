import type { Metadata } from "next";
import BloodlineManagementEventsClient from "./BloodlineManagementEventsClient";

export const metadata: Metadata = {
  title: "혈통 이벤트 | 브리디",
  description: "혈통을 만들고 보낸 기록을 한곳에서 확인하세요.",
  alternates: {
    canonical: "https://bredy.app/bloodline-management/events",
  },
};

export default function BloodlineManagementEventsPage() {
  return <BloodlineManagementEventsClient />;
}
