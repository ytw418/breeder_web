/**
 * 목록 '안 본 글' 빨간 점 규칙 — 게시글·상품·경매 공통.
 * - 앱 `src/lib/unread-marks.ts` 와 같은 파일이다. 고칠 때는 두 곳을 같이 고치고
 *   웹 `npx jest unreadMarks` + 앱 `npm run test:unread-marks` 로 확인한다.
 * - 플랫폼 import 를 두지 않는다(앱 테스트가 Node 타입 스트리핑으로 돌린다. enum·namespace 금지).
 *
 * 규칙(docs/prd/feed-engagement.md):
 * - 최근 7일 안에 올라왔고, 이 기기에서 상세를 연 적이 없고, 내가 올린 것이 아니면 '안 봄'.
 * - 상세를 열면 그 자리에서 '봄'으로 바뀐다. 7일이 지난 글은 점도 기록도 없다.
 * - 기록은 기기에 둔다(앱 SecureStore, 웹 localStorage). 종류마다 id → 올린 시각(분)을 저장하고,
 *   7일이 지난 것은 지우며, 최근 것부터 UNREAD_MAX_ENTRIES 개만 둔다(SecureStore 값 2KB 제한).
 */

export type UnreadKind = "post" | "product" | "auction";

export const UNREAD_KINDS: readonly UnreadKind[] = ["post", "product", "auction"];

export const UNREAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** 종류마다 남기는 기록 수. 한 항목이 JSON 으로 16자 안팎이라 2KB 안에 들어간다. */
export const UNREAD_MAX_ENTRIES = 100;

/** id → 올린 시각(epoch 분) */
export type SeenMap = Readonly<Record<string, number>>;

export interface UnreadItem {
  id: number;
  createdAt: string | Date;
  /** 올린 사람 id. 내가 올린 건 점을 달지 않는다. */
  authorId?: number | null;
}

const MINUTE_MS = 60 * 1000;

function createdAtMs(createdAt: string | Date): number {
  return createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
}

/** 아직 점을 달 수 있는 기간(최근 7일) 안인지. 시각을 못 읽으면 false. */
export function isWithinUnreadWindow(createdAt: string | Date, now: number): boolean {
  const ms = createdAtMs(createdAt);
  if (Number.isNaN(ms)) return false;
  return now - ms <= UNREAD_WINDOW_MS;
}

export function isUnreadItem(
  item: UnreadItem,
  seen: SeenMap,
  viewerId: number | null | undefined,
  now: number
): boolean {
  if (viewerId != null && item.authorId != null && item.authorId === viewerId) return false;
  if (!isWithinUnreadWindow(item.createdAt, now)) return false;
  return !Object.prototype.hasOwnProperty.call(seen, String(item.id));
}

/** 7일 지난 기록을 지우고, 올린 시각이 최근인 것부터 UNREAD_MAX_ENTRIES 개만 남긴다. */
export function pruneSeen(seen: SeenMap, now: number): SeenMap {
  const minMinute = Math.floor((now - UNREAD_WINDOW_MS) / MINUTE_MS);
  const kept = Object.entries(seen)
    .filter(([, minute]) => Number.isFinite(minute) && minute >= minMinute)
    .sort((a, b) => b[1] - a[1])
    .slice(0, UNREAD_MAX_ENTRIES);
  return Object.fromEntries(kept);
}

/** 상세를 열었을 때. 이미 봤거나 7일이 지난 글이면 같은 객체를 돌려준다(저장 생략 판단용). */
export function markSeen(seen: SeenMap, item: Pick<UnreadItem, "id" | "createdAt">, now: number): SeenMap {
  if (!isWithinUnreadWindow(item.createdAt, now)) return seen;
  const key = String(item.id);
  if (Object.prototype.hasOwnProperty.call(seen, key)) return seen;
  const minute = Math.floor(createdAtMs(item.createdAt) / MINUTE_MS);
  return pruneSeen({ ...seen, [key]: minute }, now);
}

export function serializeSeen(seen: SeenMap): string {
  return JSON.stringify(seen);
}

/** 저장값을 읽는다. 깨졌으면 빈 기록. */
export function parseSeen(raw: string | null | undefined, now: number): SeenMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number"
    );
    return pruneSeen(Object.fromEntries(entries), now);
  } catch {
    return {};
  }
}
