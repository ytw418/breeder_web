import type { Metadata } from "next";
import BloodlineSectionListClient from "../_components/BloodlineSectionListClient";

export const metadata: Metadata = {
  title: "내 혈통 목록 | 브리디",
  description: "지금 내가 가진 혈통을 확인하고 분양받은 분에게 출처 카드를 보내세요.",
  alternates: {
    canonical: "https://bredy.app/bloodline-management/my-bloodlines",
  },
};

export default function MyBloodlineListPage() {
  return <BloodlineSectionListClient mode="myBloodlines" />;
}
