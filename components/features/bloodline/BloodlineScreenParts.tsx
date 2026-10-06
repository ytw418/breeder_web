"use client";

/**
 * 혈통관리 계열 화면 공용 조각 — 앱 bloodline-management/*, bloodline-cards/create 와 같은 모양.
 * 헤더(뒤로 40 + 제목 18/700 + 선택 검색) / 하단 고정 바 / 주·보조 버튼 / 입력 클래스 / 로그인 이동.
 */
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toLoginHref } from "@components/features/MainLayout";
import { cn } from "@libs/client/utils";

/** 앱 전역 Input: h48 r8 border, 15px, 포커스 테두리 text, placeholder caption. */
export const bloodlineInputClass =
  "h-12 rounded-lg border-app-border bg-app-bg px-3.5 text-[15px] text-app-text placeholder:text-app-caption focus-visible:border-app-text focus-visible:ring-0 focus-visible:ring-offset-0";

export const bloodlineTextareaClass =
  "min-h-[120px] rounded-lg border-app-border bg-app-bg px-3.5 py-3 text-[15px] leading-[22px] text-app-text placeholder:text-app-caption focus-visible:border-app-text focus-visible:ring-0 focus-visible:ring-offset-0";

function BackIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx={11} cy={11} r={7} stroke="currentColor" strokeWidth={1.5} />
      <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M9 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 헤더 h56: 뒤로(40) + 제목 18/700 + (선택) 검색(40). 그림자·하단선 없음(시안). */
export function BloodlineHeader({
  title,
  searchHref,
}: {
  title: string;
  searchHref?: string;
}) {
  const router = useRouter();
  const iconClass =
    "grid h-10 w-10 shrink-0 place-items-center rounded-full text-app-text transition-colors hover:bg-app-surface";
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center bg-app-bg pl-1 pr-2">
      <button type="button" aria-label="뒤로" onClick={() => router.back()} className={iconClass}>
        <BackIcon />
      </button>
      <h1 className="ml-1 min-w-0 flex-1 truncate text-[18px] font-bold tracking-[-0.3px] text-app-text">
        {title}
      </h1>
      {searchHref ? (
        <Link href={searchHref} aria-label="검색" className={iconClass}>
          <SearchIcon />
        </Link>
      ) : null}
    </header>
  );
}

/** 하단 고정 바: 상단 1px line, pt10 px16 pb12+safe-area. */
export function BloodlineBottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto flex max-w-xl gap-2 border-t border-app-line bg-app-bg px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5">
        {children}
      </div>
    </div>
  );
}

/** 하단 고정 바 높이만큼 본문 끝에 둔다. */
export function BloodlineBottomBarSpacer() {
  return <div aria-hidden="true" className="h-[calc(76px+env(safe-area-inset-bottom))]" />;
}

const buttonBase =
  "inline-flex h-[52px] flex-1 items-center justify-center rounded-md text-[16px] font-semibold tracking-[-0.3px] transition-opacity disabled:opacity-60";

export function BloodlinePrimaryButton({
  children,
  onClick,
  href,
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const classes = cn(buttonBase, "w-full bg-app-brand text-white", className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

export function BloodlineSecondaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(buttonBase, "w-full bg-app-surface text-app-text", className)}
    >
      {children}
    </button>
  );
}

/** 회색 원형 스피너(앱 ActivityIndicator muted). */
export function BloodlineSpinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="불러오는 중"
      className={cn(
        "inline-block h-6 w-6 animate-spin rounded-full border-2 border-app-line border-t-app-muted",
        className
      )}
    />
  );
}

/**
 * 비로그인 확정 시 로그인 화면으로 보낸다(앱 LoginRedirect). 확인 중·이동 중에는 호출부가 스피너를 그린다.
 */
export function useBloodlineLoginRedirect(
  shouldRedirect: boolean,
  next: string
) {
  const router = useRouter();
  useEffect(() => {
    if (shouldRedirect) router.replace(toLoginHref(next));
  }, [shouldRedirect, next, router]);
}
