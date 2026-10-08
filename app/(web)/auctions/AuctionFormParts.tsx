"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "@components/atoms/Image";
import { PriceInput } from "@components/app/PriceInput";
import { authFetch } from "@libs/client/authFetch";
import { cn, makeImageUrl } from "@libs/client/utils";
import {
  AUCTION_BID_INCREMENT_RANGE_TEXT,
  AUCTION_MAX_BID_INCREMENT,
  isBidIncrementValid,
} from "@libs/auctionRules";

/** 경매 등록·수정 폼 공용 조각(앱 AuctionCreateForm / edit.tsx 와 같은 치수). */

export const DURATION_PRESETS = [
  { label: "1시간", hours: 1 },
  { label: "3시간", hours: 3 },
  { label: "24시간", hours: 24 },
  { label: "48시간", hours: 48 },
  { label: "72시간", hours: 72 },
];

export const FIELD_INPUT_CLASS =
  "h-12 w-full rounded-lg border bg-app-bg px-3.5 text-[15px] text-app-text placeholder:text-app-caption focus:border-app-text focus:outline-none focus:ring-0 disabled:opacity-60";
export const FIELD_TEXTAREA_CLASS =
  "w-full resize-none rounded-lg border bg-app-bg px-3.5 py-3 text-[15px] leading-[22px] text-app-text placeholder:text-app-caption focus:border-app-text focus:outline-none focus:ring-0 disabled:opacity-60";

export const fieldBorder = (hasError?: boolean) => (hasError ? "border-app-danger" : "border-app-border");

export const formatConfirmDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Cloudflare 이미지 업로드(/api/files 로 받은 업로드 URL). 성공하면 이미지 id. */
export async function uploadImageFile(file: File, failMessage = "이미지 업로드에 실패했습니다."): Promise<string> {
  const urlRes = await authFetch("/api/files");
  const urlData = await urlRes.json().catch(() => null);
  if (!urlRes.ok || !urlData?.uploadURL) throw new Error(failMessage);
  const form = new FormData();
  form.append("file", file);
  const uploadRes = await fetch(urlData.uploadURL, { method: "POST", body: form });
  const uploadData = await uploadRes.json().catch(() => null);
  if (!uploadRes.ok || !uploadData?.success || !uploadData?.result?.id) throw new Error(failMessage);
  return uploadData.result.id as string;
}

export function FieldLabel({ label, caption, htmlFor }: { label: string; caption?: string; htmlFor?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <label htmlFor={htmlFor} className="text-[15px] font-semibold text-app-text">
        {label}
      </label>
      {caption ? <span className="text-[13px] text-app-muted">{caption}</span> : null}
    </div>
  );
}

export function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[13px] text-app-danger">{message}</p>;
}

export function HelpText({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[13px] text-app-muted">{children}</p>;
}

export const BID_INCREMENT_ERROR = `최소 입찰 단위는 ${AUCTION_BID_INCREMENT_RANGE_TEXT}로 정해주세요.`;

/**
 * 최소 입찰 단위 입력 상태(앱 useBidIncrementInput). 직접 고치기 전에는 base(등록: 시작가 추천값,
 * 수정: 저장값)를 따르고, 비운 채 칸을 나가면 다시 base 를 따른다.
 */
export function useBidIncrementInput(base: number) {
  const [input, setInput] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const value = touched ? input : base;
  return {
    value,
    touched,
    isValid: value !== null && isBidIncrementValid(value),
    onChange: (next: number | null) => {
      setTouched(true);
      setInput(next);
    },
    onBlur: () => {
      if (input === null) setTouched(false);
    },
  };
}

/** 최소 입찰 단위 입력칸(시작가와 같은 PriceInput). 판매자가 정하고, 입찰은 현재가에서 이 단위로 올라간다. */
export function BidIncrementField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur: () => void;
  error?: string;
}) {
  return (
    <div>
      <FieldLabel label="최소 입찰 단위" htmlFor="auction-bid-increment" />
      <PriceInput
        id="auction-bid-increment"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        max={AUCTION_MAX_BID_INCREMENT}
        prefix="₩"
        placeholder="1,000"
        className={error ? "border-app-danger" : undefined}
      />
      <HelpText>입찰가는 이 금액 단위로 올라가요. {AUCTION_BID_INCREMENT_RANGE_TEXT}로 정할 수 있어요.</HelpText>
      <ErrorText message={error} />
    </div>
  );
}

/** 폼 칩(앱 Chip): h32 r16 px14 14px 500, 선택 text 채움. */
export function FormChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl border px-3.5 text-[14px] font-medium",
        active ? "border-app-text bg-app-text text-app-bg" : "border-app-border bg-app-bg text-app-muted"
      )}
    >
      {label}
    </button>
  );
}

export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex gap-1.5 overflow-x-auto scrollbar-hide", className)}>{children}</div>;
}

/** 동의 체크박스 행(앱 CheckboxRow): 20px 주황 체크 + 15/22 글자. */
export function AgreeRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-start gap-2.5 text-left"
    >
      <span
        className={cn(
          "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded border",
          checked ? "border-app-brand bg-app-brand text-white" : "border-app-border bg-app-bg"
        )}
      >
        {checked ? (
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m4.5 12.75 6 6 9-13.5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className="flex-1 text-[15px] leading-[22px] text-app-text">{label}</span>
    </button>
  );
}

/** 사진 추가 타일(80, 카메라 + n/N). */
export function PhotoAddTile({
  count,
  max,
  uploading,
  onFiles,
}: {
  count: number;
  max: number;
  uploading: boolean;
  onFiles: (files: FileList) => void;
}) {
  return (
    <label
      aria-label="사진 추가"
      className={cn(
        "flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-app-border bg-app-bg text-app-text",
        uploading && "pointer-events-none"
      )}
    >
      {uploading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-app-border border-t-app-brand" />
      ) : (
        <>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316ZM16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[13px] text-app-muted">
            {count}/{max}
          </span>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={uploading}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </label>
  );
}

/** 사진 타일(80, 오른쪽 위 22px 삭제). */
export function PhotoTile({ id, index, onRemove }: { id: string; index: number; onRemove: () => void }) {
  return (
    <div className="relative h-20 w-20 shrink-0 rounded-md bg-app-placeholder">
      <Image
        src={makeImageUrl(id, "avatar")}
        alt={`사진 ${index + 1}`}
        width={80}
        height={80}
        className="h-20 w-20 rounded-md object-cover"
      />
      <button
        type="button"
        aria-label={`사진 ${index + 1} 삭제`}
        onClick={onRemove}
        className="absolute -right-1.5 -top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-app-text text-app-bg"
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 18 18 6M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/** 52px 시트 버튼(앱 SheetButton). */
export function SheetButton({
  label,
  tone,
  disabled,
  fill,
  onClick,
}: {
  label: string;
  tone: "primary" | "ghost";
  disabled?: boolean;
  fill?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-[52px] rounded-md text-[16px] font-semibold disabled:opacity-60",
        fill && "flex-1",
        tone === "primary" ? "bg-app-brand text-white" : "bg-app-surface text-app-text"
      )}
    >
      {label}
    </button>
  );
}

/** 가운데 모달(앱 Modal fade): overlay + max-w 360 r12 elevated p20. Escape·바깥 누르면 onClose. */
export function CenterModal({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-5">
      <button type="button" aria-label={`${label} 닫기`} onClick={onClose} className="absolute inset-0 bg-app-overlay" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative w-full max-w-[360px] rounded-xl border border-app-border bg-app-elevated p-5 dark:border-app-border"
      >
        {children}
      </div>
    </div>
  );
}

/** 하단 고정 CTA 바(앱 KeyboardStickyView 대응): 위 1px 선 + 오류 문구 + 52px 버튼. */
export function BottomCta({
  label,
  disabled,
  onClick,
  errorText,
  type = "button",
}: {
  label: string;
  disabled: boolean;
  onClick?: () => void;
  errorText?: string;
  type?: "button" | "submit";
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-40 border-t border-app-line bg-app-bg">
      <div className="mx-auto max-w-xl px-5 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
        {errorText ? <p className="mb-2 text-[13px] text-app-danger">{errorText}</p> : null}
        <button
          type={type}
          disabled={disabled}
          onClick={onClick}
          aria-disabled={disabled}
          className={cn(
            "h-[52px] w-full rounded-md text-[16px] font-semibold",
            disabled ? "bg-app-surface text-app-caption" : "bg-app-brand text-white"
          )}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
