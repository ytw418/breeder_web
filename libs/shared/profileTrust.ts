/**
 * 프로필 신뢰 줄(앱 src/lib/profileTrust.ts 와 같은 사본 — 함께 고친다). 앱 docs/prd/profile.md v5.
 * "거래 완료 12 · 브리디 8개월차". 거래 후기는 아직 쓰는 곳이 없어 넣지 않는다.
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

/** 거래 완료(1건 이상일 때)와 가입 기간을 " · " 로 잇는다. 둘 다 없으면 null. */
export function profileTrustLine(
  user: { completedSales?: number | null; createdAt?: string | null },
  now: number = Date.now()
): string | null {
  const parts: string[] = [];
  if (user.completedSales && user.completedSales > 0) parts.push(`거래 완료 ${user.completedSales}`);
  if (user.createdAt) parts.push(bredyTenureLabel(monthsSince(user.createdAt, now)));
  return parts.length ? parts.join(" · ") : null;
}
