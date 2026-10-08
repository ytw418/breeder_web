import type { Metadata } from "next";
import BloodlineManagementClient from "./BloodlineManagementClient";

export const metadata: Metadata = {
  title: "혈통관리 | 브리디",
  description: "내 혈통과 받은 출처 카드를 관리하고 보낸 이력을 확인하세요.",
  alternates: {
    canonical: "https://bredy.app/bloodline-management",
  },
};

export default function BloodlineManagementPage() {
  return <BloodlineManagementClient />;
}
