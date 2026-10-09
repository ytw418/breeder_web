"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Image from "@components/atoms/Image";
import {
  getBreederProgramFrameClassName,
  hasBreederProgramFrame,
} from "@components/features/breeder/BreederProgramDecorators";
import { cn, makeImageUrl } from "@libs/client/utils";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";

/* ------------------------------------------------------------------ */
/* 라인 아이콘 (앱 src/components/ui/Icon.tsx 와 같은 heroicon path, 1.5px) */
/* ------------------------------------------------------------------ */

export const PROFILE_ICON_PATHS = {
  "shopping-cart": [
    "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  ],
  bag: ["M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"],
  "heart-outline": [
    "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  ],
  settings: [
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  ],
  support: [
    "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-3 3-3-3z",
  ],
  logout: [
    "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  ],
  "chevron-right": ["M9 5l7 7-7 7"],
  "chevron-down": ["M19 9l-7 7-7-7"],
  image: [
    "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  ],
  more: [
    "M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z",
  ],
  share: ["M12 16V3m-4 4l4-4 4 4M5 12v9h14v-9"],
  plus: ["M12 4v16m8-8H4"],
} as const;

export type ProfileIconName = keyof typeof PROFILE_ICON_PATHS;

export function LineIcon({
  name,
  size = 22,
  className,
  strokeWidth = 1.5,
}: {
  name: ProfileIconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {PROFILE_ICON_PATHS[name].map((d) => (
        <path key={d} d={d} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 공통 블록                                                            */
/* ------------------------------------------------------------------ */

/** 8px 회색 섹션 갭. */
export function SectionGap() {
  return <div className="h-2 bg-app-gap" aria-hidden="true" />;
}

export function LoadingBlock({ height = 128 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }} role="status" aria-label="불러오는 중">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-app-border border-t-app-brand" />
    </div>
  );
}

/** 빈 상태(높이 144): 제목 15/600 muted + 설명 13 muted + 선택 액션. */
export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[144px] flex-col items-center justify-center px-4 text-center">
      <p className="text-[15px] font-semibold text-app-muted">{title}</p>
      {description ? <p className="mt-1 text-[13px] text-app-muted">{description}</p> : null}
      {action}
    </div>
  );
}

/** 빈 상태(높이 144) — 한 줄 14 muted 가운데. */
export function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="flex h-36 items-center justify-center px-5 text-center">
      <p className="text-[14px] text-app-muted">{message}</p>
    </div>
  );
}

/** 오류 + 다시 시도(앱 RetryBlock). */
export function RetryBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-4 py-7 text-center">
      <p className="text-[14px] text-app-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 h-10 rounded-md bg-app-surface px-3.5 text-[14px] font-semibold text-app-text"
      >
        다시 시도
      </button>
    </div>
  );
}

/** 보조 버튼 클래스(h32 r6 surface 13/600). */
export const SMALL_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-app-surface px-3 text-[13px] font-semibold text-app-text disabled:opacity-60";

/* ------------------------------------------------------------------ */
/* 메뉴 행                                                              */
/* ------------------------------------------------------------------ */

/** 48 플랫 메뉴 행(아이콘 22 · 15/500 · chevron). href 면 링크, 아니면 버튼. */
export function MenuRow({
  label,
  icon,
  href,
  onClick,
  chevron = true,
}: {
  label: string;
  icon: ProfileIconName;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const className =
    "flex min-h-[48px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-app-surface";
  const inner = (
    <>
      <LineIcon name={icon} size={22} className="text-app-text" />
      <span className="flex-1 text-[15px] font-medium text-app-text">{label}</span>
      {chevron ? <LineIcon name="chevron-right" size={18} className="text-app-caption" /> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

/** 판매내역 · 구매내역 · (본인만) 관심목록. 다른 사람 프로필에는 관심목록을 두지 않는다(서버도 403). */
export function TransactionMenu({ userId, isMine }: { userId: number | string; isMine: boolean }) {
  return (
    <div className="py-1">
      <MenuRow label="판매내역" icon="shopping-cart" href={`/profiles/${userId}/sales`} />
      <MenuRow label="구매내역" icon="bag" href={`/profiles/${userId}/purchases`} />
      {isMine ? (
        <MenuRow label="관심목록" icon="heart-outline" href={`/profiles/${userId}/favs`} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 아바타                                                               */
/* ------------------------------------------------------------------ */

/**
 * 56 원형 아바타. 사진이 없으면 surface 원 + 이름 첫 글자(20/700 muted).
 * 브리더 프로그램이 있으면 앱처럼 그라데이션 프레임(3px) + 링을 두른다.
 */
export function ProfileAvatar({
  avatar,
  name,
  programs,
  size = 56,
}: {
  avatar?: string | null;
  name: string;
  programs?: BreederProgramSummary[] | null;
  size?: number;
}) {
  const inner = avatar ? (
    <Image
      src={makeImageUrl(avatar, "avatar")}
      alt={`${name} 프로필 이미지`}
      width={size}
      height={size}
      className="rounded-full bg-app-surface object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex items-center justify-center rounded-full bg-app-surface"
      style={{ width: size, height: size }}
      aria-label={`${name} 프로필 이미지`}
      role="img"
    >
      <span className="font-bold text-app-muted" style={{ fontSize: Math.round(size * 0.36) }}>
        {name.trim().charAt(0) || "브"}
      </span>
    </div>
  );

  if (!hasBreederProgramFrame(programs)) {
    return <div className="shrink-0">{inner}</div>;
  }
  // 프레임(3px 패딩) + 바깥 링 3px 만큼 자리를 잡아 옆 글자와 겹치지 않게 한다.
  return (
    <div className="shrink-0 p-[3px]">
      <div className={cn("rounded-full p-[3px]", getBreederProgramFrameClassName(programs))}>{inner}</div>
    </div>
  );
}

/** 56 썸네일(r12). 이미지가 없으면 이미지 아이콘. */
export function Thumb({ imageId, variant, alt }: { imageId?: string | null; variant: "product" | "public"; alt: string }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-app-surface">
      {imageId ? (
        <Image
          src={makeImageUrl(imageId, variant)}
          alt={alt}
          width={56}
          height={56}
          className="h-full w-full object-cover"
        />
      ) : (
        <LineIcon name="image" size={20} className="text-app-caption" />
      )}
    </div>
  );
}
