"use client";
/**
 * 프로필 블록(앱 ProfileBlock, 2026-10-09 v4 — 시안 design/mockups/profile/A-karrot.html `.profile`).
 * 아바타 80(누르면 크게 보기) 옆에 게시물·팔로워·팔로잉 3칸 → 이름 16/700 → 브리더 컬러 뱃지 →
 * 주력 종 13 muted → 소개 14/1.5 → 버튼 줄 36. 버튼은 화면이 상태(본인·타인·차단·탈퇴)에 맞게 넘긴다.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BreederProgramProfileBadges } from "@components/features/breeder/BreederProgramDecorators";
import ImageLightbox from "@components/features/image/ImageLightbox";
import { ProfileAvatar } from "@components/features/profile/ProfileRows";
import { cn, makeImageUrl } from "@libs/client/utils";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";

export interface ProfileBlockUser {
  name: string;
  avatar?: string | null;
  bio?: string | null;
  topSpecies?: string[];
  badges?: { id: number; label: string }[];
  breederPrograms?: BreederProgramSummary[];
  _count?: { followers: number; following: number; posts: number };
}

const AVATAR_SIZE = 80;

function Skeleton({ className }: { className: string }) {
  return <span className={cn("block animate-pulse rounded bg-app-placeholder", className)} />;
}

/** 통계 한 칸: 숫자 17/700 위 · 라벨 13 muted 아래, 가운데 정렬. 남은 폭을 셋이 나눈다. */
function Stat({
  label,
  value,
  loading,
  href,
}: {
  label: string;
  value?: number;
  loading: boolean;
  href?: string;
}) {
  const content = (
    <>
      {loading ? (
        <Skeleton className="h-5 w-7" />
      ) : (
        <span className="text-[17px] font-bold leading-[22px] text-app-text">{(value ?? 0).toLocaleString()}</span>
      )}
      <span className="mt-0.5 text-[13px] leading-[18px] text-app-muted">{label}</span>
    </>
  );
  const a11yLabel = loading ? `${label} 불러오는 중` : `${label} ${value ?? 0}`;
  const className = "flex flex-1 flex-col items-center py-1";
  if (!href) {
    return (
      <span aria-label={a11yLabel} className={className}>
        {content}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={`${a11yLabel}, 목록 보기`} className={cn(className, "rounded-lg hover:bg-app-surface")}>
      {content}
    </Link>
  );
}

export function ProfileBlock({
  userId,
  user,
  fallbackName = "",
  fallbackAvatar,
  loading,
  failed = false,
  onRetry,
  isMine,
  actions,
}: {
  userId: number | string;
  user?: ProfileBlockUser;
  /** 프로필을 받기 전에 보일 이름·사진(마이페이지는 로그인 정보). */
  fallbackName?: string;
  fallbackAvatar?: string | null;
  loading: boolean;
  /** 프로필을 한 번도 받지 못했다(통계 자리에 다시 시도). */
  failed?: boolean;
  onRetry?: () => void;
  isMine: boolean;
  actions?: ReactNode;
}) {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const name = user?.name || fallbackName;
  const avatar = user?.avatar ?? fallbackAvatar ?? null;
  const species = user?.topSpecies?.filter(Boolean) ?? [];
  const bio = user?.bio?.trim() ?? "";
  const badges = user?.badges ?? [];
  const showBioPrompt = isMine && !bio && !loading && Boolean(user);
  const hasPills =
    badges.length > 0 || (user?.breederPrograms ?? []).some((program) => program.status === "ACTIVE");

  const avatarNode = (
    <ProfileAvatar avatar={avatar} name={name} programs={user?.breederPrograms} size={AVATAR_SIZE} />
  );

  return (
    <div className="px-4 pb-4 pt-3">
      <div className="flex items-center">
        {avatar ? (
          <button
            type="button"
            aria-label={`${name} 프로필 사진 크게 보기`}
            onClick={() => setAvatarOpen(true)}
            className="shrink-0 rounded-full"
          >
            {avatarNode}
          </button>
        ) : (
          avatarNode
        )}

        {failed ? (
          <button
            type="button"
            onClick={onRetry}
            aria-label="프로필 정보를 불러오지 못했어요. 다시 시도"
            className="ml-4 flex min-h-[48px] flex-1 flex-col items-center justify-center text-center text-[13px] text-app-muted"
          >
            프로필 정보를 불러오지 못했어요
            <span className="font-semibold text-app-text">다시 시도</span>
          </button>
        ) : (
          <div className="ml-3 flex flex-1">
            <Stat label="게시물" value={user?._count?.posts} loading={loading} />
            <Stat
              label="팔로워"
              value={user?._count?.followers}
              loading={loading}
              href={`/profiles/${userId}/follows?tab=followers`}
            />
            <Stat
              label="팔로잉"
              value={user?._count?.following}
              loading={loading}
              href={`/profiles/${userId}/follows?tab=following`}
            />
          </div>
        )}
      </div>

      <h2 className="mt-3 truncate text-[16px] font-bold leading-[22px] text-app-text">{name}</h2>

      {loading ? (
        <Skeleton className="mt-1.5 h-[22px] w-[120px] rounded-full" />
      ) : hasPills ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <BreederProgramProfileBadges programs={user?.breederPrograms} />
          {badges.map((badge) => (
            <span
              key={badge.id}
              className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-app-surface px-[9px] text-[12px] font-semibold leading-none text-app-muted"
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      {species.length ? (
        <p className="mt-1.5 truncate text-[13px] leading-[18px] text-app-muted">{species.join(" · ")}</p>
      ) : null}

      {bio ? (
        <p className="mt-1.5 whitespace-pre-line break-words text-[14px] leading-[21px] text-app-text">{bio}</p>
      ) : showBioPrompt ? (
        <Link href="/editProfile" className="mt-1.5 inline-block text-[14px] leading-[21px] text-app-muted">
          소개를 추가해 보세요
        </Link>
      ) : null}

      {actions ? <div className="mt-3.5 flex gap-1.5">{actions}</div> : null}

      {avatar ? (
        <ImageLightbox
          images={[makeImageUrl(avatar, "public")]}
          isOpen={avatarOpen}
          currentIndex={0}
          onClose={() => setAvatarOpen(false)}
          onIndexChange={() => undefined}
          altPrefix={`${name} 프로필 사진`}
        />
      ) : null}
    </div>
  );
}

/** 프로필 블록 보조 버튼(높이 36 · r8, surface 배경 · text 14/600). 메시지·프로필 수정·공유·차단 해제. */
export function ProfileSecondaryButton({
  label,
  ariaLabel,
  disabled = false,
  onClick,
  href,
}: {
  label: string;
  ariaLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const className = cn(
    "inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-app-surface text-[14px] font-semibold text-app-text transition-colors hover:bg-app-placeholder",
    disabled && "pointer-events-none opacity-60"
  );
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel ?? label} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={ariaLabel ?? label} disabled={disabled} onClick={onClick} className={className}>
      {label}
    </button>
  );
}
