"use client";

import Link from "next/link";

import useScopeTerms from "@/hooks/useScopeTerms";

/** 아이콘 path(시안 home-photo-question/B-tabs.html ④ .qk, 앱 LifeShortcuts 와 같다). */
const SHORTCUTS = [
  {
    key: "bloodline",
    label: () => "혈통카드",
    href: "/bloodline-management",
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
  },
  {
    key: "ranking",
    label: (breeder: string) => `${breeder} 랭킹`,
    href: "/ranking",
    icon: <path d="M4 20V12h5v8M9.5 20V6h5v14M15 20v-5h5v5" />,
  },
  {
    key: "town",
    label: () => "동네 사랑방",
    href: "/town",
    icon: (
      <>
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </>
    ),
  },
  {
    key: "debate",
    label: () => "토론 열기",
    href: "/posts/debate",
    icon: <path d="M5 12h14M12 5v14" />,
  },
] as const;

/**
 * 반려생활 탭 바로가기 4칸(앱 docs/prd/home-v2.md S-3): 아이콘 48 r16 surface + 라벨 13/600, 같은 너비.
 * 포유류만 고정했으면 '브리더 랭킹'을 '집사 랭킹'으로 부른다(scopeTerms).
 */
export default function LifeShortcuts() {
  const { breeder } = useScopeTerms();
  return (
    <nav aria-label="바로가기" data-home-section="life_shortcuts" className="flex px-2 pt-5">
      {SHORTCUTS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="flex flex-1 flex-col items-center gap-1.5 text-[13px] font-semibold leading-[18px] text-app-text active:opacity-70"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-surface">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {item.icon}
            </svg>
          </span>
          {item.label(breeder)}
        </Link>
      ))}
    </nav>
  );
}
