"use client";

import { useState } from "react";
import { cn } from "@libs/client/utils";
import { formatAmountInput, parseAmount, toAmountDigits } from "@libs/shared/price";

/**
 * 금액 입력(h48 r8, 콤마 표시). value 는 숫자(없으면 null)이고 화면에는 "1,234,567" 로 보인다.
 * 숫자 외 입력은 버리고, max 를 넘는 값은 max 로 자른다. prefix 는 입력칸 앞 글자(예: "₩").
 */
export function PriceInput({
  value,
  onChange,
  placeholder,
  max,
  disabled,
  id,
  prefix,
  className,
  "aria-label": ariaLabel,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
  id?: string;
  prefix?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [focused, setFocused] = useState(false);
  const display = value == null ? "" : formatAmountInput(String(value));

  return (
    <div
      className={cn(
        "flex h-12 items-center gap-1 rounded-lg border bg-app-bg px-3.5",
        focused ? "border-app-text" : "border-app-border",
        disabled && "opacity-50",
        className
      )}
    >
      {prefix ? <span className="shrink-0 text-[16px] text-app-text">{prefix}</span> : null}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
        value={display}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          const digits = toAmountDigits(event.target.value);
          const next = parseAmount(digits);
          onChange(next != null && max != null && next > max ? max : next);
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] text-app-text placeholder:text-app-caption focus:border-0 focus:outline-none focus:ring-0"
      />
    </div>
  );
}

export default PriceInput;
