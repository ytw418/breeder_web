const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** KST 날짜를 UTC 자정 Date 로(@db.Date 컬럼 값). 동네 방문 기록·손 흔들어 인사 한도가 같이 쓴다. */
export function kstDate(now: Date, daysAgo = 0): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS - daysAgo * DAY_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}
