import type { Metadata } from "next";
import BloodlineSectionListClient from "../_components/BloodlineSectionListClient";

export const metadata: Metadata = {
  title: "내 혈통 목록 | 브리디",
  description: "내가 만든 원본 혈통카드를 한눈에 확인하고 보내기/라인 발급을 바로 처리하세요.",
  alternates: {
    canonical: "https://bredy.app/bloodline-management/my-bloodlines",
  },
};

export default function MyBloodlineListPage() {
  return <BloodlineSectionListClient mode="myBloodlines" />;
}
