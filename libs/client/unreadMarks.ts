"use client";
/**
 * 목록 '안 본 글' 빨간 점 — 이 브라우저(localStorage)에 '상세를 연 글'을 기록한다.
 * 규칙은 libs/shared/unread-marks.ts(앱과 같은 파일), 앱은 src/lib/unreadStore.ts(SecureStore).
 *
 * - 서버 렌더와 첫 클라이언트 렌더는 '복원 전'(hydrated:false)이라 점을 그리지 않는다(하이드레이션 일치).
 *   useSeenMarks 가 마운트되면서 localStorage 를 읽어 hydrated:true 로 바꾼다.
 * - 다른 탭에서 본 글도 storage 이벤트로 바로 반영한다.
 */
import { useEffect, useSyncExternalStore } from "react";
import useUser from "hooks/useUser";
import {
  UNREAD_KINDS,
  isUnreadItem,
  markSeen,
  parseSeen,
  serializeSeen,
  type SeenMap,
  type UnreadItem,
  type UnreadKind,
} from "@libs/shared/unread-marks";

export interface SeenMarksState {
  hydrated: boolean;
  seen: Readonly<Record<UnreadKind, SeenMap>>;
  /** 기록을 읽거나 바꾼 시각. 렌더 중에 Date.now() 를 부르지 않으려고 여기서 '지금'을 준다(7일 판정용이라 몇 분 낡아도 된다). */
  now: number;
}

export const unreadStorageKey = (kind: UnreadKind) => `bredy:seen:${kind}`;

const SERVER_STATE: SeenMarksState = Object.freeze({
  hydrated: false,
  seen: Object.freeze({ post: {}, product: {}, auction: {} }),
  now: 0,
});

let state: SeenMarksState = SERVER_STATE;
const listeners = new Set<() => void>();

function emit(next: SeenMarksState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function readAll(): SeenMarksState {
  const now = Date.now();
  const seen = {} as Record<UnreadKind, SeenMap>;
  for (const kind of UNREAD_KINDS) {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(unreadStorageKey(kind));
    } catch {
      raw = null;
    }
    seen[kind] = parseSeen(raw, now);
  }
  return { hydrated: true, seen, now };
}

export function hydrateSeenMarks() {
  if (typeof window === "undefined" || state.hydrated) return;
  emit(readAll());
}

function onStorage(event: StorageEvent) {
  if (event.key && event.key.startsWith("bredy:seen:")) emit(readAll());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** 상세를 열었을 때 부른다. 이미 봤거나 7일 지난 글이면 아무것도 하지 않는다. */
export function markItemSeen(kind: UnreadKind, item: Pick<UnreadItem, "id" | "createdAt">) {
  if (typeof window === "undefined") return;
  const current = state.hydrated ? state : readAll();
  const now = Date.now();
  const next = markSeen(current.seen[kind], item, now);
  if (next === current.seen[kind] && current === state) return;
  try {
    window.localStorage.setItem(unreadStorageKey(kind), serializeSeen(next));
  } catch {
    // 저장소가 막힌 브라우저(사생활 보호 모드 등)는 이번 탭에서만 기억한다.
  }
  emit({ hydrated: true, seen: { ...current.seen, [kind]: next }, now });
}

export function useSeenMarks(): SeenMarksState {
  useEffect(() => {
    hydrateSeenMarks();
  }, []);
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

/** 카드 하나의 빨간 점 여부. 복원 전·내 글·7일 지난 글은 false. */
export function useIsUnread(kind: UnreadKind, item: UnreadItem): boolean {
  const marks = useSeenMarks();
  const { user } = useUser();
  if (!marks.hydrated) return false;
  return isUnreadItem(item, marks.seen[kind], user?.id, marks.now);
}

/** 상세 화면: 데이터가 오면 한 번 '봄'으로 기록한다. */
export function useMarkSeenOnView(
  kind: UnreadKind,
  item: Pick<UnreadItem, "id" | "createdAt"> | null | undefined
) {
  const id = item?.id;
  const createdAt = item?.createdAt ? String(item.createdAt) : undefined;
  useEffect(() => {
    if (id == null || !createdAt) return;
    markItemSeen(kind, { id, createdAt });
  }, [kind, id, createdAt]);
}
