"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@libs/client/utils";

/**
 * 빈 상태 공용(community-vibe F-12): 아이콘 48 + 제목(card) + 설명(meta) + 다음 행동 버튼.
 * "없어요" 로 끝내지 않는다(§3.1). action.href 가 있으면 링크, 아니면 버튼.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  const actionClass =
    "mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-app-inverse px-[18px] text-[14px] font-semibold text-app-inverse-text";
  return (
    <div className={cn("flex flex-col items-center px-4 py-12 text-center", className)}>
      {icon ? (
        <span className="mb-3 flex h-12 w-12 items-center justify-center text-app-muted" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="app-t-card">{title}</p>
      {description ? <p className="app-t-meta mt-1 whitespace-pre-line">{description}</p> : null}
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
