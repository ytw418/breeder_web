"use client";

import { useEffect, useState } from "react";
import { cn } from "@libs/client/utils";
import { leaveChatCopy } from "@libs/shared/chatRoomSettings";

/**
 * 채팅방 나가기 확인 창(앱 LeaveChatDialog 와 같은 문구, 시안 chat-settings ②).
 * '○○님 차단하기'를 체크하면 확인 버튼이 '차단하고 나가기'가 된다. '나가기 전에 신고하기'는 나가지 않고 신고 시트로 보낸다.
 * 탈퇴 상대는 partnerName 없이, 이미 차단한 상대는 canBlock=false 로 부른다(체크 칸을 그리지 않는다).
 */
export function LeaveChatDialog({
  open,
  partnerName,
  canBlock,
  loading = false,
  onCancel,
  onConfirm,
  onReport,
}: {
  open: boolean;
  partnerName: string | null;
  canBlock: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (withBlock: boolean) => void;
  onReport?: () => void;
}) {
  const [withBlock, setWithBlock] = useState(false);
  const copy = leaveChatCopy(partnerName);

  useEffect(() => {
    if (open) setWithBlock(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onCancel, loading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-app-overlay"
        onClick={loading ? undefined : onCancel}
        aria-label="모달 닫기"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
        className="relative w-full max-w-sm rounded-2xl border border-app-border bg-app-elevated p-4 shadow-card"
      >
        <h3 className="text-[16px] font-semibold text-app-strong">
          {copy.title}
        </h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-app-muted">
          {copy.description}
        </p>

        {canBlock && partnerName ? (
          <>
            <label className="mt-3.5 flex cursor-pointer items-center gap-2 text-[14px] text-app-text">
              {/* 체크 상자는 직접 그린다(브라우저 기본 체크는 다크에서 표시가 묻힌다). input 은 보조기기용으로 남긴다. */}
              <input
                type="checkbox"
                checked={withBlock}
                onChange={(event) => setWithBlock(event.target.checked)}
                disabled={loading}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] peer-focus-visible:ring-2 peer-focus-visible:ring-app-brand",
                  withBlock
                    ? "border-app-inverse bg-app-inverse text-app-inverse-text"
                    : "border-app-caption",
                )}
              >
                {withBlock ? (
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : null}
              </span>
              {copy.blockLabel}
            </label>
            <p className="ml-7 mt-1 text-[12px] text-app-muted">
              {copy.blockHint}
            </p>
          </>
        ) : null}
        {partnerName && onReport ? (
          <div>
            <button
              type="button"
              onClick={onReport}
              disabled={loading}
              className="mt-3 text-[13px] text-app-muted"
            >
              {copy.reportLink}
            </button>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 rounded-xl border border-app-border bg-app-elevated text-sm font-semibold text-app-sub transition-colors hover:bg-app-surface disabled:opacity-50"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(canBlock && withBlock)}
            disabled={loading}
            aria-busy={loading || undefined}
            className={cn(
              "h-11 rounded-xl bg-app-danger text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {loading ? "처리 중..." : copy.confirm(canBlock && withBlock)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeaveChatDialog;
