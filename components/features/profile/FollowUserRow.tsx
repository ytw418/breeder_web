"use client";
/**
 * 팔로워·팔로잉 행(앱 FollowUserRow, 시안 `.person`): 아바타 44 · 이름 15/700 · 보조 12 "게시물 N개 · 소개 첫 줄" · 74×32 버튼.
 * 내 행에는 버튼을 두지 않는다. 행을 누르면 그 프로필.
 */
import Link from "next/link";
import Image from "@components/atoms/Image";
import FollowButton from "@components/features/profile/FollowButton";
import { makeImageUrl } from "@libs/client/utils";
import type { FollowListUser } from "@libs/server/followList";

/** 소개 첫 줄(줄바꿈 앞). */
const firstLine = (bio: string | null) => bio?.split("\n").find((line) => line.trim())?.trim() ?? "";

export default function FollowUserRow({
  user,
  isMe,
  returnPath,
}: {
  user: FollowListUser;
  isMe: boolean;
  returnPath: string;
}) {
  const bioLine = firstLine(user.bio);
  const sub = `게시물 ${user.postsCount}개${bioLine ? ` · ${bioLine}` : ""}`;
  return (
    <div className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-app-surface">
      <Link href={`/profiles/${user.id}`} aria-label={`${user.name}, ${sub}`} className="absolute inset-0" />
      {user.avatar ? (
        <Image
          src={makeImageUrl(user.avatar, "avatar")}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-surface text-[16px] font-bold text-app-muted">
          {user.name.trim().charAt(0) || "브"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-5 text-app-text">{user.name}</p>
        <p className="mt-0.5 truncate text-[12px] leading-4 text-app-muted">{sub}</p>
      </div>
      {isMe ? null : (
        <div className="relative">
          <FollowButton userId={user.id} isFollowing={user.isFollowing} returnPath={returnPath} size="sm" />
        </div>
      )}
    </div>
  );
}
