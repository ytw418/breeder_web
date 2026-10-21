"use client";
/**
 * 팔로우 추천 한 줄(앱 SuggestedBreederRow, 앱 design/mockups/profile/A-karrot.html '#welcome', 2026-10-21 감사 19번).
 * 높이 56: 아바타 40 · 이름 15/600 + 주력 종 12 muted · 오른쪽 팔로우 sm. 행을 누르면 그 프로필.
 * 가입 직후 '시작하기'와 반려생활 '팔로잉' 칩 빈 상태가 같이 쓴다.
 */
import Link from "next/link";
import FollowButton from "@components/features/profile/FollowButton";
import { ProfileAvatar } from "@components/features/profile/ProfileRows";
import { cn } from "@libs/client/utils";
import type { SuggestedUser } from "pages/api/users/suggested";

export default function SuggestedBreederRow({
  user,
  returnPath,
  inset = true,
}: {
  user: SuggestedUser;
  returnPath: string;
  /** 좌우 여백 16. 카드 안에 넣으면 false. */
  inset?: boolean;
}) {
  const sub = user.topSpecies.length ? user.topSpecies.join(" · ") : `게시물 ${user.postsCount}개`;
  return (
    <div className={cn("relative flex h-14 items-center gap-3", inset && "px-4")}>
      <Link href={`/profiles/${user.id}`} aria-label={`${user.name}, ${sub}`} className="absolute inset-0" />
      <ProfileAvatar avatar={user.avatar} name={user.name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-5 text-app-text">{user.name}</p>
        <p className="mt-0.5 truncate text-[12px] leading-4 text-app-muted">{sub}</p>
      </div>
      <div className="relative">
        <FollowButton userId={user.id} isFollowing={Boolean(user.isFollowing)} returnPath={returnPath} size="sm" />
      </div>
    </div>
  );
}
