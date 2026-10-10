import Link from "next/link";
import React from "react";

interface FloatingButton {
  children: React.ReactNode;
  href: string;
  /** 스크린리더 라벨(예: "분양 등록", "글쓰기"). */
  label?: string;
}

/**
 * 주황 FAB(앱 FloatingButton): 56x56 r16 app-brand, 오른쪽 16(모바일 폭 컨테이너 기준), 탭바 위 46.
 * 다크는 그림자 없이 1px 테두리만 둔다.
 */
export default function FloatingButton({ children, href, label = "등록" }: FloatingButton) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="app-fab fixed z-40 bottom-[calc(102px+env(safe-area-inset-bottom))] right-[max(16px,calc((100vw-36rem)/2+16px))] flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/40 bg-app-brand text-white shadow-[0_12px_28px_rgba(249,115,22,0.35)] dark:shadow-none"
    >
      {children}
    </Link>
  );
}
