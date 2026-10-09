"use client";
/**
 * 동네 브리더(앱 components/features/post/NearbyBreederList.tsx, 시안 design/mockups/neighborhood/A-karrot.html).
 * 반려생활 '우리 동네' 탭은 최대 3명 + '동네 브리더 전체 보기', /neighborhood/breeders 는 같은 행을 이어 그린다.
 */
import Link from "next/link";
import Image from "@components/atoms/Image";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { cn, makeImageUrl } from "@libs/client/utils";
import type { NearbyBreederItem } from "@libs/server/nearby";
import type { Region } from "@libs/shared/regions";
import type { NearbyBreedersResponse } from "pages/api/users/nearby";

/** 반려생활 상단에 보여 줄 인원. 나머지는 '동네 브리더 전체 보기'에서 본다. */
export const NEARBY_BREEDER_COUNT = 3;
/** 서버 상한과 같다. */
export const NEARBY_FULL_LIST_LIMIT = 50;
/** 웹 .app-card */
const APP_CARD = "rounded-xl border border-app-border bg-app-elevated shadow-card";

/** "강남구 브리더" / 넓혔으면 "강남구엔 아직 없어 서울특별시 전체를 보여드려요". scope none 이면 null. */
export function nearbyCaption(data: Pick<NearbyBreedersResponse, "scope" | "region"> | undefined): string | null {
  if (!data?.region) return null;
  if (data.scope === "sigungu") return `${data.region.sigungu} 브리더`;
  if (data.scope === "sido") return `${data.region.sigungu}엔 아직 없어 ${data.region.sido} 전체를 보여드려요`;
  return null;
}

/** 시안 `.nrow`: 40 아바타 · 이름 16/600 · 시/군/구 pill · "게시글 N · 댓글 N". */
export function NearbyBreederRow({ item, divider }: { item: NearbyBreederItem; divider?: boolean }) {
  return (
    <Link
      href={`/profiles/${item.user.id}`}
      aria-label={`${item.user.name}, ${item.region.sigungu}, 게시글 ${item.postsCount} 댓글 ${item.commentsCount}`}
      className={cn(
        "flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-app-surface",
        divider && "border-t border-app-line"
      )}
    >
      {item.user.avatar ? (
        <Image
          src={makeImageUrl(item.user.avatar, "avatar")}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="h-10 w-10 shrink-0 rounded-full bg-app-placeholder" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[16px] font-semibold leading-5 text-app-strong">{item.user.name}</span>
          <span className="shrink-0 rounded-full bg-app-brand-soft px-2 py-[3px] text-[12px] font-semibold leading-4 text-app-brand">
            {item.region.sigungu}
          </span>
        </span>
        <span className="mt-0.5 block text-[13px] text-app-muted">
          게시글 {item.postsCount} · 댓글 {item.commentsCount}
        </span>
      </span>
    </Link>
  );
}

export function NearbyBreederSkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn("flex items-center gap-3 px-3.5 py-3", i > 0 && "border-t border-app-line")} aria-hidden="true">
          <span className="h-10 w-10 animate-pulse rounded-full bg-app-placeholder" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3.5 w-1/2 animate-pulse rounded bg-app-placeholder" />
            <span className="h-3 w-[35%] animate-pulse rounded bg-app-placeholder" />
          </span>
        </div>
      ))}
    </>
  );
}

/** 시/도까지 0명일 때(시안 `.empty`). */
export function NearbyBreederEmpty({ region }: { region: Region | null }) {
  return (
    <div className="flex flex-col items-center px-4 py-7 text-center">
      <p className="break-keep text-[14px] text-app-muted">아직 {region?.sigungu ?? "동네"}에 표시 중인 브리더가 없어요</p>
      <p className="mt-1 text-[13px] text-app-caption">설정에서 &apos;나를 표시&apos;를 켜면 첫 브리더가 돼요</p>
    </div>
  );
}

/** 반려생활 '우리 동네' 탭 본문. `data` 가 undefined 면 스켈레톤. 미설정·비로그인 게이트는 호출하는 쪽이 그린다. */
export default function NearbyBreederList({
  data,
  isError,
  onRetry,
}: {
  data: NearbyBreedersResponse | undefined;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isError && !data) {
    return <QueryErrorState title="동네 브리더를 불러오지 못했어요" onRetry={onRetry} className="py-6" />;
  }
  const caption = nearbyCaption(data);
  const items = data?.items.slice(0, NEARBY_BREEDER_COUNT) ?? [];
  return (
    <div className={cn(APP_CARD, "mx-4 overflow-hidden")}>
      {!data ? (
        <NearbyBreederSkeletonRows count={NEARBY_BREEDER_COUNT} />
      ) : items.length === 0 ? (
        <NearbyBreederEmpty region={data.region} />
      ) : (
        <>
          {caption ? <p className="px-3.5 pb-1 pt-3 text-[13px] text-app-muted">{caption}</p> : null}
          {items.map((item, index) => (
            <NearbyBreederRow key={item.user.id} item={item} divider={index > 0} />
          ))}
          <Link
            href="/neighborhood/breeders"
            className="flex h-11 items-center justify-center gap-1 border-t border-app-line text-[14px] font-semibold text-app-strong transition-colors hover:bg-app-surface"
          >
            동네 브리더 전체 보기
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M9 6l6 6-6 6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </>
      )}
    </div>
  );
}
