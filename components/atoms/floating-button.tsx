import Link from "next/link";
import React from "react";

type FloatingButtonProps = {
  children: React.ReactNode;
  /** 스크린리더 라벨(예: "분양 등록", "글쓰기"). */
  label?: string;
} & (
  | { href: string; onClick?: never }
  /** 바로 이동하지 않고 고르는 시트를 띄울 때(홈 글쓰기 FAB: 글쓰기·질문하기·토론 열기, 앱 FloatingButton onPress). */
  | { onClick: () => void; href?: never }
);

const FAB_CLASS =
  "app-fab fixed z-40 bottom-[calc(102px+env(safe-area-inset-bottom))] right-[max(16px,calc((100vw-36rem)/2+16px))] flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/40 bg-app-brand text-white shadow-[0_12px_28px_rgba(249,115,22,0.35)] dark:shadow-none";

/**
 * 주황 FAB(앱 FloatingButton): 56x56 r16 app-brand, 오른쪽 16(모바일 폭 컨테이너 기준), 탭바 위 46.
 * 다크는 그림자 없이 1px 테두리만 둔다. href 면 링크, onClick 이면 버튼.
 */
export default function FloatingButton({ children, href, onClick, label = "등록" }: FloatingButtonProps) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={label} aria-haspopup="dialog" className={FAB_CLASS}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href ?? "/"} aria-label={label} className={FAB_CLASS}>
      {children}
    </Link>
  );
}
