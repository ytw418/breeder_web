import type { Metadata } from "next";
import BloodlineSectionListClient from "../_components/BloodlineSectionListClient";

export const metadata: Metadata = {
  title: "내 출처 카드 | 브리디",
  description: "내 혈통에서 만들어 내가 가진 출처 카드를 확인하세요.",
  alternates: {
    canonical: "https://bredy.app/bloodline-management/created-lines",
  },
};

export default function CreatedLineListPage() {
  return <BloodlineSectionListClient mode="createdLines" />;
}
