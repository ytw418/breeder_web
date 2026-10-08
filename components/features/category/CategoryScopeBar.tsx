"use client";
/**
 * 홈 상단 현재 범위 표시(앱 CategoryScopeBar). "관심 분야 · 포유류 > 햄스터 · 바꾸기 ›" 한 줄, 누르면 설정 > 관심 카테고리.
 * 시안 규칙: 44 행, 아래 1px 라인, 라벨은 본문색 600, 안내 글자는 muted.
 */
import Link from "next/link";
import useCategoryScope from "hooks/useCategoryScope";
import { cn } from "@libs/client/utils";

export default function CategoryScopeBar() {
  const { label, pins } = useCategoryScope();
  return (
    <Link
      href="/settings/categories"
      aria-label={`관심 분야 ${label}, 바꾸기`}
      className="flex h-11 items-center gap-1.5 border-b border-app-line bg-app-bg px-4 transition-colors hover:bg-app-surface"
    >
      <span className="shrink-0 text-[13px] text-app-muted">관심 분야</span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[14px] font-semibold",
          pins.length ? "text-app-text" : "text-app-muted"
        )}
      >
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <span className="text-[13px] text-app-muted">{pins.length ? "바꾸기" : "고정하기"}</span>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="text-app-caption">
          <path d="M9 5l7 7-7 7" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
