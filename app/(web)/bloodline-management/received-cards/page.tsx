import type { Metadata } from "next";
import BloodlineSectionListClient from "../_components/BloodlineSectionListClient";

export const metadata: Metadata = {
  title: "받은 출처 카드 | 브리디",
  description: "다른 브리더에게 받은 혈통·출처 카드를 확인하세요.",
  alternates: {
    canonical: "https://bredy.app/bloodline-management/received-cards",
  },
};

export default function ReceivedCardsListPage() {
  return <BloodlineSectionListClient mode="receivedCards" />;
}
