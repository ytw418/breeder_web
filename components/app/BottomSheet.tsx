"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@libs/client/utils";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  /** 시트 아래 고정 영역(주 CTA 등). */
  footer?: ReactNode;
  ariaLabel?: string;
  /** 배경(overlay)을 누르면 닫을지. 기본 true. */
  dismissOnBackdrop?: boolean;
  className?: string;
}

/**
 * 아래에서 올라오는 시트(앱 ReportSheet·PostActionSheet 톤).
 * overlay + app-elevated 패널(위 모서리 16) + 40x4 핸들 + 하단 safe-area.
 * Escape 로 닫히고, 열려 있는 동안 body 스크롤을 잠근다. 닫히면 아무것도 그리지 않는다.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  ariaLabel,
  dismissOnBackdrop = true,
  className,
}: BottomSheetProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end justify-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-app-overlay"
        onClick={dismissOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={!ariaLabel && title ? titleId : undefined}
        className={cn(
          "relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-t-2xl bg-app-elevated pb-[env(safe-area-inset-bottom)]",
          className
        )}
      >
        <div className="flex h-10 shrink-0 items-center justify-center">
          <span className="h-1 w-10 rounded-full bg-app-border" />
        </div>
        {title ? (
          <h2
            id={titleId}
            className="shrink-0 px-4 pb-2 text-[18px] font-bold tracking-[-0.3px] text-app-text"
          >
            {title}
          </h2>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="shrink-0 px-4 pb-4 pt-3">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export default BottomSheet;
