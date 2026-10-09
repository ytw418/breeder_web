"use client";
/**
 * 반려생활 '팔로잉' 칩 안내 카드(앱 FollowingFeedCard, 앱 docs/prd/profile.md v5 S-11). RegionGateCard 와 같은 틀.
 * - login: 비로그인 → 로그인(돌아올 곳은 반려생활)
 * - noFollowing: 아무도 팔로우하지 않음 → 브리더 찾기(/ranking)
 * - noPosts: 팔로우한 사람들이 아직 글이 없음 → 브리더 찾기
 */
import Link from "next/link";
import { toLoginHref } from "@components/features/MainLayout";
import { cn } from "@libs/client/utils";

const COPY = {
  login: {
    title: "팔로우한 브리더의 새 글을 모아 봐요",
    body: "로그인하면 팔로우한 브리더의 사진과 기록이 여기에 모여요",
    cta: "로그인",
  },
  noFollowing: {
    title: "아직 팔로우한 브리더가 없어요",
    body: "마음에 드는 브리더를 팔로우하면 새 글이 여기에 모여요",
    cta: "브리더 찾기",
  },
  noPosts: {
    title: "팔로우한 브리더가 아직 글을 올리지 않았어요",
    body: "다른 브리더도 둘러보고 팔로우해 보세요",
    cta: "브리더 찾기",
  },
} as const;

export default function FollowingFeedCard({
  variant,
  className,
}: {
  variant: keyof typeof COPY;
  className?: string;
}) {
  const copy = COPY[variant];
  const href = variant === "login" ? toLoginHref("/posts") : "/ranking";
  return (
    <div className={cn("mx-4 rounded-xl border border-app-border bg-app-elevated p-5", className)}>
      <p className="text-[16px] font-semibold text-app-strong">{copy.title}</p>
      <p className="mt-1 break-keep text-[14px] leading-5 text-app-muted">{copy.body}</p>
      <Link
        href={href}
        className={cn(
          "mt-3.5 flex h-11 items-center justify-center rounded-md text-[14px] font-semibold",
          variant === "login" ? "bg-app-brand text-white" : "bg-app-surface text-app-strong"
        )}
      >
        {copy.cta}
      </Link>
    </div>
  );
}
