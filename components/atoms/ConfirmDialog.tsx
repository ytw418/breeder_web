"use client";

import { useEffect, useState } from "react";
import { cn } from "@libs/client/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
  confirmKeyword?: string;
  confirmKeywordLabel?: string;
  /** 확인 요청 중. 버튼을 막고 확인 버튼에 진행 상태를 보인다. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 확인 창(앱 ConfirmDialog 와 같은 톤). 모바일은 아래, 넓은 화면은 가운데에 뜬다.
 * 확인 버튼: 기본 inverse 채움, danger 는 app-danger 채움.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "확인",
  cancelText = "취소",
  tone = "default",
  confirmKeyword = "",
  confirmKeywordLabel = "확인 키워드",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onCancel, loading]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setKeywordInput("");
    }
  }, [open, confirmKeyword]);

  if (!open) return null;

  const requiresKeyword = Boolean(confirmKeyword?.trim());
  const normalizedKeyword = String(confirmKeyword || "").trim();
  const canConfirm =
    !loading && (!requiresKeyword || keywordInput.trim() === normalizedKeyword);

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
        aria-label={title}
        className="relative w-full max-w-sm rounded-2xl border border-app-border bg-app-elevated p-4 shadow-card"
      >
        <h3 className="text-[16px] font-semibold text-app-strong">{title}</h3>
        {description ? (
          <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-app-muted">
            {description}
          </p>
        ) : null}
        {requiresKeyword ? (
          <div className="mt-3 rounded-xl border border-app-danger-soft bg-app-danger-soft px-3 py-2.5">
            <p className="text-xs font-semibold text-app-danger">
              {confirmKeywordLabel}: <span className="font-bold">{normalizedKeyword}</span>
            </p>
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder={`${normalizedKeyword} 입력`}
              className="mt-1.5 h-12 w-full rounded-lg border border-app-border bg-app-bg px-2.5 text-sm text-app-strong placeholder:text-app-caption outline-none focus:border-app-text focus:ring-0"
            />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 rounded-xl border border-app-border bg-app-elevated text-sm font-semibold text-app-sub transition-colors hover:bg-app-surface disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            aria-busy={loading || undefined}
            className={cn(
              "h-11 rounded-xl text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
              tone === "danger" ? "bg-app-danger text-white" : "bg-app-inverse text-app-inverse-text"
            )}
          >
            {loading ? "처리 중..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
