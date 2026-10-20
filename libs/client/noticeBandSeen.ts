"use client";
/**
 * 띠를 누르거나 상세에서 연 공지 id(그 이하 공지는 다 본 것으로 친다) — 이 브라우저(localStorage)에 둔다.
 * 상세에서 연 공지도 여기에 남긴다 — unread-marks 는 올린 지 7일 지난 기록을 지워 14일 띠를 못 덮는다.
 * 규칙은 libs/shared/noticeBand.ts(앱 사본 src/lib/noticeBand.ts), 앱은 src/lib/noticeBandSeen.ts(SecureStore).
 * 서버 렌더와 첫 클라이언트 렌더는 '복원 전'(hydrated:false)이라 띠를 그리지 않는다(하이드레이션 일치·깜빡임 방지).
 */
import { useEffect, useSyncExternalStore } from "react";
import { parseBandSeenId } from "@libs/shared/noticeBand";

const KEY = "bredy:notice-band:seen-id";

type State = { hydrated: boolean; seenUpToId: number | null };
const SERVER_STATE: State = Object.freeze({ hydrated: false, seenUpToId: null });
let state: State = SERVER_STATE;
const listeners = new Set<() => void>();

function emit(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

function read(): number | null {
  try {
    return parseBandSeenId(window.localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 띠를 눌러 공지를 열 때와 공지 상세(PostClient)를 열 때 부른다. 더 큰 id 만 남긴다(복원 전이면 저장값과 비교). */
export function markNoticeBandSeen(id: number) {
  if (typeof window === "undefined") return;
  const current = state.hydrated ? state.seenUpToId : read();
  if (current != null && current >= id) return;
  try {
    window.localStorage.setItem(KEY, String(id));
  } catch {
    // 저장소가 막힌 브라우저는 이번 탭에서만 기억한다.
  }
  emit({ hydrated: true, seenUpToId: id });
}

export function useNoticeBandSeen(): State {
  useEffect(() => {
    if (!state.hydrated) emit({ hydrated: true, seenUpToId: read() });
  }, []);
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}
