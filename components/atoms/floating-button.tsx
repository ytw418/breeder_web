"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { clampScrollY, FAB_SCROLL_INITIAL, nextFabScroll } from "@libs/shared/fabScroll";

type FloatingButtonProps = {
  children: React.ReactNode;
  /** 스크린리더 라벨(예: "분양 등록", "글쓰기"). */
  label?: string;
  /** 아래로 스크롤하면 숨기고 위로 올리면 다시 보인다(분양·경매 목록, 앱 useFabScrollHide). */
  hideOnScroll?: boolean;
  /** 밖에서 숨김을 정한다(홈: 맨 위 새 소식 입력줄이 보이는 동안 숨김, 앱 docs/prd/home-v2.md S-1 FAB). */
  hidden?: boolean;
} & (
  | { href: string; onClick?: never }
  /** 바로 이동하지 않고 고르는 시트를 띄울 때(홈 글쓰기 FAB: 글쓰기·질문하기·토론 열기, 앱 FloatingButton onPress). */
  | { onClick: () => void; href?: never }
);

/** 그림자는 2026-10-21 디자인 리뷰로 주황 번짐 대신 중립(0 4 12 검정 12%), 다크는 없음(앱 colors.shadowFab). */
const FAB_CLASS =
  "app-fab fixed z-40 bottom-[calc(102px+env(safe-area-inset-bottom))] right-[max(16px,calc((100vw-36rem)/2+16px))] flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/40 bg-app-brand text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition-[transform,opacity] duration-200 dark:shadow-none";

/** 숨김: 탭바 아래로 내려가며 사라지고 눌리지 않는다. 키보드 초점이 오면 다시 보인다. */
const FAB_HIDDEN_CLASS =
  "pointer-events-none translate-y-[calc(102px+56px)] opacity-0 focus-visible:pointer-events-auto focus-visible:translate-y-0 focus-visible:opacity-100";

/**
 * FAB 가 떠 있는 목록의 하단 여백. 탭바 위 FAB 바닥 46 + 높이 56 + 여유 24 = 126 에서
 * MainLayout 이 탭바 위에 남기는 16(pb 72 − 탭바 56)을 뺀 110(앱 FAB_LIST_BOTTOM_PADDING 126 과 같은 자리).
 * 끝까지 내리면 마지막 행의 버튼·메타가 FAB 위로 24 떨어져 올라온다(2026-10-21 디자인 리뷰).
 */
export const FAB_LIST_BOTTOM_PADDING_CLASS = "pb-[110px]";

/** 창 스크롤을 보고 FAB 숨김 여부를 돌려준다(규칙 libs/shared/fabScroll). enabled 가 false 면 늘 보인다. */
function useHideOnWindowScroll(enabled: boolean) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let state = FAB_SCROLL_INITIAL;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = clampScrollY(window.scrollY, document.documentElement.scrollHeight, window.innerHeight);
        state = nextFabScroll(state, y);
        setHidden(state.hidden);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return enabled && hidden;
}

/**
 * 주황 FAB(앱 FloatingButton): 56x56 r16 app-brand, 오른쪽 16(모바일 폭 컨테이너 기준), 탭바 위 46.
 * 다크는 그림자 없이 1px 테두리만 둔다. href 면 링크, onClick 이면 버튼.
 */
export default function FloatingButton({
  children,
  href,
  onClick,
  label = "등록",
  hideOnScroll = false,
  hidden: forceHidden = false,
}: FloatingButtonProps) {
  const hidden = useHideOnWindowScroll(hideOnScroll) || forceHidden;
  const className = hidden ? `${FAB_CLASS} ${FAB_HIDDEN_CLASS}` : FAB_CLASS;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={label} aria-haspopup="dialog" className={className}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href ?? "/"} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
