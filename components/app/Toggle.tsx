"use client";
import { cn } from "@libs/client/utils";

/** 켜짐/꺼짐 스위치(켜짐 brand). */
export default function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative ml-3 h-[28px] w-[48px] shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-app-brand" : "bg-app-border"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-[22px] w-[22px] rounded-full bg-[#fff] shadow-card transition-[left]",
          checked ? "left-[23px]" : "left-[3px]"
        )}
      />
    </button>
  );
}
