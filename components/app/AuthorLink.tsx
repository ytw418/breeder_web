"use client";

import Link from "next/link";
import Image from "@components/atoms/Image";
import {
  getBreederProgramFrameClassName,
  hasBreederProgramFrame,
} from "@components/features/breeder/BreederProgramDecorators";
import { cn, makeImageUrl } from "@libs/client/utils";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";

export type AuthorLinkUser = {
  id: number;
  name: string;
  avatar?: string | null;
  breederPrograms?: BreederProgramSummary[] | null;
};

/** Tailwind 는 동적 클래스를 못 읽어 크기별 클래스를 미리 적는다. */
const AVATAR_CLASS = { 16: "h-4 w-4", 20: "h-5 w-5" } as const;

/**
 * 목록 카드의 작성자(아바타 + 닉네임, 앱 AuthorLink). 누르면 그 사람 프로필로 가고, 카드의 나머지는 상세로 간다
 * (시안 bredy_app design/mockups/author-row/A-karrot.html, PRD bredy_app docs/prd/author-row.md).
 * 카드는 상세 링크를 투명하게 덮는 구조(CardOverlayLink)라 이 링크는 z-[2] 로 그 위에 올린다.
 * 브리더 프로그램 회원은 아바타에 프레임을 두른다. 위아래 터치 여유는 -my-2 py-2.
 */
export function AuthorLink({
  user,
  avatarSize,
  className,
  nameClassName,
}: {
  user: AuthorLinkUser;
  avatarSize: keyof typeof AVATAR_CLASS;
  className?: string;
  nameClassName?: string;
}) {
  const framed = hasBreederProgramFrame(user.breederPrograms);
  const sizeClass = AVATAR_CLASS[avatarSize];
  return (
    <Link
      href={`/profiles/${user.id}`}
      aria-label={`${user.name} 프로필`}
      className={cn("relative z-[2] -my-2 flex min-w-0 items-center py-2", className)}
    >
      <span
        className={cn(
          "shrink-0",
          framed && "rounded-full p-0.5",
          framed && getBreederProgramFrameClassName(user.breederPrograms, { compact: true })
        )}
      >
        {user.avatar ? (
          <Image
            src={makeImageUrl(user.avatar, "avatar")}
            className={cn(sizeClass, "rounded-full object-cover")}
            width={avatarSize}
            height={avatarSize}
            alt=""
          />
        ) : (
          <span className={cn(sizeClass, "block rounded-full bg-app-placeholder")} />
        )}
      </span>
      <span className={cn("min-w-0 truncate", nameClassName)}>{user.name}</span>
    </Link>
  );
}

/** 카드 전체를 덮는 투명 상세 링크. 카드 루트는 relative 여야 하고, 안의 AuthorLink 만 그 위로 올라온다. */
export function CardOverlayLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} aria-label={label} className="absolute inset-0 z-[1]" />;
}

export default AuthorLink;
