"use client";

import Link from "next/link";
import { cn } from "@libs/client/utils";

/**
 * 빈 상태: 제목 16/600 + 설명 14 app-muted + (선택) 보조 버튼(app-surface).
 * action.href 가 있으면 링크, 아니면 onClick 버튼.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}) {
  const actionClass =
    "mt-4 inline-flex h-11 items-center justify-center rounded-md bg-app-surface px-[18px] text-[14px] font-semibold text-app-text";
  return (
    <div className={cn("flex flex-col items-center px-4 py-12 text-center", className)}>
      <p className="text-[16px] font-semibold tracking-[-0.3px] text-app-text">{title}</p>
      {description ? (
        <p className="mt-1.5 whitespace-pre-line text-[14px] text-app-muted">{description}</p>
      ) : null}
      {action ? (
        action.href ? (
          <Link href={action.href} className={actionClass} onClick={action.onClick}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={actionClass}>
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}

export default EmptyState;
