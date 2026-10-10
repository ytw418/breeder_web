"use client";
/**
 * 홈 '우리 동네 브리더'(앱 src/components/features/home/NeighborhoodBreederSection.tsx,
 * 시안 앱 design/mockups/home-neighborhood/A-karrot.html, PRD 앱 docs/prd/home-neighborhood.md).
 * 배너 아래·이번 주 TOP 브리더 위에 둔다. 상태 판정·문구는 libs/shared/neighborhoodSection.ts(앱과 같은 사본).
 * 동네 단체 채팅방은 1차에서 빼고 '동네 사랑방'(반려생활 동네 글)으로 대신한다(2026-10-09 사용자 결정).
 */
import { useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import Toggle from "@components/app/Toggle";
import { toLoginHref } from "@components/features/MainLayout";
import FollowButton from "@components/features/profile/FollowButton";
import { ProfileAvatar } from "@components/features/profile/ProfileRows";
import { authFetch } from "@libs/client/authFetch";
import { revalidateByPrefix } from "@libs/client/swrRevalidate";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import {
  HOME_NEARBY_LIMIT,
  neighborhoodCardCaption,
  neighborhoodNoneCopy,
  neighborhoodSubtitle,
  resolveNeighborhoodSection,
  type NeighborhoodListScope,
  type NeighborhoodSectionState,
} from "@libs/shared/neighborhoodSection";
import { REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import { regionOf } from "@libs/shared/regions";
import type { NearbyBreederItem } from "@libs/server/nearby";
import type { NearbyBreedersResponse } from "pages/api/users/nearby";
import useUser from "hooks/useUser";

const RETURN_PATH = "/";
const NEARBY_KEY = `/api/users/nearby?limit=${HOME_NEARBY_LIMIT}`;
const LOUNGE_HREF = `/posts?category=${encodeURIComponent(REGION_POST_CATEGORY)}`;
const GREET_HREF = `/posts/upload?category=${encodeURIComponent(REGION_POST_CATEGORY)}`;
const VISIBLE_SAVED = "이제 동네 이웃에게 보여요";
const VISIBLE_FAILED = "설정을 저장하지 못했어요";

/** 앱 Icon chat·pencil 과 같은 path. */
const CHAT_PATH =
  "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z";
const PENCIL_PATH =
  "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z";

function ActionIcon({ d }: { d: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d={d} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 홈 SectionHeader 와 같은 모양(18/700 + 12 muted 보조 + 13 muted 링크). */
function Header({ subtitle, showAll }: { subtitle: string | null; showAll: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3 px-4">
      <div className="min-w-0">
        <h2 className="text-[18px] font-bold tracking-tight text-app-strong">우리 동네 브리더</h2>
        {subtitle ? <p className="mt-1 break-keep text-[12px] font-medium text-app-muted">{subtitle}</p> : null}
      </div>
      {showAll ? (
        <Link
          href="/neighborhood/breeders"
          className="inline-flex h-7 shrink-0 items-center text-[13px] font-medium text-app-muted"
        >
          전체 보기 ›
        </Link>
      ) : null}
    </div>
  );
}

/** 시안 `.bc`: 132 폭 카드. 아바타 높이를 프레임 유무와 상관없이 맞춰 이름 줄이 나란하게 둔다. */
function BreederCard({ item, scope }: { item: NearbyBreederItem; scope: NeighborhoodListScope }) {
  const caption = neighborhoodCardCaption(item, scope);
  return (
    <div className="flex w-[132px] shrink-0 flex-col items-center rounded-xl border border-app-line bg-app-elevated px-3 pb-3 pt-3">
      <Link
        href={`/profiles/${item.user.id}`}
        aria-label={`${item.user.name}, ${caption}`}
        className="flex w-full flex-col items-center"
      >
        <span className="flex h-[68px] items-center justify-center">
          <ProfileAvatar avatar={item.user.avatar} name={item.user.name} programs={item.breederPrograms} size={56} />
        </span>
        <span className="mt-1.5 block w-full truncate text-center text-[14px] font-semibold leading-5 text-app-strong">
          {item.user.name}
        </span>
        <span className="mt-0.5 block w-full truncate text-center text-[12px] leading-4 text-app-muted">{caption}</span>
      </Link>
      {/* 팔로우 여부를 모르면(옛 응답) 토글이 이미 팔로우한 사람을 끊을 수 있어 버튼을 숨긴다(앱과 같다). */}
      {typeof item.isFollowing === "boolean" ? (
        <div className="mt-3 w-full">
          <FollowButton userId={item.user.id} isFollowing={item.isFollowing} returnPath={RETURN_PATH} size="card" />
        </div>
      ) : null}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex w-[132px] shrink-0 flex-col items-center rounded-xl border border-app-line px-3 pb-3 pt-3" aria-hidden="true">
      <span className="my-1.5 h-14 w-14 animate-pulse rounded-full bg-app-surface" />
      <span className="mt-1.5 h-3.5 w-3/4 animate-pulse rounded bg-app-surface" />
      <span className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-app-surface" />
      <span className="mt-3 h-8 w-full animate-pulse rounded-lg bg-app-surface" />
    </div>
  );
}

const CTA_CARD = "mx-4 mt-3 rounded-xl border border-app-line bg-app-elevated p-5";
const BUTTON = "flex h-11 flex-1 items-center justify-center rounded-md text-[14px] font-semibold";
const PRIMARY = "bg-app-brand text-white";
const SECONDARY = "bg-app-surface text-app-strong";

export function NeighborhoodBreederSectionView({
  state,
  visibleSaving,
  onShowMe,
}: {
  state: NeighborhoodSectionState<NearbyBreederItem>;
  visibleSaving: boolean;
  onShowMe: () => void;
}) {
  if (state.kind === "hidden") return null;
  const subtitle = neighborhoodSubtitle(state);
  const listed = state.kind === "filled" || state.kind === "widened";

  return (
    <section className="pb-2 pt-4" aria-label="우리 동네 브리더" data-home-section="neighborhood_breeders">
      <Header subtitle={subtitle} showAll={listed} />

      {state.kind === "loading" ? (
        <div className="mt-3 flex gap-2 overflow-hidden px-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : null}

      {state.kind === "unset" ? (
        <div className={CTA_CARD}>
          <p className="text-[16px] font-semibold leading-[22px] text-app-strong">가까운 브리더를 만나 보세요</p>
          <p className="mt-1 break-keep text-[14px] leading-5 text-app-muted">
            곤충·파충류·물고기는 직거래가 생물에게 덜 힘들어요. 내 동네를 고르면 같은 구 브리더가 보여요.
          </p>
          <div className="mt-4 flex">
            <Link
              href={state.loggedIn ? "/settings/region" : toLoginHref("/settings/region")}
              className={cn(BUTTON, PRIMARY)}
            >
              내 동네 설정
            </Link>
          </div>
        </div>
      ) : null}

      {state.kind === "none" ? (
        <div className={CTA_CARD}>
          <p className="break-keep text-[16px] font-semibold leading-[22px] text-app-strong">
            {neighborhoodNoneCopy(state.region, state.visible).title}
          </p>
          <p className="mt-1 break-keep text-[14px] leading-5 text-app-muted">
            {neighborhoodNoneCopy(state.region, state.visible).body}
          </p>
          <div className="mt-4 flex gap-2">
            {state.visible ? (
              <Link href={GREET_HREF} className={cn(BUTTON, PRIMARY)}>
                인사 남기기
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onShowMe}
                  disabled={visibleSaving}
                  aria-busy={visibleSaving}
                  className={cn(BUTTON, PRIMARY, visibleSaving && "opacity-70")}
                >
                  나를 표시하기
                </button>
                <Link href={GREET_HREF} className={cn(BUTTON, SECONDARY)}>
                  인사 남기기
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}

      {listed ? (
        <>
          <div className="app-rail mt-3 flex gap-2 px-4">
            {state.items.map((item) => (
              <BreederCard key={item.user.id} item={item} scope={state.kind === "widened" ? "sido" : "sigungu"} />
            ))}
          </div>
          <div className="mt-3 flex gap-2 px-4">
            <Link href={LOUNGE_HREF} className={cn(BUTTON, SECONDARY, "gap-1.5")}>
              <ActionIcon d={CHAT_PATH} />
              동네 사랑방
            </Link>
            <Link href={GREET_HREF} className={cn(BUTTON, SECONDARY, "gap-1.5")}>
              <ActionIcon d={PENCIL_PATH} />
              인사 남기기
            </Link>
          </div>
          {state.showVisibleSwitch ? (
            <div className="mx-4 mt-3 flex items-center border-t border-app-line pt-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-5 text-app-strong">나도 동네 브리더로 보이기</p>
                <p className="text-[12px] leading-4 text-app-muted">닉네임과 구까지만 보여요</p>
              </div>
              <Toggle checked={false} disabled={visibleSaving} onChange={onShowMe} label="나도 동네 브리더로 보이기" />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default function NeighborhoodBreederSection() {
  const { user, isLoading: userLoading, mutate: mutateUser } = useUser();
  const { cache, mutate } = useSWRConfig();
  const region = regionOf(user);
  const { data, error } = useSWR<NearbyBreedersResponse>(user && region ? NEARBY_KEY : null);
  // 켜는 동안엔 켜진 것으로 보고(줄·버튼이 바로 사라짐), 실패하면 되돌린다.
  const [visibleOverride, setVisibleOverride] = useState<boolean | null>(null);
  const regionVisible = visibleOverride ?? Boolean(user?.regionVisible);

  const state: NeighborhoodSectionState<NearbyBreederItem> = userLoading
    ? { kind: "loading" }
    : resolveNeighborhoodSection({
        loggedIn: Boolean(user),
        region,
        regionVisible,
        data: data?.success ? data : undefined,
        isError: Boolean(error) || data?.success === false,
      });

  const showMe = async () => {
    if (visibleOverride !== null) return;
    setVisibleOverride(true);
    try {
      const res = await authFetch("/api/users/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionVisible: true }),
      });
      const result = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !result?.success) throw new Error(result?.error || VISIBLE_FAILED);
      // 다시 받기가 실패해도 켜진 상태로 남도록 사용자 캐시를 먼저 바꾼다.
      await mutateUser(
        (current) =>
          current?.profile ? { ...current, profile: { ...current.profile, regionVisible: true } } : current,
        { revalidate: true }
      );
      revalidateByPrefix({ cache, mutate }, ["/api/users/nearby", "/api/posts"]);
      toast.success(VISIBLE_SAVED);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : VISIBLE_FAILED);
    } finally {
      setVisibleOverride(null);
    }
  };

  return (
    <NeighborhoodBreederSectionView
      state={state}
      visibleSaving={visibleOverride !== null}
      onShowMe={() => void showMe()}
    />
  );
}
