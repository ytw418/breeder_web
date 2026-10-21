import type { Metadata } from "next";
import ReviewsClient from "./ReviewsClient";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "받은 거래 후기",
};

/**
 * 받은 거래 후기(앱 profiles/[id]/reviews.tsx, 앱 docs/prd/trade-review.md S-8). 프로필 분양 탭 '받은 거래 후기 N ›'·
 * 사이드 메뉴 '거래 > 받은 거래 후기'로 들어온다. 목록은 화면이 GET /api/users/:id/reviews 로 받는다.
 */
export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewsClient id={id} />;
}
