"use client";
/**
 * 홈 '우리 동네 브리더'(강조, 앱 docs/prd/community-vibe.md §3.6·§3.6b, 시안 design/mockups/community-vibe/A-karrot.html .nb-*).
 * 사진 레일 바로 아래·TOP 브리더 위. 범위는 시 단위 + 반경 50km(서버 /api/users/nearby 가 계산해 regionLabel·distanceKm 를 준다).
 * - 제목 18/700 + 오른쪽 위치 칩 "{서울} 근처 50km ⌄"(누르면 동네 설정)
 * - 부제 "서울 근처 브리더 **12명** · 이번 주 인사 글 3개"
 * - 카드 레일(132, app-gap r12, 아바타 44 · 이름 14/600 · 주력 종 12 · "구로구 · 2km"/"같은 동네" 11 · 팔로우 30) 최대 10
 *   + 내가 안 보이면 맨 끝 brand-soft 카드 "나 · 아직 안 보여요 · 나도 보이기"
 * - 44 버튼 둘: '동네 사랑방'(반려생활 동네 칩) · '인사 남기기'(검정, 글쓰기 주제 동네)
 * 0명이면 §3.1 안내 카드, 비로그인·동네 미설정은 기존 안내 카드, 조회 오류면 숨긴다.
 */
import Link from "next/link";
import useSWR from "swr";
import { toLoginHref } from "@components/features/MainLayout";
import FollowButton from "@components/features/profile/FollowButton";
import { regionSettingsHref } from "@components/features/region/regionHref";
import { InitialAvatar } from "@components/ui/InitialAvatar";
import { cn } from "@libs/client/utils";
import { NEIGHBOR_RADIUS_KM, type NeighborhoodVisitors } from "@libs/shared/communityVibe";
import { REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import { regionOf } from "@libs/shared/regions";
import { regionScopeLabel } from "@libs/shared/regionScope";
import useUser from "hooks/useUser";

export const HOME_NEARBY_LIMIT = 10;
const RETURN_PATH = "/";
const NEARBY_KEY = `/api/users/nearby?limit=${HOME_NEARBY_LIMIT}`;
const VISITORS_KEY = "/api/neighborhood/visitors";
const REGION_SETTINGS = "/settings/region";
export const LOUNGE_HREF = `/posts?category=${encodeURIComponent(REGION_POST_CATEGORY)}`;
export const GREET_HREF = `/posts/upload?category=${encodeURIComponent(REGION_POST_CATEGORY)}`;

/** 서버 응답(계약 필드 + 옛 필드). 어느 쪽이 와도 그리도록 전부 선택값으로 받는다. */
type NearbyRawItem = {
  id?: number;
  name?: string;
  image?: string | null;
  /** 계약 필드: 주력 종 하나. */
  species?: string | null;
  /** 옛 필드: 주력 종 배열. */
  topSpecies?: string | string[] | null;
  regionSido?: string | null;
  regionSigungu?: string | null;
  distanceKm?: number;
  sameRegion?: boolean;
  isFollowing?: boolean;
  user?: { id: number; name: string; avatar: string | null };
  region?: { sido: string; sigungu: string } | null;
};
export type NearbyRawResponse = {
  success?: boolean;
  scope?: string;
  regionLabel?: string;
  total?: number;
  greetingCount?: number;
  items?: NearbyRawItem[];
};

export type NeighborCard = {
  id: number;
  name: string;
  image: string | null;
  species: string | null;
  /** "구로구 · 2km" 또는 "같은 동네". */
  place: string;
  isFollowing: boolean | null;
};

export type HomeNeighborhoodState =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "unset"; loggedIn: boolean }
  | { kind: "none"; label: string; visitors: number | null }
  | {
      kind: "near";
      label: string;
      total: number;
      greetingCount: number;
      items: NeighborCard[];
      /** 내가 노출을 꺼 두었으면 맨 끝에 '나도 보이기' 카드. */
      me: { name: string; image: string | null; species: string | null } | null;
    };

/** "보은군 근처" → "보은군", "서울" → "서울". 칩·부제는 뒤에 '근처'를 직접 붙인다. */
export const labelBase = (label: string) => label.replace(/\s*근처$/, "");

function toSpecies(value: NearbyRawItem["topSpecies"]): string | null {
  if (Array.isArray(value)) return value.slice(0, 2).join(" · ") || null;
  return value || null;
}

export function toNeighborCard(item: NearbyRawItem): NeighborCard | null {
  const id = item.id ?? item.user?.id;
  const name = item.name ?? item.user?.name;
  if (id == null || !name) return null;
  const sigungu = item.regionSigungu ?? item.region?.sigungu ?? "";
  const same = item.sameRegion ?? item.distanceKm === 0;
  const place = same
    ? "같은 동네"
    : typeof item.distanceKm === "number"
      ? `${sigungu ? `${sigungu} · ` : ""}${item.distanceKm}km`
      : sigungu;
  return {
    id,
    name,
    image: item.image ?? item.user?.avatar ?? null,
    species: item.species ?? toSpecies(item.topSpecies),
    place,
    isFollowing: typeof item.isFollowing === "boolean" ? item.isFollowing : null,
  };
}

/** 판정: 비로그인·미설정 → unset, 데이터 없음이면 오류 hidden·아니면 loading, 0명 → none, 그 밖 near. */
export function resolveHomeNeighborhood(input: {
  loggedIn: boolean;
  region: { sido: string; sigungu: string } | null;
  regionVisible: boolean;
  me: { name: string; image: string | null; species: string | null } | null;
  data: NearbyRawResponse | undefined;
  isError: boolean;
  visitors: number | null;
}): HomeNeighborhoodState {
  const { loggedIn, region, data } = input;
  if (!loggedIn || !region) return { kind: "unset", loggedIn };
  if (!data) return input.isError ? { kind: "hidden" } : { kind: "loading" };
  const label = data.regionLabel || regionScopeLabel(region.sido, region.sigungu);
  const items = (data.items ?? [])
    .map(toNeighborCard)
    .filter((card): card is NeighborCard => card !== null)
    .slice(0, HOME_NEARBY_LIMIT);
  if (data.scope === "none" || items.length === 0) {
    return { kind: "none", label, visitors: input.visitors };
  }
  return {
    kind: "near",
    label,
    total: data.total ?? items.length,
    greetingCount: data.greetingCount ?? 0,
    items,
    me: input.regionVisible ? null : input.me,
  };
}

/** §3.1 0명 안내 문구. */
export function neighborhoodEmptyCopy(label: string, visitors: number | null) {
  const base = labelBase(label);
  return {
    title: `${base} 근처 첫 브리더가 되어 보세요`,
    body:
      visitors && visitors > 0
        ? `이번 주 ${base} 근처에서 ${visitors}명이 둘러봤어요`
        : "인사 글은 근처 브리더 홈에 바로 보여요",
  };
}

const PIN = (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
const BUBBLE = (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  </svg>
);
const PENCIL = (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4l10-10-4-4L4 16z" />
  </svg>
);

const BUTTON = "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-[14px] font-semibold";
const SOFT = "bg-app-surface text-app-text";
const DARK = "bg-app-inverse text-app-inverse-text";

function SectionTitle({ label }: { label: string | null }) {
  return (
    <div className="flex items-end justify-between gap-3 px-4">
      <h2 className="app-t-section">우리 동네 브리더</h2>
      {label ? (
        <Link
          href={REGION_SETTINGS}
          aria-label={`동네 범위 ${labelBase(label)} 근처 ${NEIGHBOR_RADIUS_KM}km, 바꾸기`}
          className="flex shrink-0 items-center gap-1 text-[13px] text-app-muted"
          data-testid="neighborhood-location-chip"
        >
          <span className="text-app-text">{PIN}</span>
          <b className="font-semibold text-app-text">{labelBase(label)}</b> 근처 {NEIGHBOR_RADIUS_KM}km ⌄
        </Link>
      ) : null}
    </div>
  );
}

function NeighborCardView({ card }: { card: NeighborCard }) {
  return (
    <div className="flex w-[132px] shrink-0 flex-col items-center rounded-xl bg-app-gap p-3 text-center">
      <Link href={`/profiles/${card.id}`} aria-label={`${card.name}, ${card.place}`} className="flex w-full flex-col items-center">
        <InitialAvatar name={card.name} avatar={card.image} size={44} />
        <span className="mt-2 block w-full truncate text-[14px] font-semibold leading-5 text-app-text">{card.name}</span>
        <span className="block w-full truncate text-[12px] leading-4 text-app-muted">{card.species ?? " "}</span>
        <span className="mt-0.5 block w-full truncate text-[11px] leading-[14px] text-app-muted">{card.place}</span>
      </Link>
      {card.isFollowing !== null ? (
        <div className="mt-2.5 w-full">
          <FollowButton userId={card.id} isFollowing={card.isFollowing} returnPath={RETURN_PATH} size="nearby" />
        </div>
      ) : null}
    </div>
  );
}

export function NeighborhoodBreederSectionView({ state }: { state: HomeNeighborhoodState }) {
  if (state.kind === "hidden") return null;
  const label = state.kind === "near" || state.kind === "none" ? state.label : null;

  return (
    <section className="px-0 pt-6" aria-label="우리 동네 브리더" data-home-section="neighborhood_breeders">
      <SectionTitle label={label} />

      {state.kind === "loading" ? (
        <div className="mt-3 flex gap-2 overflow-hidden px-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[170px] w-[132px] shrink-0 animate-pulse rounded-xl bg-app-gap" />
          ))}
        </div>
      ) : null}

      {state.kind === "unset" ? (
        <div className="mx-4 mt-3 rounded-xl bg-app-gap p-4">
          <p className="app-t-card">가까운 브리더를 만나 보세요</p>
          <p className="app-t-meta mt-1 break-keep">
            곤충·파충류·물고기는 직거래가 생물에게 덜 힘들어요. 내 동네를 고르면 근처 {NEIGHBOR_RADIUS_KM}km 브리더가 보여요.
          </p>
          <div className="mt-3 flex">
            <Link
              href={state.loggedIn ? REGION_SETTINGS : toLoginHref(regionSettingsHref(RETURN_PATH))}
              className={cn(BUTTON, DARK)}
            >
              내 동네 설정
            </Link>
          </div>
        </div>
      ) : null}

      {state.kind === "none" ? (
        <div className="mx-4 mt-3 rounded-xl bg-app-brand-soft p-4" data-testid="neighborhood-empty">
          <p className="app-t-card break-keep">{neighborhoodEmptyCopy(state.label, state.visitors).title}</p>
          <p className="mt-1 break-keep text-[13px] leading-[18px] text-app-brand-text-soft">
            {neighborhoodEmptyCopy(state.label, state.visitors).body}
          </p>
          <div className="mt-3 flex">
            <Link href={GREET_HREF} className={cn(BUTTON, DARK)}>
              {PENCIL}
              인사 남기기
            </Link>
          </div>
        </div>
      ) : null}

      {state.kind === "near" ? (
        <>
          <p className="app-t-meta mb-3 mt-1 px-4" data-testid="neighborhood-subtitle">
            {labelBase(state.label)} 근처 브리더{" "}
            <em className="font-semibold not-italic text-app-brand">{state.total}명</em>
            {state.greetingCount > 0 ? ` · 이번 주 인사 글 ${state.greetingCount}개` : null}
          </p>
          <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
            {state.items.map((card) => (
              <NeighborCardView key={card.id} card={card} />
            ))}
            {state.me ? (
              <div className="flex w-[132px] shrink-0 flex-col items-center rounded-xl bg-app-brand-soft p-3 text-center" data-testid="neighborhood-me-card">
                <InitialAvatar name={state.me.name} avatar={state.me.image} size={44} />
                <span className="mt-2 block w-full truncate text-[14px] font-semibold leading-5 text-app-text">나</span>
                <span className="block w-full truncate text-[12px] leading-4 text-app-muted">{state.me.species ?? " "}</span>
                <span className="mt-0.5 block text-[11px] leading-[14px] text-app-muted">아직 안 보여요</span>
                <Link
                  href={REGION_SETTINGS}
                  className="mt-2.5 flex h-[30px] w-full items-center justify-center rounded-lg bg-app-brand text-[13px] font-semibold text-white"
                >
                  나도 보이기
                </Link>
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2 px-4">
            <Link href={LOUNGE_HREF} className={cn(BUTTON, SOFT)}>
              {BUBBLE}
              동네 사랑방
            </Link>
            <Link href={GREET_HREF} className={cn(BUTTON, DARK)}>
              {PENCIL}
              인사 남기기
            </Link>
          </div>
        </>
      ) : null}
    </section>
  );
}

type MaybeProfileUser = {
  name?: string | null;
  avatar?: string | null;
  regionVisible?: boolean | null;
  topSpecies?: string[] | null;
};

export default function NeighborhoodBreederSection() {
  const { user, isLoading: userLoading } = useUser();
  const region = regionOf(user);
  const { data, error } = useSWR<NearbyRawResponse>(user && region ? NEARBY_KEY : null);
  const isNone = Boolean(data && (data.scope === "none" || (data.items?.length ?? 0) === 0));
  // 0명일 때만 '이번 주 N명이 둘러봤어요'. 구 서버면 없어서 둘째 문구로 대신한다.
  const { data: visitorsData } = useSWR<NeighborhoodVisitors & { success?: boolean }>(
    user && region && isNone ? VISITORS_KEY : null,
    { shouldRetryOnError: false }
  );
  const profile = user as (typeof user & MaybeProfileUser) | null | undefined;

  const state: HomeNeighborhoodState = userLoading
    ? { kind: "loading" }
    : resolveHomeNeighborhood({
        loggedIn: Boolean(user),
        region,
        regionVisible: Boolean(profile?.regionVisible),
        me: profile
          ? {
              name: profile.name ?? "나",
              image: profile.avatar ?? null,
              species: profile.topSpecies?.slice(0, 2).join(" · ") || null,
            }
          : null,
        data: data && data.success !== false ? data : undefined,
        isError: Boolean(error) || data?.success === false,
        visitors: typeof visitorsData?.count === "number" ? visitorsData.count : null,
      });

  return <NeighborhoodBreederSectionView state={state} />;
}
