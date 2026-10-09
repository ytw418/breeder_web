import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BloodlineCardCreateClient from "../../../../bloodline-cards/create/BloodlineCardCreateClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "혈통 수정 | 브리디",
};

/** 혈통 수정(앱 bloodline-management/card/[cardId]/edit.tsx, PRD bloodline-v2.md S-3e). 폼은 만들기와 같다. */
export default async function BloodlineEditPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const id = Number(cardId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <BloodlineCardCreateClient editCardId={id} />;
}
