"use client";
/**
 * 프로필 블록(앱 ProfileBlock, 시안 design/mockups/profile/A-karrot.html `.profile`).
 * 아바타 64 · 이름 20/700 · 주력 종 14 · 소개 14/1.6 · 뱃지 pill · 통계(팔로워·팔로잉·게시물) · 버튼 줄.
 * 팔로워·팔로잉 숫자는 목록 화면을 연다. 버튼은 화면이 상태(본인·타인·차단·탈퇴)에 맞게 넘긴다.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { BreederProgramBadgeList } from "@components/features/breeder/BreederProgramDecorators";
import { ProfileAvatar } from "@components/features/profile/ProfileRows";
import { cn } from "@libs/client/utils";
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

function Skeleton({ className }: { className: string }) {
  return <span className={cn("block animate-pulse rounded bg-app-placeholder", className)} />;
}

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
    <span className="flex items-baseline gap-[5px]">
      {loading ? (
        <Skeleton className="h-4 w-6" />
      ) : (
        <span className="text-[16px] font-bold leading-[22px] text-app-text">{value ?? 0}</span>
      )}
      <span className="text-[13px] leading-[18px] text-app-muted">{label}</span>
    </span>
  );
  const a11yLabel = loading ? `${label} 불러오는 중` : `${label} ${value ?? 0}`;
  if (!href) return <span aria-label={a11yLabel}>{content}</span>;
  return (
    <Link href={href} aria-label={`${a11yLabel}, 목록 보기`} className="-m-2 rounded p-2 hover:bg-app-surface">
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
  const name = user?.name || fallbackName;
  const species = user?.topSpecies?.filter(Boolean) ?? [];
  const bio = user?.bio?.trim() ?? "";
  const badges = user?.badges ?? [];
  const showBioPrompt = isMine && !bio && !loading && Boolean(user);
  const hasBioLine = Boolean(bio) || showBioPrompt;
  const hasPills =
    badges.length > 0 || (user?.breederPrograms ?? []).some((program) => program.status === "ACTIVE");

  return (
    <div className="px-4 pb-[18px] pt-3.5">
      <div className="flex items-center gap-3.5">
        <ProfileAvatar avatar={user?.avatar ?? fallbackAvatar} name={name} programs={user?.breederPrograms} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] font-bold leading-[26px] text-app-text">{name}</h2>
          {species.length ? (
            <p className="mt-[3px] truncate text-[14px] leading-5 text-app-muted">{species.join(" · ")}</p>
          ) : null}
        </div>
      </div>

      {bio ? (
        <p className="mb-2 mt-3.5 whitespace-pre-line break-words text-[14px] leading-[22px] text-app-text">{bio}</p>
      ) : showBioPrompt ? (
        <Link href="/editProfile" className="mb-2 mt-3.5 inline-block text-[14px] leading-[22px] text-app-muted">
          소개를 추가해 보세요
        </Link>
      ) : null}

      {loading ? (
        <Skeleton className="mt-3.5 h-5 w-24" />
      ) : hasPills ? (
        <div className={cn("flex flex-wrap gap-1.5", hasBioLine ? "mt-0" : "mt-3.5")}>
          <BreederProgramBadgeList programs={user?.breederPrograms} />
          {badges.map((badge) => (
            <span
              key={badge.id}
              className="inline-flex items-center whitespace-nowrap rounded bg-app-surface px-1.5 py-0.5 text-[12px] leading-4 text-app-muted"
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      {failed ? (
        <button
          type="button"
          onClick={onRetry}
          aria-label="프로필 정보를 불러오지 못했어요. 다시 시도"
          className="my-3 flex min-h-[42px] w-full items-center justify-center text-[13px] text-app-muted"
        >
          프로필 정보를 불러오지 못했어요 ·&nbsp;<span className="font-semibold text-app-text">다시 시도</span>
        </button>
      ) : (
        <div className="mb-4 mt-[17px] flex gap-6">
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
          <Stat label="게시물" value={user?._count?.posts} loading={loading} />
        </div>
      )}

      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

/** 프로필 블록 보조 버튼(높이 52, surface 배경 · text 14/600). 메시지·프로필 수정·공유·차단 해제. */
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
    "inline-flex h-[52px] flex-1 items-center justify-center rounded-md bg-app-surface text-[14px] font-semibold text-app-text transition-colors hover:bg-app-placeholder",
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
