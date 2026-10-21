/**
 * 프로필 신뢰 줄(앱 src/lib/profileTrust.ts 와 같은 사본 — 함께 고친다). 앱 docs/prd/profile.md v5.
 * "거래 완료 12 · 후기 3 · 브리디 8개월차". 후기 N 은 받은 거래 후기 수(2026-10-21, 앱 docs/prd/trade-review.md).
 * 표시만 한다(누르는 곳 없음). 좁은 폭에서는 뒤(동네)부터 잘린다.
 */

/** 가입한 뒤 지난 달 수(달력 기준, 날짜가 못 미치면 한 달 덜). 미래·잘못된 날짜는 0. */
export function monthsSince(createdAt: string, now: number = Date.now()): number {
  const from = new Date(createdAt);
  const to = new Date(now);
  if (Number.isNaN(from.getTime()) || from.getTime() > to.getTime()) return 0;
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

/** 0 → "브리디 첫 달", 1~11 → "브리디 N개월차", 12 이상 → "브리디 N년차". */
export function bredyTenureLabel(months: number): string {
  if (months <= 0) return "브리디 첫 달";
  if (months < 12) return `브리디 ${months}개월차`;
  return `브리디 ${Math.floor(months / 12)}년차`;
}

/**
 * 거래 완료·후기(각각 1 이상일 때)·가입 기간·동네 라벨을 " · " 로 잇는다. 모두 없으면 null.
 * regionLabel 은 공개한 동네만 넘긴다(예: "브리디 1개월차 · 구로구", 앱 community-vibe §3.8).
 */
export function profileTrustLine(
  user: {
    completedSales?: number | null;
    tradeReviews?: number | null;
    createdAt?: string | null;
    regionLabel?: string | null;
  },
  now: number = Date.now()
): string | null {
  const parts: string[] = [];
  if (user.completedSales && user.completedSales > 0) parts.push(`거래 완료 ${user.completedSales}`);
  if (user.tradeReviews && user.tradeReviews > 0) parts.push(`후기 ${user.tradeReviews}`);
  if (user.createdAt) parts.push(bredyTenureLabel(monthsSince(user.createdAt, now)));
  if (user.regionLabel?.trim()) parts.push(user.regionLabel.trim());
  return parts.length ? parts.join(" · ") : null;
}
