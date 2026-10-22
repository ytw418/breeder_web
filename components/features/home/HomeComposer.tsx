"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import Image from "@components/atoms/Image";
import { avatarInitial, avatarToneClass } from "@components/ui/avatarTone";
import { ASK_QUESTION_HREF } from "@components/features/post/AwaitingAnswerCard";
import { cn, makeImageUrl } from "@libs/client/utils";
import useUser from "hooks/useUser";

const UPLOAD_HREF = "/posts/upload";
const PHOTO_HREF = `/posts/upload?category=${encodeURIComponent("사진")}`;
const QUICK_ACTIONS = [
  { key: "brag", label: "사진 자랑", href: `/posts/upload?category=${encodeURIComponent("자랑")}` },
  { key: "question", label: "질문하기", href: ASK_QUESTION_HREF },
  { key: "debate", label: "토론 열기", href: "/posts/debate" },
] as const;

const toLoginHref = (next: string) => `/auth/login?next=${encodeURIComponent(next)}`;

/**
 * 홈 맨 위 새 소식 입력줄(쓰레드식, 앱 docs/prd/home-v2.md S-1 1-1, 시안 C-threads.html ①).
 * 내 아바타 36 + 이름 14/600 + '우리 아이 새 소식을 남겨 보세요' 15 caption + 사진 버튼(36 r8 surface),
 * 아래 글 앞줄에 맞춰 '사진 자랑 · 질문하기 · 토론 열기' 작은 버튼(32 r8 surface 13/600).
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
            <span className="block truncate text-[15px] leading-[22px] text-app-caption">우리 아이 새 소식을 남겨 보세요</span>
          </span>
        </Link>
        <Link
          href={go(PHOTO_HREF)}
          aria-label="사진 올리기"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-surface text-app-sub active:opacity-70"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.5" />
            <path d="m21 16-5-5-8 8" />
          </svg>
        </Link>
      </div>
      <div className="mt-2.5 flex gap-1.5 pl-12">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.key}
            href={go(action.href)}
            className="flex h-8 items-center rounded-lg bg-app-surface px-3 text-[13px] font-semibold text-app-sub active:opacity-70"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
