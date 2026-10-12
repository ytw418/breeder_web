/**
 * 헤더 알림 벨 점(인스타·스레드식): "알림 화면을 마지막으로 연 뒤 새 알림이 왔는가".
 * 앱 src/lib/notificationSeen.ts 와 같은 사본. 개별 알림 읽음 상태와는 따로 간다(알림 화면에 들어가도 읽음 처리하지 않는다).
 */

const toTime = (value: string | number | Date | null | undefined): number | null => {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : typeof value === "number" ? value : new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

/** 가장 최근 알림이 마지막으로 본 시각보다 뒤면 true. 알림이 없으면 false, 한 번도 안 봤으면 true. */
export function hasUnseen(
  latestCreatedAt: string | number | Date | null | undefined,
  lastSeenAt: string | number | Date | null | undefined
): boolean {
  const latest = toTime(latestCreatedAt);
  if (latest == null) return false;
  const seen = toTime(lastSeenAt);
  if (seen == null) return true;
  return latest > seen;
}

/** 헤더 점 판정. 안 읽은 알림이 없으면 점 없음. 서버가 최신 시각을 안 주면(구 서버) 한 번도 안 봤을 때만 점. */
export function showNotificationDot(input: {
  unreadCount: number;
  latestUnreadAt?: string | null;
  lastSeenAt: number | null;
}): boolean {
  if (input.unreadCount <= 0) return false;
  if (input.latestUnreadAt) return hasUnseen(input.latestUnreadAt, input.lastSeenAt);
  return input.lastSeenAt == null;
}
