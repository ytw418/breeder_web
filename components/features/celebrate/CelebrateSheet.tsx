"use client";
/**
 * 글 등록 보상 시트(community-vibe §3.4 F-4). 글·분양글·경매 등록 성공 직후, 상세로 가기 전에 0.8초 보인다.
 * 높이 180, 위 모서리 r16, 주황 체크 원 40 → "반려생활 234번째 글" 18/700 → 사실 한 줄(서버 celebrate.fact).
 * 0.8초 뒤 저절로 닫히고, 누르면 바로 닫힌다. 닫히면 onDone 을 한 번만 부른다(그 뒤 상세로 이동).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Celebrate } from "@libs/shared/communityVibe";

export const CELEBRATE_AUTO_CLOSE_MS = 800;

export type CelebrateKind = "post" | "product" | "auction";

export function celebrateTitle(kind: CelebrateKind, ordinal: number): string {
  const n = ordinal.toLocaleString();
  if (kind === "product") return `브리디 ${n}번째 분양글`;
  if (kind === "auction") return `브리디 ${n}번째 경매`;
  return `반려생활 ${n}번째 글`;
}

/** 서버가 사실을 못 고르면(null) 종류별 기본 문구. */
export function celebrateFact(kind: CelebrateKind, fact: string | null): string | null {
  if (fact) return fact;
  if (kind === "product") return "홈 '지금 올라온 분양'에 바로 보여요";
  if (kind === "auction") return "경매 목록 맨 위에 바로 보여요";
  return "반려생활 목록 맨 위에 바로 보여요";
}

export default function CelebrateSheet({
  open,
  kind,
  celebrate,
  onDone,
}: {
  open: boolean;
  kind: CelebrateKind;
  celebrate: Celebrate | null;
  onDone: () => void;
}) {
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }, []);

  useEffect(() => {
    if (!open) {
      doneRef.current = false;
      return;
    }
    const timer = window.setTimeout(finish, CELEBRATE_AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open, finish]);

  if (!open || !celebrate || typeof document === "undefined") return null;
  const fact = celebrateFact(kind, celebrate.fact);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center" onClick={finish} data-testid="celebrate-sheet">
      <div aria-hidden="true" className="absolute inset-0 bg-app-overlay" />
      <div
        role="status"
        aria-live="polite"
        className="relative flex h-[180px] w-full max-w-xl flex-col items-center justify-center rounded-t-2xl bg-app-elevated px-6 pb-[env(safe-area-inset-bottom)] text-center"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-app-brand text-white">
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 5 5L20 7" />
          </svg>
        </span>
        <p className="app-t-section mt-3">{celebrateTitle(kind, celebrate.ordinal)}</p>
        {fact ? <p className="app-t-meta mt-1">{fact}</p> : null}
      </div>
    </div>,
    document.body
  );
}

/**
 * 등록 화면용: `show(celebrate, then)` 을 부르면 시트를 띄우고 닫힐 때 then 을 부른다.
 * celebrate 가 없으면(구 서버) 바로 then.
 */
export function useCelebrateSheet(kind: CelebrateKind) {
  const [state, setState] = useState<{ celebrate: Celebrate; then: () => void } | null>(null);
  const show = useCallback((celebrate: Celebrate | null | undefined, then: () => void) => {
    if (celebrate && typeof celebrate.ordinal === "number") setState({ celebrate, then });
    else then();
  }, []);
  const sheet = (
    <CelebrateSheet
      open={Boolean(state)}
      kind={kind}
      celebrate={state?.celebrate ?? null}
      onDone={() => {
        const then = state?.then;
        setState(null);
        then?.();
      }}
    />
  );
  return { show, sheet };
}
