"use client";
/**
 * 알림 화면을 마지막으로 연 시각(localStorage `bredy:notifications:seenAt`).
 * 알림 화면이 열리면 markNotificationsSeen() → 같은 탭은 이벤트, 다른 탭은 storage 이벤트로 모든 헤더 점이 바로 사라진다.
 */
import { useSyncExternalStore } from "react";

export const NOTIFICATIONS_SEEN_KEY = "bredy:notifications:seenAt";
const EVENT = "bredy:notifications-seen";

export function readNotificationsSeenAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_SEEN_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function markNotificationsSeen(now: number = Date.now()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTIFICATIONS_SEEN_KEY, String(now));
  } catch {
    // 저장이 막혀도 이 탭에는 알린다.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === NOTIFICATIONS_SEEN_KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** 마지막으로 알림 화면을 연 시각(ms). 서버 렌더·처음엔 null. */
export function useNotificationsSeenAt(): number | null {
  return useSyncExternalStore(subscribe, readNotificationsSeenAt, () => null);
}
