import type { Metadata } from "next";
import BloodlineSectionListClient from "../_components/BloodlineSectionListClient";

export const metadata: Metadata = {
  title: "받은 카드 목록 | 브리디",
  description: "내가 받은 혈통/라인 카드를 목록으로 관리하고 상세로 이동하세요.",
  alternates: {
    canonical: "https://bredy.app/bloodline-management/received-cards",
  },
};

export default function ReceivedCardsListPage() {
  return <BloodlineSectionListClient mode="receivedCards" />;
}
