"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@libs/client/utils";
import {
  SANCTION_REASON_CODES,
  SANCTION_REASON_LABEL,
  type SanctionReasonCode,
} from "@libs/shared/sanction";

/**
 * 관리자 콘텐츠 숨김·숨김 해제·삭제 확인 창. 사유(작성자 알림에 들어감)와 내부 메모를 받는다.
 * 모양은 ConfirmDialog 와 같다. 삭제는 키워드를 입력해야 실행된다(앱 docs/prd/admin-moderation.md S-4).
 */

export interface ContentActionOptions {
  title: string;
  description?: string;
  confirmText: string;
  tone?: "default" | "danger";
  /** 숨김 해제는 사유가 필요 없다 */
  askReason?: boolean;
  confirmKeyword?: string;
}

export interface ContentActionResult {
  reasonCode: SanctionReasonCode | null;
  reason: string;
}

type DialogState = ContentActionOptions & { open: boolean };

function ContentActionDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: DialogState;
  onCancel: () => void;
  onConfirm: (result: ContentActionResult) => void;
}) {
  const [reasonCode, setReasonCode] = useState<SanctionReasonCode | "">("");
  const [reason, setReason] = useState("");
  const [keyword, setKeyword] = useState("");
  const askReason = state.askReason !== false;
  const requiredKeyword = state.confirmKeyword?.trim() ?? "";
  const canConfirm = (!askReason || reasonCode !== "") && (!requiredKeyword || keyword.trim() === requiredKeyword);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-app-overlay" onClick={onCancel} aria-label="모달 닫기" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={state.title}
        className="relative w-full max-w-sm rounded-2xl border border-app-border bg-app-elevated p-4 shadow-card"
      >
        <h3 className="text-[16px] font-semibold text-app-strong">{state.title}</h3>
        {state.description ? (
          <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-app-muted">{state.description}</p>
        ) : null}

        {askReason ? (
          <label className="mt-3 block">
            <span className="text-xs font-semibold text-app-sub">사유 (작성자 알림에 들어가요)</span>
            <select
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value as SanctionReasonCode)}
              className="mt-1 h-11 w-full rounded-lg border border-app-border bg-app-bg px-2.5 text-sm text-app-strong"
            >
              <option value="">사유를 골라 주세요</option>
              {SANCTION_REASON_CODES.map((code) => (
                <option key={code} value={code}>
                  {SANCTION_REASON_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="mt-3 block">
          <span className="text-xs font-semibold text-app-sub">내부 메모 (선택, 운영자만 봄)</span>
          <textarea
            value={reason}
            maxLength={500}
            rows={2}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 w-full rounded-lg border border-app-border bg-app-bg px-2.5 py-2 text-sm text-app-strong"
          />
        </label>
        {requiredKeyword ? (
          <div className="mt-3 rounded-xl border border-app-danger-soft bg-app-danger-soft px-3 py-2.5">
            <p className="text-xs font-semibold text-app-danger">
              실행 키워드: <span className="font-bold">{requiredKeyword}</span>
            </p>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={`${requiredKeyword} 입력`}
              className="mt-1.5 h-12 w-full rounded-lg border border-app-border bg-app-bg px-2.5 text-sm text-app-strong outline-none focus:border-app-text"
            />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl border border-app-border bg-app-elevated text-sm font-semibold text-app-sub hover:bg-app-surface"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm({ reasonCode: reasonCode || null, reason: reason.trim() })}
            className={cn(
              "h-11 rounded-xl text-sm font-semibold disabled:opacity-40",
              state.tone === "danger" ? "bg-app-danger text-white" : "bg-app-inverse text-app-inverse-text"
            )}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function useContentActionDialog() {
  const [state, setState] = useState<DialogState | null>(null);
  const resolveRef = useRef<((value: ContentActionResult | null) => void) | null>(null);

  const close = useCallback((result: ContentActionResult | null) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState(null);
  }, []);

  const ask = useCallback((options: ContentActionOptions) => {
    return new Promise<ContentActionResult | null>((resolve) => {
      resolveRef.current?.(null);
      resolveRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  useEffect(() => () => resolveRef.current?.(null), []);

  const dialog = useMemo(
    () =>
      state ? (
        <ContentActionDialog state={state} onCancel={() => close(null)} onConfirm={(result) => close(result)} />
      ) : null,
    [close, state]
  );

  return { ask, dialog };
}
