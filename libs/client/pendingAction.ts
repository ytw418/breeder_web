"use client";
/**
 * 로그인 벽에서 누르려던 동작을 로그인 뒤 이어 한다(2026-10-21 감사 17번, 토론 투표의 bredy:pending-vote 를 넓힘).
 * 비로그인으로 팔로우·찜·채팅을 누르면 setPendingAction 으로 sessionStorage 에 기억하고 로그인 화면을 연다.
 * 로그인하고 그 화면으로 돌아와 같은 대상의 usePendingAction 이 한 번 실행한다. 로그인을 그만두면(닫기·둘러보기)
 * 지우고, 10분이 지나면 버린다. 앱 bredy_app src/lib/auth/pendingAction.ts 와 같은 규칙(앱은 모듈 변수).
 */
import { useEffect, useRef } from "react";
import useUser from "hooks/useUser";

export type PendingActionKind = "follow" | "fav" | "chat";

export interface PendingAction {
  kind: PendingActionKind;
  targetId: number;
  returnPath: string;
}

const PENDING_ACTION_KEY = "bredy:pending-action";
const PENDING_TTL_MS = 10 * 60 * 1000;

export function setPendingAction(action: PendingAction) {
  try {
    sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify({ ...action, at: Date.now() }));
  } catch {
    // 저장소를 못 쓰면 이어 하기만 빠진다.
  }
}

export function clearPendingAction() {
  try {
    sessionStorage.removeItem(PENDING_ACTION_KEY);
  } catch {
    // noop
  }
}

/** 같은 종류·대상의 기억해 둔 동작을 꺼낸다(한 번만). 없거나 오래됐으면 null. */
function takePendingAction(kind: PendingActionKind, targetId: number): PendingAction | null {
  let saved: (PendingAction & { at?: number }) | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(PENDING_ACTION_KEY) ?? "null");
  } catch {
    saved = null;
  }
  if (!saved) return null;
  if (!saved.at || Date.now() - saved.at > PENDING_TTL_MS) {
    clearPendingAction();
    return null;
  }
  if (saved.kind !== kind || saved.targetId !== targetId) return null;
  clearPendingAction();
  return saved;
}

/** 로그인돼 있고 enabled 조건이 맞으면 기억해 둔 같은 동작을 한 번 실행한다. */
export function usePendingAction(
  kind: PendingActionKind,
  targetId: number | null | undefined,
  run: () => void,
  enabled = true
) {
  const { user } = useUser();
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  const userId = user?.id;
  useEffect(() => {
    if (!userId || !enabled || targetId == null) return;
    if (!takePendingAction(kind, targetId)) return;
    setTimeout(() => runRef.current(), 0);
  }, [userId, enabled, kind, targetId]);
}
