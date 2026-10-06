"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@libs/client/utils";

/**
 * 헤더 아이콘 버튼(44x44). href 가 있으면 링크, 아니면 버튼.
 * badge 는 오른쪽 위 app-danger 뱃지(숫자는 99+ 로 자른다). 아이콘은 children(24px 권장).
 */
export function HeaderIconButton({
  label,
  onClick,
  href,
  badge,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  badge?: number | string | null;
  children: ReactNode;
  className?: string;
}) {
  const badgeLabel =
    typeof badge === "number" ? (badge > 0 ? (badge > 99 ? "99+" : String(badge)) : null) : badge || null;
  const classes = cn(
    "relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-app-text transition-colors hover:bg-app-surface",
    className
  );
  const inner = (
    <>
      {children}
      {badgeLabel ? (
        <span className="absolute right-0.5 top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-app-danger px-1 text-[10px] font-bold text-white">
          {badgeLabel}
        </span>
      ) : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} className={classes} onClick={onClick}>
      {inner}
    </button>
  );
}

export default HeaderIconButton;
