"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";

import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import { HorizontalRail } from "@components/ui/HorizontalRail";
import ShelterAnimalCard, { type ShelterAnimal } from "@components/features/pet/ShelterAnimalCard";
import {
  ShelterBreedSheet,
  ShelterRegionSheet,
  ShelterSizeSheet,
  ShelterSortSheet,
  shelterFacetsUrl,
  shelterListParams,
} from "@components/features/pet/ShelterFilterSheets";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { cn } from "@libs/client/utils";
import { uniqueById } from "@libs/productFilters";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { ProductsResponse } from "@libs/shared/home";
import {
  ADOPTION_CHIP_LABELS,
  adoptionChipPath,
  adoptionChips,
  adoptionScopePaths,
  adoptionWriteSpecies,
  isAdoptionChip,
  type AdoptionChip,
} from "@libs/shared/petSpace";
import {
  SHELTER_FILTER_QUERY_KEYS,
  parseShelterFilters,
  shelterFilterSummary,
  shelterFiltersToQuery,
  type ShelterFacetsResponse,
  type ShelterFilters,
} from "@libs/shared/shelterFilters";
import useBlocks from "hooks/useBlocks";
import useCategoryScope from "hooks/useCategoryScope";

const PAGE_SIZE = 20;

type SheetName = "region" | "breed" | "size" | "sort";

/** 입양 쪽 범위(강아지만·고양이만·둘 다)의 보호소 공고 수. 서브탭 숫자와 첫 줄 제목이 같이 쓴다. */
export function useShelterTotal(): number | undefined {
  const scope = useCategoryScope();
  const scopePaths = useMemo(() => adoptionScopePaths(scope.pins.map((pin) => pin.path)), [scope.pins]);
  const category = adoptionWriteSpecies(scopePaths) ?? undefined;
  const { data } = useSWR<ShelterFacetsResponse>(shelterFacetsUrl({ category }), { revalidateOnFocus: false });
  return data?.total;
}

const fmt = (n: number) => n.toLocaleString("ko-KR");

function FilterPill({
  label,
  applied,
  open,
  onClick,
}: {
  label: string;
  applied: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-2xl border pl-3 pr-2 text-[14px]",
        applied
          ? "border-app-text bg-app-text font-semibold text-app-bg"
          : cn("bg-app-bg font-medium text-app-text", open ? "border-app-text" : "border-app-border")
      )}
    >
      {label}
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn(applied ? "text-app-bg" : open ? "text-app-text" : "text-app-muted", open && "rotate-180")}
      >
        <path d="m6 9.5 6 6 6-6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * 입양 쪽 '보호소 아이들' 서브탭(앱 design/mockups/adoption-v2/A-karrot.html (a)~(c), 앱 docs/prd/shelter-animals.md).
 * 첫 줄 '전국 보호소에서 가족을 기다리는 아이 N마리' + '3시간마다 새 공고가 올라와요', 종 칩, 필터 알약(지역·품종·크기(강아지일 때만)·정렬),
 * 정사각 사진 2열 카드 무한 스크롤. 필터는 주소 쿼리(?sido=&sigungu=&breed=&dogSize=&sort=)에 적어 공유·검색에 쓰고,
 * 종 칩은 기존대로 ?chip=. 글쓰기 버튼은 없다(보호소 글은 서버가 쓴다). /adoption?tab=shelter 와 검색용 /adoption/shelter 가 같이 쓴다.
 */
export default function ShelterTab() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { blockedIds } = useBlocks();
  const scope = useCategoryScope();
  const scopePaths = useMemo(() => adoptionScopePaths(scope.pins.map((pin) => pin.path)), [scope.pins]);
  const chips = adoptionChips(scopePaths);
  const rawChip = searchParams?.get("chip") ?? null;
  const chip: AdoptionChip = isAdoptionChip(rawChip) ? rawChip : "all";
  const activeChip = chips.includes(chip) ? chip : "all";
  const categoryPath = adoptionChipPath(scopePaths, activeChip);
  // 종 칩을 골랐거나 범위가 한 종뿐이면 그 종. 둘 다면 undefined(크기·품종 시트가 이걸로 갈린다).
  const species = adoptionWriteSpecies(scopePaths, activeChip) ?? undefined;
  const urlFilters = useMemo(() => parseShelterFilters(searchParams), [searchParams]);
  const filters: ShelterFilters = {
    ...urlFilters,
    category: species,
    size: species === "고양이" ? undefined : urlFilters.size,
  };
  const summary = shelterFilterSummary(filters);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const total = useShelterTotal();

  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.adoptionSideView, { chip: activeChip, list: "shelter" });
  }, [activeChip]);

  const writeParams = useCallback(
    (edit: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      edit(params);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname || "/adoption", { scroll: false });
      window.scrollTo({ top: 0 });
    },
    [pathname, router, searchParams]
  );

  const applyFilters = (patch: Partial<ShelterFilters>) =>
    writeParams((params) => {
      SHELTER_FILTER_QUERY_KEYS.forEach((key) => params.delete(key));
      const next = shelterFiltersToQuery({ ...filters, ...patch, category: undefined });
      Object.keys(next).forEach((key) => params.set(key, next[key]));
    });

  const selectChip = (next: AdoptionChip) => {
    if (next === activeChip) return;
    writeParams((params) => {
      if (next === "all") params.delete("chip");
      else params.set("chip", next);
      // 품종·크기는 종마다 달라서 종을 바꾸면 푼다.
      params.delete("breed");
      params.delete("dogSize");
    });
  };

  const resetFilters = () =>
    writeParams((params) => {
      SHELTER_FILTER_QUERY_KEYS.forEach((key) => params.delete(key));
    });

  const getKey = (pageIndex: number, previous: ProductsResponse | null) => {
    if (previous && pageIndex >= (previous.pages ?? 0)) return null;
    return `/api/products?${shelterListParams(filters, categoryPath, {
      page: String(pageIndex + 1),
      size: String(PAGE_SIZE),
    }).toString()}`;
  };
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<ProductsResponse>(getKey, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  });

  const animals = useMemo(
    () =>
      withoutBlocked(
        uniqueById((data ?? []).flatMap((page) => page?.products ?? [])),
        blockedIds,
        (product) => product.userId
      ),
    [data, blockedIds]
  );
  const loadedPages = data?.length ?? 0;
  const totalPages = data?.[loadedPages - 1]?.pages ?? 0;
  const hasMore = loadedPages > 0 && loadedPages < totalPages;
  const firstPageError = Boolean(error) && loadedPages === 0;
  const nextPageError = Boolean(error) && loadedPages > 0;
  const isLoadingMore = isValidating && size > loadedPages && loadedPages > 0;
  const isFirstLoading = !data && !error;

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isValidating) {
          void setSize((current) => (current <= loadedPages ? loadedPages + 1 : current));
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, error, isValidating, loadedPages, setSize]);

  const filtered = Boolean(filters.sido?.length || filters.sigungu?.length || filters.breed?.length || filters.size);
  const showSize = species !== "고양이";

  const renderBody = () => {
    if (isFirstLoading) {
      return (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-[18px] px-4 pt-1" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i}>
              <div className="aspect-square w-full animate-pulse rounded-lg bg-app-placeholder" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-app-placeholder" />
              <div className="mt-1.5 h-3.5 w-1/2 animate-pulse rounded bg-app-placeholder" />
            </div>
          ))}
        </div>
      );
    }
    if (firstPageError) {
      return <QueryErrorState title="보호소 아이들을 불러오지 못했어요" onRetry={() => void mutate()} />;
    }
    if (animals.length === 0) {
      return (
        <div className="flex flex-col items-center px-6 py-16 text-center" data-testid="shelter-empty">
          <p className="break-keep text-[16px] font-semibold text-app-text">
            {filtered ? "조건에 맞는 아이가 없어요" : "지금 보호 중인 아이가 없어요"}
          </p>
          {filtered ? (
            <p className="mt-1.5 break-keep text-[14px] leading-5 text-app-muted">조건을 줄이면 더 많은 아이를 만날 수 있어요.</p>
          ) : null}
          {filtered || activeChip !== "all" ? (
            <button
              type="button"
              onClick={filtered ? resetFilters : () => selectChip("all")}
              className="mt-4 h-10 rounded-lg bg-app-surface px-4 text-[15px] font-semibold text-app-text"
            >
              {filtered ? "필터 초기화" : "전체 보기"}
            </button>
          ) : null}
        </div>
      );
    }
    return (
      <>
        <ul className="grid grid-cols-2 gap-x-2.5 gap-y-[18px] px-4 pt-1" aria-label="보호소 아이들">
          {animals.map((animal, index) => (
            <ShelterAnimalCard key={animal.id} animal={animal as unknown as ShelterAnimal} priority={index < 2} />
          ))}
        </ul>
        {nextPageError || isLoadingMore ? (
          <RetryFooter loading={isLoadingMore} error={nextPageError} onRetry={() => void setSize(loadedPages + 1)} />
        ) : !hasMore ? (
          <p className="py-6 text-center text-[13px] text-app-muted">모든 아이를 봤어요</p>
        ) : null}
      </>
    );
  };

  return (
    <>
      <div className="px-4 pt-3.5">
        <p className="text-[15px] font-bold leading-[22px] tracking-[-0.3px] text-app-text">
          {total === undefined
            ? "전국 보호소에서 가족을 기다리는 아이들"
            : `전국 보호소에서 가족을 기다리는 아이 ${fmt(total)}마리`}
        </p>
        <p className="mt-0.5 text-[13px] leading-[18px] text-app-muted">3시간마다 새 공고가 올라와요</p>
      </div>

      <div className="sticky top-14 z-10 bg-app-bg">
        {chips.length ? (
          <FilterChipRail>
            {chips.map((id) => (
              <FilterChip
                key={id}
                label={ADOPTION_CHIP_LABELS[id]}
                selected={activeChip === id}
                onClick={() => selectChip(id)}
              />
            ))}
          </FilterChipRail>
        ) : null}
        <HorizontalRail label="보호소 아이들 필터" className={cn("gap-1.5 px-4 pb-3", chips.length ? "pt-0" : "pt-3")}>
          <FilterPill
            label={summary.region.label}
            applied={summary.region.applied}
            open={sheet === "region"}
            onClick={() => setSheet("region")}
          />
          <FilterPill
            label={summary.breed.label}
            applied={summary.breed.applied}
            open={sheet === "breed"}
            onClick={() => setSheet("breed")}
          />
          {showSize ? (
            <FilterPill
              label={summary.size.label}
              applied={summary.size.applied}
              open={sheet === "size"}
              onClick={() => setSheet("size")}
            />
          ) : null}
          <FilterPill
            label={summary.sort.label}
            applied={summary.sort.applied}
            open={sheet === "sort"}
            onClick={() => setSheet("sort")}
          />
        </HorizontalRail>
      </div>

      <div className="pb-6">
        {renderBody()}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>

      {sheet === "region" ? (
        <ShelterRegionSheet
          category={species}
          filters={filters}
          categoryPath={categoryPath}
          onApply={applyFilters}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "breed" ? (
        <ShelterBreedSheet
          category={species}
          filters={filters}
          categoryPath={categoryPath}
          onApply={applyFilters}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "size" ? (
        <ShelterSizeSheet filters={filters} categoryPath={categoryPath} onApply={applyFilters} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "sort" ? (
        <ShelterSortSheet
          sort={filters.sort ?? "latest"}
          onApply={(sort) => applyFilters({ sort: sort === "latest" ? undefined : sort })}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </>
  );
}
