import client from "@libs/server/client";

/**
 * 신뢰 줄 "거래 완료 N"(앱 docs/prd/profile.md v5)의 서버 집계. 프로필(GET /api/users/:id)과
 * 채팅방 헤더의 상대 멤버(GET /api/chat/:id, 2026-10-21 감사 9번)가 같이 쓴다.
 * 남이 보는 분양내역 기준(지우거나 숨긴 분양글 제외) + 지금도 분양완료인 분양글만 센다.
 */
export function countCompletedSales(userId: number): Promise<number> {
  return client.sale.count({
    where: {
      userId,
      status: "completed",
      product: { isDeleted: false, isHidden: false, status: "판매완료" },
    },
  });
}

/**
 * 신뢰 줄 "후기 N"(앱 docs/prd/trade-review.md §3.5): 받은 거래 후기 수. 분양글에 달린 후기만 세고(옛 Review 행 제외),
 * 운영자가 숨긴 후기와 숨긴 분양글의 후기는 뺀다. 분양자가 지운 분양글의 후기는 남겨 센다(지워서 후기를 없애지 못하게).
 */
export function countTradeReviews(userId: number): Promise<number> {
  return client.review.count({
    where: {
      createdForId: userId,
      isHidden: false,
      productId: { not: null },
      product: { isHidden: false },
    },
  });
}
