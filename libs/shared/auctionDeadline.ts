/**
 * 경매 상세 남은 시간 옆에 붙이는 마감 시각(2026-10-21 디자인 리뷰 — '14시간 7분 26초 남음 · 21일 밤 11:05 마감').
 * 남은 시간만으로는 언제 끝나는지 셈해야 해서 마감 시각을 같이 쓴다. 기기 시간대와 상관없이 KST 로 쓴다.
 * - 날짜: 지금과 같은 달이면 '21일', 다른 달이면 '11월 2일'.
 * - 시간대: 새벽(0~5시)·오전(6~11시)·낮(12시)·오후(13~17시)·저녁(18~20시)·밤(21~23시), 시는 12시간제('밤 11:05').
 * 웹 libs/shared/auctionDeadline.ts = 앱 src/lib/auctionDeadline.ts 사본이라 함께 고친다(웹 jest·앱 node --test scripts/test-auction-deadline.mjs).
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const dayPeriod = (hour: number): string => {
  if (hour < 6) return "새벽";
  if (hour < 12) return "오전";
  if (hour === 12) return "낮";
  if (hour < 18) return "오후";
  if (hour < 21) return "저녁";
  return "밤";
};

/** '21일 밤 11:05 마감'. endAt 을 읽을 수 없으면 빈 문자열. */
export function formatAuctionDeadline(endAt: string | Date, nowMs: number): string {
  const endMs = new Date(endAt).getTime();
  if (Number.isNaN(endMs)) return "";
  const end = new Date(endMs + KST_OFFSET_MS);
  const now = new Date(nowMs + KST_OFFSET_MS);
  const sameMonth = end.getUTCFullYear() === now.getUTCFullYear() && end.getUTCMonth() === now.getUTCMonth();
  const day = sameMonth ? `${end.getUTCDate()}일` : `${end.getUTCMonth() + 1}월 ${end.getUTCDate()}일`;
  const hour = end.getUTCHours();
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minutes = String(end.getUTCMinutes()).padStart(2, "0");
  return `${day} ${dayPeriod(hour)} ${hour12}:${minutes} 마감`;
}
