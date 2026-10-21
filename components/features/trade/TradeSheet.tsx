"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "@components/app/BottomSheet";
import { cn } from "@libs/client/utils";

/**
 * 입양자 지정·입양 확정·거래 후기 시트 공통 틀(앱 src/components/features/trade/TradeSheet.tsx,
 * 앱 docs/prd/trade-review.md S-4~S-7, 시안 design/mockups/trade-review/A-karrot.html .sheet).
 * BottomSheet(overlay · app-elevated · 위 radius 16 · 핸들 · 제목 18/700) 위에 부제 13 muted 를 더한다.
 * children 은 스크롤 영역, footer(주 CTA 등)는 시트 아래에 고정된다.
 * busy 면 바깥·Escape 로 닫히지 않는다(요청 중에 닫혀 결과를 놓치지 않게).
 * 내용은 열려 있을 때만 그려지므로(BottomSheet 가 닫히면 null) 닫으면 고른 값이 초기화된다.
 */
export function TradeSheet({
  title,
  subtitle,
  busy = false,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  busy?: boolean;
  onClose: () => void;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <BottomSheet
      open
      onClose={close}
      title={title}
      ariaLabel={title}
      dismissOnBackdrop={!busy}
      footer={footer}
      footerClassName="px-0 pt-0 pb-4"
    >
      {subtitle ? (
        <p className="break-keep px-4 pb-1 text-[13px] leading-[19px] text-app-muted">{subtitle}</p>
      ) : null}
      {children}
    </BottomSheet>
  );
}

/** 라디오 원 20(끔 1.5px caption 테두리 / 켬 6px brand 고리). 시안 .radio. */
export function TradeRadio({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-5 w-5 shrink-0 rounded-full",
        checked ? "border-[6px] border-app-brand" : "border-[1.5px] border-app-caption"
      )}
    />
  );
}

/** 시트 주 버튼 52 r6(켬 brand 흰 글자 / 끔 surface caption 글자). 시안 .cta. */
export function TradeSheetCta({
  label,
  disabled,
  onClick,
  className,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div className={cn("px-4", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "h-[52px] w-full rounded-md text-[16px] font-semibold",
          disabled ? "bg-app-surface text-app-caption" : "bg-app-brand text-white"
        )}
      >
        {label}
      </button>
    </div>
  );
}
