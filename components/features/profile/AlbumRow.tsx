"use client";
/**
 * 앨범 줄(앱 AlbumRow, 시안 `.album-row`): 70×62 r12 표지 + 12px 라벨, 간격 12.
 * 순서: 내가 만든 앨범(최근 만든 순) → 종별 자동 앨범 → 본인이면 '새 앨범'.
 * 앨범이 하나도 없고 본인도 아니면 그리지 않는다.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import useSWR from "swr";
import Image from "@components/atoms/Image";
import { LineIcon } from "@components/features/profile/ProfileRows";
import { makeImageUrl } from "@libs/client/utils";
import type { AlbumSummary } from "@libs/server/profileAlbums";
import type { SpeciesAlbum } from "@libs/server/profileSpecies";

export interface SpeciesAlbumsResponse {
  success: boolean;
  albums: SpeciesAlbum[];
}
export interface UserAlbumsResponse {
  success: boolean;
  albums: AlbumSummary[];
}

/** SWR 키 접두사(글 작성·삭제·앨범 저장 뒤 다시 받을 때). */
export const speciesAlbumsKey = (userId: number | string) => `/api/users/${userId}/photo-albums`;
export const userAlbumsKey = (userId: number | string) => `/api/users/${userId}/albums`;

/** 종별 자동 앨범(PRD F-7). */
export const useSpeciesAlbums = (userId: number | string | undefined) =>
  useSWR<SpeciesAlbumsResponse>(userId ? speciesAlbumsKey(userId) : null, { revalidateOnFocus: false });

/** 사용자가 만든 앨범(PRD F-9, 최근 만든 순). */
export const useUserAlbums = (userId: number | string | undefined) =>
  useSWR<UserAlbumsResponse>(userId ? userAlbumsKey(userId) : null, { revalidateOnFocus: false });

function AlbumItem({
  label,
  cover,
  ariaLabel,
  href,
  media,
}: {
  label: string;
  cover?: string;
  ariaLabel: string;
  href: string;
  /** 표지 대신 그릴 내용('새 앨범'의 + 아이콘). */
  media?: ReactNode;
}) {
  return (
    <Link href={href} aria-label={ariaLabel} className="flex w-[70px] shrink-0 flex-col items-center">
      <span
        className={`flex h-[62px] w-[70px] items-center justify-center overflow-hidden rounded-xl ${
          media ? "bg-app-surface" : "bg-app-placeholder"
        }`}
      >
        {media ??
          (cover ? (
            <Image
              src={makeImageUrl(cover, "public")}
              alt=""
              width={70}
              height={62}
              className="h-full w-full object-cover"
            />
          ) : (
            <LineIcon name="image" size={22} className="text-app-caption" />
          ))}
      </span>
      <span className="mt-1.5 max-w-[70px] truncate text-[12px] leading-4 text-app-text">{label}</span>
    </Link>
  );
}

export default function AlbumRow({
  userId,
  albums,
  userAlbums,
  isOwner = false,
}: {
  userId: number | string;
  /** 종별 자동 앨범 */
  albums: SpeciesAlbum[] | undefined;
  /** 사용자가 만든 앨범 */
  userAlbums?: AlbumSummary[];
  isOwner?: boolean;
}) {
  const custom = userAlbums ?? [];
  const species = albums ?? [];
  if (!custom.length && !species.length && !isOwner) return null;
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-[18px] scrollbar-hide">
      {custom.map((album) => (
        <AlbumItem
          key={`album-${album.id}`}
          label={album.title}
          cover={album.cover}
          ariaLabel={`${album.title} 앨범, 사진 ${album.count}장`}
          href={`/albums/${album.id}`}
        />
      ))}
      {species.map((album) => (
        <AlbumItem
          key={`species-${album.species}`}
          label={album.species}
          cover={album.cover}
          ariaLabel={`${album.species} 사진 ${album.count}장 보기`}
          href={`/profiles/${userId}/photos?species=${encodeURIComponent(album.species)}`}
        />
      ))}
      {isOwner ? (
        <AlbumItem
          label="새 앨범"
          ariaLabel="새 앨범 만들기"
          href="/albums/edit"
          media={<LineIcon name="plus" size={22} className="text-app-text" />}
        />
      ) : null}
    </div>
  );
}
