"use client";

import { useEffect } from "react";
import { cn } from "@libs/client/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
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
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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

  if (!open) return null;

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
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
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
            className={cn(
              "h-10 rounded-xl text-sm font-semibold text-white transition-colors",
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
