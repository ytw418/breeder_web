import client from "./client";

/**
 * 마지막 활동 시각(User.lastActiveAt, 커뮤니티 감사 #22). 로그인한 요청이 들어오면 KST 하루 한 번만 갱신한다.
 * 주간 요약 푸시(libs/server/weeklyDigest.ts)와 운영자 발송 'N일 미접속' 대상이 이 값을 본다.
 * - 이미 오늘(KST) 값이면 쓰지 않는다. 같은 인스턴스에서 같은 사람은 5분 안에 다시 쓰지 않는다(첫 요청 몇 개가 겹칠 때).
 * - 응답을 기다리게 하지 않고, 실패해도 인증에는 영향이 없다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_TOUCH_MS = 5 * 60 * 1000;
const RECENT_TOUCH_MAX = 5000;

const recentTouches = new Map<number, number>();

/** now 가 속한 KST 날짜의 0시(UTC 기준 Date). */
export function kstTodayStart(now: Date = new Date()): Date {
  const kst = now.getTime() + KST_OFFSET_MS;
  return new Date(Math.floor(kst / DAY_MS) * DAY_MS - KST_OFFSET_MS);
}

export function needsLastActiveTouch(lastActiveAt: Date | null | undefined, now: Date = new Date()): boolean {
  return !lastActiveAt || lastActiveAt.getTime() < kstTodayStart(now).getTime();
}

export function touchLastActive(
  userId: number,
  lastActiveAt: Date | null | undefined,
  now: Date = new Date()
): void {
  if (!needsLastActiveTouch(lastActiveAt, now)) return;
  const touchedAt = recentTouches.get(userId);
  if (touchedAt !== undefined && now.getTime() - touchedAt < RECENT_TOUCH_MS) return;
  if (recentTouches.size >= RECENT_TOUCH_MAX) recentTouches.clear();
  recentTouches.set(userId, now.getTime());
  try {
    // Prisma 쿼리는 then/catch 를 붙여야 실행된다.
    client.user
      .update({ where: { id: userId }, data: { lastActiveAt: now }, select: { id: true } })
      .catch((error: unknown) => console.error("[lastActive] update failed:", error));
  } catch (error) {
    console.error("[lastActive] update failed:", error);
  }
}
