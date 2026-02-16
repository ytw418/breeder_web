import type { Metadata } from "next";
import BloodlineSectionListClient from "../_components/BloodlineSectionListClient";

export const metadata: Metadata = {
  title: "내 라인 목록 | 브리디",
  description: "내가 만든 라인카드를 관리하고, 필요 시 다시 보내거나 발급할 수 있습니다.",
  alternates: {
    canonical: "https://bredy.app/bloodline-management/created-lines",
  },
};

export default function CreatedLineListPage() {
  return <BloodlineSectionListClient mode="createdLines" />;
}
