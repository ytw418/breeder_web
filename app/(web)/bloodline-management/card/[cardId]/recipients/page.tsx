import type { Metadata } from "next";
import RecipientsClient from "./RecipientsClient";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "받은 사람 | 브리디",
};

/** 받은 사람 목록(앱 bloodline-management/card/[cardId]/recipients.tsx, PRD bloodline-v2.md S-4a). */
export default async function RecipientsPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <RecipientsClient cardId={cardId} />;
}
