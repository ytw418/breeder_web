import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BloodlineCardDetailClient from "./BloodlineCardDetailClient";

type Params = {
  cardId: string;
};

export const metadata: Metadata = {
  title: "혈통 카드 상세 | 브리디",
  description: "혈통/라인 카드 상세와 타임라인, 액션을 확인하세요.",
};

export default function BloodlineCardDetailPage({
  params: { cardId },
}: {
  params: Params;
}) {
  const parsedCardId = Number(cardId);
  if (!Number.isInteger(parsedCardId) || parsedCardId <= 0) {
    notFound();
  }

  return <BloodlineCardDetailClient cardId={parsedCardId} />;
}
