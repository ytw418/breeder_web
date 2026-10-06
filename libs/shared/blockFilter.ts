/**
 * 서버 공개 캐시 응답(/api/home/feed?scope=public, /api/ranking, /api/rankings/*)은
 * 차단 사용자를 거르지 않으므로 클라이언트에서 /api/blocks 목록으로 거른다.
 * 앱 bredy_app src/lib/moderation/block-filter.ts 의 withoutBlocked 와 같은 규칙.
 */

/** getOwnerId 가 차단한 사용자인 항목을 뺀다. 작성자를 알 수 없는 항목은 남긴다. */
export function withoutBlocked<T>(
  items: readonly T[],
  blocked: ReadonlySet<number>,
  getOwnerId: (item: T) => number | null | undefined
): T[] {
  if (blocked.size === 0) return [...items];
  return items.filter((item) => {
    const id = getOwnerId(item);
    return id == null || !blocked.has(id);
  });
}
