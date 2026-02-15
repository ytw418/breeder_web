import type { Metadata } from "next";
import BloodlineManagementClient from "./BloodlineManagementClient";

export const metadata: Metadata = {
  title: "혈통관리 | 브리디",
  description: "혈통카드와 라인카드를 분리해 관리하고 발급/전송 이력을 확인하세요.",
  alternates: {
    canonical: "https://bredy.app/bloodline-management",
  },
};

export default function BloodlineManagementPage() {
  return <BloodlineManagementClient />;
}
