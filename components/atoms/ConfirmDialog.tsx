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
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "확인",
  cancelText = "취소",
  tone = "default",
  confirmKeyword = "",
  confirmKeywordLabel = "확인 키워드",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onCancel]);

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
  const canConfirm = !requiresKeyword || keywordInput.trim() === normalizedKeyword;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onCancel}
        aria-label="모달 닫기"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="app-card relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4"
      >
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description ? (
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-500">{description}</p>
        ) : null}
        {requiresKeyword ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-rose-900">
              {confirmKeywordLabel}: <span className="font-black">{normalizedKeyword}</span>
            </p>
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder={`${normalizedKeyword} 입력`}
              className="mt-1.5 h-9 w-full rounded-lg border border-rose-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={cn(
              "h-10 rounded-xl text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              tone === "danger"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-slate-900 hover:bg-slate-800"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
