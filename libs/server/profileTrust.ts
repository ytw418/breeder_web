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
