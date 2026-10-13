"use client";
/**
 * 동네 브리더(앱 components/features/post/NearbyBreederList.tsx, 시안 design/mockups/neighborhood/A-karrot.html).
 * 반려생활 '우리 동네' 탭은 최대 3명 + '동네 브리더 전체 보기', /neighborhood/breeders 는 같은 행을 이어 그린다.
 */
import Link from "next/link";
import Image from "@components/atoms/Image";
import { QueryErrorState } from "@components/app/QueryErrorState";
import WaveButton from "@components/features/chat/WaveButton";
import { cn, makeImageUrl } from "@libs/client/utils";
import type { NearbyBreederItem } from "@libs/server/nearby";
import type { NearbyBreedersResponse } from "pages/api/users/nearby";

/** 반려생활 상단에 보여 줄 인원. 나머지는 '동네 브리더 전체 보기'에서 본다. */
export const NEARBY_BREEDER_COUNT = 3;
/** 서버 상한과 같다. */
export const NEARBY_FULL_LIST_LIMIT = 50;
/** 섹션 카드는 테두리 없이 app-gap 채움(community-vibe §3.7 면 나누기). */
const APP_CARD = "rounded-xl bg-app-gap";

/** "서울 근처 브리더 12명"(시 단위 + 50km, community-vibe §3.6b). 0명·미설정이면 null. */
export function nearbyCaption(
  data: { scope?: string; regionLabel?: string; total?: number; items?: unknown[] } | undefined
): string | null {
  if (!data || data.scope !== "near" || !data.regionLabel) return null;
  const base = data.regionLabel.replace(/\s*근처$/, "");
  const total = data.total ?? data.items?.length ?? 0;
  return `${base} 근처 브리더 ${total}명`;
}

/** 시안 `.nrow`: 40 아바타 · 이름 16/600 · 시/군/구 pill · "게시글 N · 댓글 N". */
/** "구로구 · 2km" / 같은 시/군/구면 "같은 동네". */
function placeLabel(item: NearbyBreederItem): string {
  if (item.sameRegion || item.distanceKm === 0) return "같은 동네";
  return typeof item.distanceKm === "number"
    ? `${item.region.sigungu} · ${item.distanceKm}km`
    : item.region.sigungu;
}

/** 행 오른쪽 끝에 손 흔들어 인사 버튼(libs/shared/chatWave.ts). 프로필 링크와 버튼은 형제라 겹쳐 눌리지 않는다. */
export function NearbyBreederRow({
  item,
  divider,
  wavesLeftToday,
}: {
  item: NearbyBreederItem;
  divider?: boolean;
  wavesLeftToday?: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 pr-3.5 transition-colors hover:bg-app-surface",
        divider && "border-t border-app-line"
      )}
    >
    <Link
      href={`/profiles/${item.user.id}`}
      aria-label={`${item.user.name}, ${placeLabel(item)}, 게시글 ${item.postsCount} 댓글 ${item.commentsCount}`}
      className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5"
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
            {placeLabel(item)}
          </span>
        </span>
        <span className="mt-0.5 block text-[13px] text-app-muted">
          게시글 {item.postsCount} · 댓글 {item.commentsCount}
        </span>
      </span>
    </Link>
    <WaveButton
      userId={item.user.id}
      name={item.user.name}
      waved={item.waved}
      wavesLeftToday={wavesLeftToday}
    />
    </div>
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

/** 50km 안에도 0명일 때(§3.1: '없어요' 대신 첫 브리더 + 행동). */
export function NearbyBreederEmpty({ label }: { label: string | null }) {
  const base = (label ?? "").replace(/\s*근처$/, "");
  return (
    <div className="flex flex-col items-center px-4 py-7 text-center">
      <p className="break-keep text-[15px] font-semibold text-app-text">
        {base ? `${base} 근처 첫 브리더가 되어 보세요` : "우리 동네 첫 브리더가 되어 보세요"}
      </p>
      <p className="mt-1 text-[13px] text-app-muted">설정에서 &apos;나를 표시&apos;를 켜면 근처 브리더 홈에 보여요</p>
      <Link
        href="/settings/region"
        className="mt-3 flex h-9 items-center rounded-lg bg-app-inverse px-3.5 text-[14px] font-semibold text-app-inverse-text"
      >
        나도 보이기
      </Link>
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
        <NearbyBreederEmpty label={data.regionLabel ?? null} />
      ) : (
        <>
          {caption ? <p className="px-3.5 pb-1 pt-3 text-[13px] text-app-muted">{caption}</p> : null}
          {items.map((item, index) => (
            <NearbyBreederRow key={item.user.id} item={item} divider={index > 0} wavesLeftToday={data.wavesLeftToday} />
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
