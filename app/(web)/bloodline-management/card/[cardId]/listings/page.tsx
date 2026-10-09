import type { Metadata } from "next";
import ListingsClient from "./ListingsClient";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "이 혈통 분양글 | 브리디",
};

/** 이 혈통 분양글(앱 bloodline-management/card/[cardId]/listings.tsx, PRD bloodline-v2.md S-4b). */
export default async function ListingsPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <ListingsClient cardId={cardId} />;
}
