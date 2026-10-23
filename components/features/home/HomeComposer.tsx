"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import Image from "@components/atoms/Image";
import { avatarInitial, avatarToneClass } from "@components/ui/avatarTone";
import { ASK_QUESTION_HREF } from "@components/features/post/AwaitingAnswerCard";
import { cn, makeImageUrl } from "@libs/client/utils";
import useUser from "hooks/useUser";

const UPLOAD_HREF = "/posts/upload";
const QUICK_ACTIONS = [
  { key: "brag", label: "사진 자랑", href: `/posts/upload?category=${encodeURIComponent("자랑")}` },
  { key: "question", label: "질문하기", href: ASK_QUESTION_HREF },
  { key: "debate", label: "토론 열기", href: "/posts/debate" },
] as const;

/** 버튼 줄 아이콘 16(stroke 1.6): 카메라 · 물음표 원 · 말풍선. 앱 HomeComposer 와 같은 path. */
function QuickActionIcon({ kind }: { kind: (typeof QUICK_ACTIONS)[number]["key"] }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === "brag" ? (
        <>
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </>
      ) : kind === "question" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
          <path d="M12 17h.01" />
        </>
      ) : (
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
      )}
    </svg>
  );
}

const toLoginHref = (next: string) => `/auth/login?next=${encodeURIComponent(next)}`;

/**
 * 홈 맨 위 새 소식 입력줄(쓰레드식, 앱 docs/prd/home-v2.md S-1 1-1, 시안 C-threads.html ①).
 * 내 아바타 36 + 이름 14/600 + '우리 아이 새 소식을 남겨 보세요' 15 muted,
 * 아래 왼쪽 여백(16)부터 '사진 자랑 · 질문하기 · 토론 열기' 바탕 없는 버튼(아이콘 16 + 13/600 sub, 높이 32, 사이 16).
 * 2026-10-23 사용자 "플레이스홀더 좀 더 진하면", "버튼들에 백그라운드 컬러가 거슬린다, 쓰레드처럼 깔끔하게" — 바탕을 다 빼고
 * 오른쪽 사진 상자는 '사진 자랑' 버튼 하나로 합쳤다.
 * 비로그인은 사람 아이콘 + '로그인하고 소식 남기기'이고 어디를 눌러도 로그인 뒤 그 화면으로 간다.
 * onVisibleChange: 이 줄이 화면에 보이는지(홈 글쓰기 FAB 는 보이는 동안 숨긴다).
 * 앱 src/components/features/home/HomeComposer.tsx 와 같다.
 */
export default function HomeComposer({ onVisibleChange }: { onVisibleChange?: (visible: boolean) => void }) {
  const { user, isLoading } = useUser();
  const rootRef = useRef<HTMLElement>(null);
  const guest = !user && !isLoading;
  const go = (href: string) => (guest ? toLoginHref(href) : href);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || !onVisibleChange || typeof IntersectionObserver === "undefined") return;
    // 헤더(56) 아래로 완전히 올라가면 안 보이는 것으로 본다.
    const observer = new IntersectionObserver((entries) => onVisibleChange(entries[0]?.isIntersecting ?? false), {
      rootMargin: "-56px 0px 0px 0px",
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onVisibleChange]);

  return (
    <section ref={rootRef} aria-label="새 소식 남기기" className="border-b border-app-line px-4 py-3" data-home-section="composer">
      <div className="flex items-center gap-3">
        <Link href={go(UPLOAD_HREF)} className="flex min-w-0 flex-1 items-center gap-3" data-testid="home-composer">
          {user?.avatar ? (
            <Image
              src={makeImageUrl(user.avatar, "avatar")}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : user ? (
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-bold",
                avatarToneClass(user.name)
              )}
            >
              {avatarInitial(user.name)}
            </span>
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-surface text-app-caption">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold leading-5 text-app-text">
              {user ? user.name : "로그인하고 소식 남기기"}
            </span>
            <span className="block truncate text-[15px] leading-[22px] text-app-muted">우리 아이 새 소식을 남겨 보세요</span>
          </span>
        </Link>
      </div>
      {/* 피드 글이 왼쪽 여백부터 시작하므로(2026-10-22) 버튼도 들여 쓰지 않는다 */}
      <div className="mt-1.5 flex gap-4">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.key}
            href={go(action.href)}
            className="flex h-8 items-center gap-1 text-[13px] font-semibold text-app-sub active:opacity-70"
          >
            <QuickActionIcon kind={action.key} />
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
