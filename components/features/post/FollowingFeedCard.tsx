"use client";
/**
 * 반려생활 '팔로잉' 칩 안내 카드(앱 FollowingFeedCard, 앱 docs/prd/profile.md v5 S-11). RegionGateCard 와 같은 틀.
 * - login: 비로그인 → 로그인(돌아올 곳은 반려생활)
 * - noFollowing: 아무도 팔로우하지 않음 → 추천 3명을 바로 팔로우(SuggestedBreederRow) + '더 찾기 ›'(/ranking).
 *   추천이 없거나 못 받으면 '브리더 찾기' 버튼(2026-10-21 감사 19번).
 * - noPosts: 팔로우한 사람들이 아직 글이 없음 → 브리더 찾기
 */
import Link from "next/link";
import useSWR from "swr";
import SuggestedBreederRow from "@components/features/profile/SuggestedBreederRow";
import type { SuggestedUsersResponse } from "pages/api/users/suggested";
import useScopeTerms from "@/hooks/useScopeTerms";
import { withBreederWord } from "@libs/shared/scopeTerms";
import { toLoginHref } from "@components/features/MainLayout";
import { cn } from "@libs/client/utils";

/** 팔로잉 빈 상태에서 바로 팔로우할 추천 인원(앱과 같은 키 모양). */
const SUGGESTED_KEY = "/api/users/suggested?limit=3";

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
  const { breeder } = useScopeTerms();
  const copy = COPY[variant];
  const href = variant === "login" ? toLoginHref("/") : "/ranking";
  const { data } = useSWR<SuggestedUsersResponse>(variant === "noFollowing" ? SUGGESTED_KEY : null);
  const suggested = variant === "noFollowing" ? (data?.users ?? []) : [];
  return (
    <div className={cn("mx-4 rounded-xl border border-app-border bg-app-elevated p-5", className)}>
      <p className="text-[16px] font-semibold text-app-strong">{withBreederWord(copy.title, breeder)}</p>
      <p className="mt-1 break-keep text-[14px] leading-5 text-app-muted">{withBreederWord(copy.body, breeder)}</p>
      {suggested.length ? (
        <>
          <div className="mt-2">
            {suggested.map((user) => (
              <SuggestedBreederRow key={user.id} user={user} returnPath="/" inset={false} />
            ))}
          </div>
          <div className="mt-1.5 flex justify-end">
            <Link href="/ranking" className="py-1 text-[13px] font-semibold text-app-muted">
              더 찾기 ›
            </Link>
          </div>
        </>
      ) : (
        <Link
          href={href}
          className={cn(
            "mt-3.5 flex h-11 items-center justify-center rounded-md text-[14px] font-semibold",
            variant === "login" ? "bg-app-brand text-white" : "bg-app-surface text-app-strong"
          )}
        >
          {withBreederWord(copy.cta, breeder)}
        </Link>
      )}
    </div>
  );
}
