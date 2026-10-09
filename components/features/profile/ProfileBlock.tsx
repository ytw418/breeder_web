"use client";
/**
 * 프로필 블록(앱 ProfileBlock, 2026-10-09 v4 — 시안 design/mockups/profile/A-karrot.html `.profile`).
 * 아바타 80(누르면 크게 보기) 옆에 게시물·팔로워·팔로잉 3칸 → 이름 16/700 → 브리더 컬러 뱃지 →
 * 주력 종 13 muted → 신뢰 줄 13 muted(v5) → 소개 14/1.5 → 버튼 줄 36. 버튼은 화면이 상태(본인·타인·차단·탈퇴)에 맞게 넘긴다.
 * v6: 커버가 있으면 맨 위 전체 폭 3:1(누르면 크게 보기), 아바타가 32 겹친다. 대표 링크는 소개 바로 아래 한 줄.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BreederProgramProfileBadges } from "@components/features/breeder/BreederProgramDecorators";
import ImageLightbox from "@components/features/image/ImageLightbox";
import { ProfileAvatar } from "@components/features/profile/ProfileRows";
import { cn, makeImageUrl } from "@libs/client/utils";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import { DELETED_USER_LABEL, isDeletedUserName } from "@libs/shared/deletedUser";
import { profileLinkLabel } from "@libs/shared/profile";
import { profileTrustLine } from "@libs/shared/profileTrust";

export interface ProfileBlockUser {
  name: string;
  avatar?: string | null;
  bio?: string | null;
  profileBanner?: string | null;
  profileLink?: string | null;
  topSpecies?: string[];
  badges?: { id: number; label: string }[];
  breederPrograms?: BreederProgramSummary[];
  /** 가입 시각(신뢰 줄 '브리디 N개월차'). */
  createdAt?: string | Date;
  _count?: { followers: number; following: number; posts: number; completedSales?: number };
}

const AVATAR_SIZE = 80;
/** 커버가 있을 때 아바타가 커버 아래로 겹치는 높이(v6). */
const COVER_OVERLAP = 32;

function Skeleton({ className }: { className: string }) {
  return <span className={cn("block animate-pulse rounded bg-app-placeholder", className)} />;
}

/** 통계 한 칸: 숫자 17/700 위 · 라벨 13 muted 아래, 가운데 정렬. 남은 폭을 셋이 나눈다. */
function Stat({ label, value, loading, href }: { label: string; value?: number; loading: boolean; href?: string }) {
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
    <Link
      href={href}
      aria-label={`${a11yLabel}, 목록 보기`}
      className={cn(className, "rounded-lg hover:bg-app-surface")}
    >
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
  const [bannerOpen, setBannerOpen] = useState(false);
  const name = user?.name || fallbackName;
  const avatar = user?.avatar ?? fallbackAvatar ?? null;
  const species = user?.topSpecies?.filter(Boolean) ?? [];
  const bio = user?.bio?.trim() ?? "";
  const banner = user?.profileBanner ?? null;
  const link = user?.profileLink ?? null;
  const badges = user?.badges ?? [];
  const showBioPrompt = isMine && !bio && !loading && Boolean(user);
  const hasPills = badges.length > 0 || (user?.breederPrograms ?? []).some((program) => program.status === "ACTIVE");
  // 신뢰 줄: "거래 완료 12 · 브리디 8개월차"(앱 docs/prd/profile.md v5 F-18). 탈퇴 사용자·로딩 중엔 그리지 않는다.
  const trustLine =
    !loading && user && name !== DELETED_USER_LABEL && !isDeletedUserName(name)
      ? profileTrustLine({
          completedSales: user._count?.completedSales,
          createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
        })
      : null;

  const avatarNode = <ProfileAvatar avatar={avatar} name={name} programs={user?.breederPrograms} size={AVATAR_SIZE} />;

  return (
    <div>
      {banner ? (
        <button
          type="button"
          aria-label={`${name} 커버 사진 크게 보기`}
          onClick={() => setBannerOpen(true)}
          className="block aspect-[3/1] w-full overflow-hidden bg-app-placeholder"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={makeImageUrl(banner, "public")} alt="" className="h-full w-full object-cover" />
        </button>
      ) : null}
      <div className={cn("px-4 pb-4", banner ? "relative" : "pt-3")}>
        <div
          className={cn("flex", banner ? "items-end" : "items-center")}
          style={banner ? { marginTop: -COVER_OVERLAP } : undefined}
        >
          <span className={cn("shrink-0 rounded-full", banner && "-m-[3px] bg-app-bg p-[3px]")}>
            {avatar ? (
              <button
                type="button"
                aria-label={`${name} 프로필 사진 크게 보기`}
                onClick={() => setAvatarOpen(true)}
                className="block rounded-full"
              >
                {avatarNode}
              </button>
            ) : (
              avatarNode
            )}
          </span>

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

        {trustLine ? <p className="mt-1.5 truncate text-[13px] leading-[18px] text-app-muted">{trustLine}</p> : null}

        {bio ? (
          <p className="mt-1.5 whitespace-pre-line break-words text-[14px] leading-[21px] text-app-text">{bio}</p>
        ) : showBioPrompt ? (
          <Link href="/editProfile" className="mt-1.5 inline-block text-[14px] leading-[21px] text-app-muted">
            소개를 추가해 보세요
          </Link>
        ) : null}

        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            aria-label={`대표 링크 ${profileLinkLabel(link)} 새 창에서 열기`}
            className="mt-1.5 flex min-w-0 items-center gap-1 text-[14px] font-semibold leading-[21px] text-app-text hover:underline"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0 text-app-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
            <span className="truncate">{profileLinkLabel(link)}</span>
          </a>
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
        {banner ? (
          <ImageLightbox
            images={[makeImageUrl(banner, "public")]}
            isOpen={bannerOpen}
            currentIndex={0}
            onClose={() => setBannerOpen(false)}
            onIndexChange={() => undefined}
            altPrefix={`${name} 커버 사진`}
          />
        ) : null}
      </div>
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
