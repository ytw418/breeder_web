"use client";

import Link from "next/link";
import useScopeTerms from "@/hooks/useScopeTerms";
import { withBreederWord } from "@libs/shared/scopeTerms";
import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";

import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import SubcategoryChipRow from "@components/features/category/SubcategoryChipRow";
import { getSubcategories, TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { cn, makeImageUrl } from "@libs/client/utils";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type {
  AuctionActivityRankingItem,
  BloodlineRankingItem,
  BreederRankingItem,
  ListingsRankingItem,
} from "@libs/shared/ranking";
import {
  parseRankingParams,
  RANKING_PERIODS,
  RANKING_TYPES,
  rankingEmptyTitle,
  rankingNote,
  rankingRowLabel,
  type RankingPeriodId,
  type RankingTypeId,
} from "@libs/shared/rankingTypes";
import { categoryQueryValue, subcategoryChipOptions } from "@libs/shared/subcategoryChips";
import useBlocks from "hooks/useBlocks";
import useUser from "hooks/useUser";
import { InitialAvatar } from "@components/ui/InitialAvatar";
import { normalizeRankingMe, RANKING_ME_KEY } from "@components/features/home/TopBreederRankCard";

type RankingItem = BreederRankingItem | BloodlineRankingItem | AuctionActivityRankingItem | ListingsRankingItem;

type RankingResponse = {
  success: boolean;
  items: RankingItem[];
  error?: string;
};

const TOP_LEVEL_NAMES = TOP_LEVEL_CATEGORIES.map((category) => category.id);

const formatRankDelta = (rankDelta: number) => {
  if (rankDelta > 0) return `▲ ${rankDelta}`;
  if (rankDelta < 0) return `▼ ${Math.abs(rankDelta)}`;
  return "유지";
};

/** 탭별 CTA(빈 상태·기준 줄 오른쪽). */
const RANKING_CTA: Record<RankingTypeId, { href: string; label: string }> = {
  breeders: { href: "/posts/upload", label: "활동 시작하기" },
  bloodlines: { href: "/bloodline-cards/create", label: "혈통 만들기" },
  auctions: { href: "/auctions", label: "경매 보기" },
  listings: { href: "/products/upload", label: "분양글 올리기" },
};

/** 랭킹 API 주소. 종 필터(species)는 대·소분류 이름 하나(하위 포함, 상위 제외 — 서버 speciesCategoryIds). */
const getApiUrl = (type: RankingTypeId, period: RankingPeriodId, species?: string) => {
  const params = new URLSearchParams({ limit: "50", period });
  if (species) params.set("species", species);
  const path =
    type === "breeders"
      ? "breeders"
      : type === "bloodlines"
        ? "bloodlines"
        : type === "auctions"
          ? "auction-activity"
          : "listings";
  return `/api/rankings/${path}?${params.toString()}`;
};

/** 차단 필터 기준(공개 캐시 응답이라 클라이언트가 거른다): 혈통은 만든 사람, 나머지는 사람 행. */
const ownerOf = (type: RankingTypeId, item: RankingItem) =>
  type === "bloodlines" ? (item as BloodlineRankingItem).creator?.id : (item as BreederRankingItem).user?.id;

/* ------------------------------------------------------------------ */
/* 행                                                                  */
/* ------------------------------------------------------------------ */

function SkeletonList() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex h-[72px] items-center border-b border-app-line px-4">
          <div className="h-4 w-6 animate-pulse rounded bg-app-surface" />
          <div className="ml-3 h-11 w-11 animate-pulse rounded-full bg-app-surface" />
          <div className="ml-3 flex-1">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-app-surface" />
            <div className="mt-2 h-3 w-[35%] animate-pulse rounded bg-app-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RankRow({
  rank,
  imageId,
  imageVariant = "public",
  circle,
  title,
  meta,
  right,
  href,
  isMe = false,
}: {
  rank: number;
  imageId?: string | null;
  imageVariant?: "avatar" | "public" | "product";
  circle?: boolean;
  title: string;
  meta: string;
  right?: string;
  href: string;
  /** 내 행: brand-soft 로 강조하고 ?focus=me 일 때 이 행으로 스크롤한다. */
  isMe?: boolean;
}) {
  return (
    <Link
      href={href}
      data-ranking-me={isMe ? "true" : undefined}
      aria-current={isMe ? "true" : undefined}
      className={cn(
        "flex h-[72px] scroll-mb-24 scroll-mt-20 items-center border-b border-app-line px-4 transition-colors",
        isMe ? "bg-app-brand-soft" : "bg-app-bg hover:bg-app-surface"
      )}
    >
      <span className={cn("w-6 shrink-0 text-[20px] font-bold", rank <= 3 ? "text-app-brand" : "text-app-text")}>
        {rank}
      </span>
      <div
        className={cn("ml-3 h-11 w-11 shrink-0 overflow-hidden bg-app-surface", circle ? "rounded-full" : "rounded-lg")}
      >
        {imageId ? (
          <Image
            src={makeImageUrl(imageId, imageVariant)}
            alt={title}
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="ml-3 min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-app-text">{title}</p>
        <p className="mt-0.5 truncate text-[13px] text-app-muted">{meta}</p>
      </div>
      {right ? <span className="ml-2 shrink-0 text-[12px] text-app-muted">{right}</span> : null}
    </Link>
  );
}

/** 1등 카드: 큰 사진·이름·'1등' 뱃지·기준 숫자(시안 없는 화면이라 RankRow 톤을 키운 형태). */
function TopCard({
  typeLabel,
  imageId,
  imageVariant,
  circle,
  title,
  meta,
  href,
}: {
  typeLabel: string;
  imageId?: string | null;
  imageVariant: "avatar" | "public";
  circle?: boolean;
  title: string;
  meta: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      data-testid="ranking-top-card"
      className="mx-4 mb-3 flex items-center gap-3.5 rounded-xl bg-app-brand-soft px-4 py-4 transition-colors"
    >
      <div className={cn("h-16 w-16 shrink-0 overflow-hidden bg-app-surface", circle ? "rounded-full" : "rounded-xl")}>
        {imageId ? (
          <Image
            src={makeImageUrl(imageId, imageVariant)}
            alt={title}
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <span className="inline-flex h-6 items-center rounded-full bg-app-brand px-2.5 text-[12px] font-bold text-white">
          {typeLabel} 1등
        </span>
        <p className="mt-1.5 truncate text-[18px] font-bold leading-6 text-app-text">{title}</p>
        <p className="mt-0.5 truncate text-[13px] text-app-sub">{meta}</p>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* 화면                                                                */
/* ------------------------------------------------------------------ */

const RankingClient = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { type, period, species, sub } = parseRankingParams(
    {
      tab: searchParams?.get("tab"),
      period: searchParams?.get("period"),
      species: searchParams?.get("species"),
      sub: searchParams?.get("sub"),
    },
    getSubcategories,
    TOP_LEVEL_NAMES
  );
  const { breeder } = useScopeTerms();
  const typeLabel = withBreederWord(RANKING_TYPES.find((t) => t.id === type)?.label ?? "", breeder);
  // 홈 '내 순위 ›'(/ranking?focus=me): 브리더 랭킹에서 내 행으로 스크롤해 강조한다(community-vibe F-13).
  const focusMe = searchParams?.get("focus") === "me";
  const { user } = useUser();

  const speciesValue = categoryQueryValue(species || "전체", sub);
  const subOptions = species ? subcategoryChipOptions(species, getSubcategories(species), []) : [];
  const note = rankingNote(type, period, speciesValue ?? null);
  const cta = RANKING_CTA[type];
  const apiUrl = useMemo(() => getApiUrl(type, period, speciesValue), [type, period, speciesValue]);
  const { data, error, isLoading, mutate } = useSWR<RankingResponse>(apiUrl);
  const { blockedIds } = useBlocks();

  const updateQuery = (next: Partial<{ type: RankingTypeId; period: RankingPeriodId; species: string; sub: string }>) => {
    const merged = { type, period, species, sub, ...next };
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", merged.type);
    params.set("period", merged.period);
    if (merged.species) params.set("species", merged.species);
    else params.delete("species");
    if (merged.species && merged.sub) params.set("sub", merged.sub);
    else params.delete("sub");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const items = useMemo(
    () => withoutBlocked(data?.items ?? [], blockedIds, (item) => ownerOf(type, item)),
    [type, blockedIds, data?.items]
  );

  const myItem =
    type === "breeders" && user
      ? (items as BreederRankingItem[]).find((item) => item.user.id === user.id) ?? null
      : null;
  // 내 순위 API 는 이번 주 전체 기준이라, 그 조건일 때만 목록 밖(50위 밖) 순위를 채운다.
  const meMatches = period === "weekly" && !speciesValue;
  const { data: meRaw } = useSWR<unknown>(user && type === "breeders" && meMatches ? RANKING_ME_KEY : null, {
    shouldRetryOnError: false,
  });
  const me = normalizeRankingMe(meRaw);
  const myRank = myItem?.rank ?? (meMatches ? me?.rank : null) ?? null;
  const myScore = myItem?.score ?? (meMatches ? me?.score : 0) ?? 0;
  const showMyBar = Boolean(user) && type === "breeders";
  const periodLabel = RANKING_PERIODS.find((p) => p.id === period)?.label ?? "";

  const scrolledRef = useRef(false);
  useEffect(() => {
    if (!focusMe || scrolledRef.current || !myItem) return;
    const row = document.querySelector<HTMLElement>("[data-ranking-me]");
    if (!row) return;
    scrolledRef.current = true;
    row.scrollIntoView({ block: "center" });
  }, [focusMe, myItem]);

  /** 행 하나의 그림 값(1등 카드와 목록 행이 같이 쓴다). */
  const rowOf = (item: RankingItem) => {
    if (type === "bloodlines") {
      const bloodline = item as BloodlineRankingItem;
      return {
        key: bloodline.bloodlineRootId,
        imageId: bloodline.image,
        imageVariant: "public" as const,
        circle: false,
        title: bloodline.name,
        meta: `${bloodline.speciesType || "종 미지정"} · ${rankingRowLabel(type, bloodline, period)}`,
        href: `/bloodline-management/card/${bloodline.bloodlineRootId}`,
        isMe: false,
      };
    }
    const person = item as BreederRankingItem | AuctionActivityRankingItem | ListingsRankingItem;
    const meta =
      type === "breeders"
        ? (() => {
            const breeder = person as BreederRankingItem;
            return breeder.productsCount !== undefined
              ? `${rankingRowLabel(type, breeder, period)} · 게시 ${breeder.postsCount} · 분양글 ${breeder.productsCount}`
              : `${rankingRowLabel(type, breeder, period)} · 게시 ${breeder.postsCount} · 댓글 ${breeder.commentsCount}`;
          })()
        : rankingRowLabel(type, person, period);
    return {
      key: person.user.id,
      imageId: person.user.avatar,
      imageVariant: "avatar" as const,
      circle: true,
      title: person.user.name,
      meta,
      href: `/profiles/${person.user.id}`,
      isMe: person.user.id === user?.id,
    };
  };

  let list;
  if (isLoading) {
    list = <SkeletonList />;
  } else if ((error && !data) || data?.success === false) {
    list = (
      <div className="flex flex-col items-center px-4 py-14 text-center" role="alert">
        <p className="text-[14px] text-app-muted">
          {data?.error || (error instanceof Error && error.message) || "랭킹을 불러오지 못했습니다."}
        </p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="mt-4 h-10 rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
        >
          다시 시도
        </button>
      </div>
    );
  } else if (items.length === 0) {
    list = (
      <div className="flex flex-col items-center px-4 py-14 text-center">
        <p className="text-[16px] font-semibold text-app-text">{rankingEmptyTitle(type, period, speciesValue ?? null)}</p>
        {sub ? (
          <p className="mt-1.5 text-[13px] text-app-muted">소분류를 고르지 않은 글은 대분류에서만 세요</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          {period !== "all" ? (
            <button
              type="button"
              onClick={() => updateQuery({ period: "all" })}
              className="h-10 rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
            >
              역대 랭킹 보기
            </button>
          ) : null}
          {speciesValue ? (
            <button
              type="button"
              onClick={() => updateQuery({ species: "", sub: "" })}
              className="h-10 rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
            >
              전체 종으로 보기
            </button>
          ) : (
            <Link
              href={cta.href}
              className="inline-flex h-10 items-center rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
            >
              {cta.label}
            </Link>
          )}
        </div>
      </div>
    );
  } else {
    const [first, ...rest] = items;
    const top = rowOf(first);
    list = (
      <div className="pt-3">
        <TopCard
          typeLabel={typeLabel}
          imageId={top.imageId}
          imageVariant={top.imageVariant}
          circle={top.circle}
          title={top.title}
          meta={top.meta}
          href={top.href}
        />
        <div className="border-t border-app-line">
          {rest.map((item) => {
            const row = rowOf(item);
            return (
              <RankRow
                key={row.key}
                rank={item.rank}
                imageId={row.imageId}
                imageVariant={row.imageVariant}
                circle={row.circle}
                title={row.title}
                meta={row.meta}
                right={period !== "all" ? formatRankDelta(item.rankDelta) : undefined}
                href={row.href}
                isMe={row.isMe}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Layout canGoBack title="랭킹" seoTitle="랭킹">
      <div className="min-h-screen bg-app-bg pb-8">
        {/* 1단: 랭킹 종류(밑줄 탭 4칸) */}
        <div role="tablist" aria-label="랭킹 종류" className="flex border-b border-app-line px-2">
          {RANKING_TYPES.map((tab) => {
            const selected = type === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => updateQuery({ type: tab.id })}
                className={cn(
                  "relative h-12 flex-1 text-[15px]",
                  selected ? "font-bold text-app-text" : "font-medium text-app-muted"
                )}
              >
                {withBreederWord(tab.label, breeder)}
                {selected ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-app-text" /> : null}
              </button>
            );
          })}
        </div>

        {/* 2단: 기간(세그먼트 3칸) */}
        <div className="px-4 pt-3" role="radiogroup" aria-label="랭킹 기간">
          <div className="flex h-9 rounded-lg bg-app-surface p-0.5">
            {RANKING_PERIODS.map((periodTab) => {
              const selected = period === periodTab.id;
              return (
                <button
                  key={periodTab.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => updateQuery({ period: periodTab.id })}
                  className={cn(
                    "flex-1 rounded-md text-[14px]",
                    selected ? "bg-app-elevated font-semibold text-app-text shadow-sm" : "font-medium text-app-muted"
                  )}
                >
                  {periodTab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3단: 종(대분류 칩 + 소분류 칩) */}
        <FilterChipRail className="mt-1">
          {[{ id: "", name: "전체" }, ...TOP_LEVEL_CATEGORIES].map((category) => (
            <FilterChip
              key={category.id || "all"}
              label={category.name}
              selected={species === category.id}
              onClick={() => updateQuery({ species: category.id, sub: "" })}
            />
          ))}
        </FilterChipRail>
        <SubcategoryChipRow
          options={subOptions}
          value={sub}
          onChange={(next) => updateQuery({ sub: next })}
          className="-mt-1"
        />

        {/* 랭킹 기준 한 줄 + 링크 */}
        <div className="flex items-center px-4 pb-1 pt-2">
          <p className="min-w-0 flex-1 truncate text-[13px] text-app-muted">{note}</p>
          <Link href={cta.href} className="ml-2 shrink-0 text-[13px] font-semibold text-app-muted">
            {cta.label} ›
          </Link>
        </div>

        <div>{list}</div>
        {showMyBar ? <div className="h-20" aria-hidden="true" /> : null}
      </div>

      {/* 하단 내 순위 고정 바(아바타 · "7위 · 26점" · 글쓰기) */}
      {showMyBar && user ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 bg-app-bg pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--app-line)]"
          data-testid="ranking-my-bar"
        >
          <div className="mx-auto flex h-16 max-w-xl items-center gap-3 px-4">
            <InitialAvatar name={user.name} avatar={user.avatar ?? null} size={36} />
            <button
              type="button"
              onClick={() =>
                document.querySelector<HTMLElement>("[data-ranking-me]")?.scrollIntoView({ block: "center", behavior: "smooth" })
              }
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-[15px] font-semibold leading-5 text-app-text tabular-nums">
                {myRank ? (
                  <>
                    나 <em className="not-italic text-app-brand">{myRank}위</em> · {myScore.toLocaleString()}점
                  </>
                ) : (
                  <>나 · {myScore.toLocaleString()}점</>
                )}
              </span>
              <span className="block truncate text-[12px] leading-4 text-app-muted">
                {myRank ? `${periodLabel} 내 순위` : "글을 쓰면 순위에 올라요"}
              </span>
            </button>
            <Link
              href="/posts/upload"
              className="flex h-9 shrink-0 items-center rounded-lg bg-app-inverse px-3.5 text-[14px] font-semibold text-app-inverse-text"
            >
              글쓰기
            </Link>
          </div>
        </div>
      ) : null}
    </Layout>
  );
};

export default RankingClient;
