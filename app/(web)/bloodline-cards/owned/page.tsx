import type { Metadata } from "next";
import OwnedBloodlineCardsClient from "./OwnedBloodlineCardsClient";

export const metadata: Metadata = {
  title: "보유 혈통 리스트 | 브리디",
  description: "내가 보유한 혈통카드를 확인하고 공유합니다.",
};

export default function OwnedBloodlineCardsPage() {
  return <OwnedBloodlineCardsClient />;
}
