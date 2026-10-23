"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWRInfinite from "swr/infinite";

import Layout from "@components/features/MainLayout";
import SaleTabSwitch, { SaleTabSwipeArea } from "@components/features/product/SaleTabSwitch";
import FloatingButton, { FAB_LIST_BOTTOM_PADDING_CLASS } from "@components/atoms/floating-button";
import CategoryScopeBar from "@components/features/category/CategoryScopeBar";
import FosterRail from "@components/features/pet/FosterRail";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { ProductCard } from "@components/app/ProductCard";
import CoupangBanner from "@components/app/ads/CoupangBanner";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { getCoupangWebConfig } from "@libs/client/adsConfig";
import { withAdRows } from "@libs/shared/ads/adRows";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { ProductsResponse } from "@libs/shared/home";
import { adoptionScopePaths, adoptionWriteSpecies, CAT_PATH, DOG_PATH } from "@libs/shared/petSpace";
import { uniqueById } from "@libs/productFilters";
import useBlocks from "hooks/useBlocks";
import useCategoryScope from "hooks/useCategoryScope";
import { ProductRowSkeleton } from "../products/_components/ProductRowSkeleton";

/** 입양 쪽엔 AdSense·AdMob 을 두지 않고 쿠팡만(docs/prd/pet-space.md §7, ads.md §10 생물 거래 화면). */
const ADOPTION_ADS_ENABLED = Boolean(getCoupangWebConfig());
const PAGE_SIZE = 12;

type AdoptionChip = "all" | "foster" | "rehoming" | "dog" | "cat";

const CHIP_LABELS: Record<AdoptionChip, string> = {
  all: "전체",
  foster: "임보 구해요",
  rehoming: "가족 찾아요",
  dog: "강아지",
  cat: "고양이",
};

const isAdoptionChip = (value: string | null): value is AdoptionChip =>
  value !== null && value in CHIP_LABELS;

const EMPTY_COPY: Record<"foster" | "rehoming", { title: string; body: string; action: string }> = {
  foster: {
    title: "아직 임보 구하는 글이 없어요",
    body: "잠시 맡아 줄 분(임시보호)이 필요한 아이가 있다면 글을 올려 주세요.",
    action: "임보 구하는 글 쓰기",
  },
  rehoming: {
    title: "아직 가족을 기다리는 아이가 없어요",
    body: "구조했거나 사정이 생겨 새 가족을 찾는 아이가 있다면 글을 올려 주세요.",
    action: "가족 찾는 글 쓰기",
  },
};

/**
 * 분양 탭 '입양' 쪽(앱 docs/prd/pet-space.md §5.4, 시안 pet-space/A-karrot.html ③ — 앱 src/app/(tabs)/products.tsx mode=adoption).
 * 강아지·고양이를 고정한 사람에게만 '분양 | 입양' 전환으로 보인다. 칩: 전체 · 임보 구해요 · 가족 찾아요 · 강아지 · 고양이
 * (둘 다 고정했을 때만 종 칩). 전체·종 칩이면 맨 위 '임보해 주실 분 찾아요' 레일 + 8 갭(0개면 둘 다 숨김) + '가족을 기다려요'
 * (가족 찾아요 글), 종류 칩이면 그 종류 목록만. 늘 강아지·고양이 안에서만 찾는다(adoptionScopePaths).
 * 칩은 URL(?chip=)에 적어 상세에 갔다 와도 그대로다.
 */
export default function AdoptionClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawChip = searchParams?.get("chip") ?? null;
  const chip: AdoptionChip = isAdoptionChip(rawChip) ? rawChip : "all";
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { blockedIds } = useBlocks();
  const scope = useCategoryScope();
  const scopePaths = useMemo(() => adoptionScopePaths(scope.pins.map((pin) => pin.path)), [scope.pins]);
  const bothSpecies = scopePaths.includes(DOG_PATH) && scopePaths.includes(CAT_PATH);
  const chips: AdoptionChip[] = bothSpecies ? ["all", "foster", "rehoming", "dog", "cat"] : ["all", "foster", "rehoming"];
  const activeChip = chips.includes(chip) ? chip : "all";
  const categoryPath =
    activeChip === "dog" ? DOG_PATH : activeChip === "cat" ? CAT_PATH : scopePaths.join(",");
  const listKind: "foster" | "rehoming" = activeChip === "foster" ? "foster" : "rehoming";
  const withRail = activeChip !== "foster" && activeChip !== "rehoming";

  // 입양 쪽을 본 횟수(docs/prd/pet-space.md §10). 칩을 바꿀 때마다 세어 어느 칩을 많이 보는지 본다.
  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.adoptionSideView, { chip: activeChip });
  }, [activeChip]);

  const selectChip = (next: AdoptionChip) => {
    if (next === activeChip) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "all") params.delete("chip");
    else params.set("chip", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname || "/adoption", { scroll: false });
    window.scrollTo({ top: 0 });
  };

  const getKey = (pageIndex: number, previous: ProductsResponse | null) => {
    if (previous && pageIndex >= (previous.pages ?? 0)) return null;
    const search = new URLSearchParams({
      page: String(pageIndex + 1),
      size: String(PAGE_SIZE),
      dealType: listKind,
      categoryPath,
    });
    return `/api/products?${search.toString()}`;
  };
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<ProductsResponse>(getKey, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  });

  const products = useMemo(
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

  // 종을 알면(종 칩·한 종만 고정) 글쓰기에서 강아지·고양이를 미리 고른다.
  const writeSpecies = adoptionWriteSpecies(scopePaths, activeChip);
  const writeHref = `/products/upload?kind=${listKind}${writeSpecies ? `&category=${encodeURIComponent(writeSpecies)}` : ""}`;
  const empty = EMPTY_COPY[listKind];

  const renderState = () => {
    if (isFirstLoading) return <ProductRowSkeleton count={4} />;
    if (firstPageError) {
      return <QueryErrorState title="입양 목록을 불러오지 못했어요" onRetry={() => void mutate()} />;
    }
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center" data-testid="adoption-empty">
        <p className="break-keep text-[16px] font-semibold text-app-text">{empty.title}</p>
        <p className="mt-1.5 break-keep text-[15px] leading-[22px] text-app-muted">{empty.body}</p>
        <button
          type="button"
          onClick={() => router.push(writeHref)}
          className="mt-4 h-10 rounded-lg bg-app-surface px-4 text-[15px] font-semibold text-app-text"
        >
          {empty.action}
        </button>
      </div>
    );
  };

  return (
    <Layout icon hasTabBar title="분양" seoTitle="입양" showSearch>
      <CategoryScopeBar />
      <SaleTabSwitch active="adoption" />
      {/* 목록을 좌우로 밀어도 칸을 넘긴다(앱 SaleTabSwipe 와 같은 규칙). */}
      <SaleTabSwipeArea active="adoption">
        <div className="sticky top-14 z-10 border-b border-app-line bg-app-bg">
          <FilterChipRail>
            {chips.map((id) => (
              <FilterChip
                key={id}
                label={CHIP_LABELS[id]}
                selected={activeChip === id}
                onClick={() => selectChip(id)}
              />
            ))}
          </FilterChipRail>
        </div>

        {withRail ? (
          <>
            <FosterRail key={categoryPath} categoryPath={categoryPath} onShowAll={() => selectChip("foster")} />
            <h2 className="px-4 pb-1 pt-5 text-[16px] font-bold leading-[22px] text-app-text">가족을 기다려요</h2>
          </>
        ) : null}

        <div className={FAB_LIST_BOTTOM_PADDING_CLASS}>
          {products.length > 0
            ? withAdRows(products, ADOPTION_ADS_ENABLED).map((product) =>
                "kind" in product ? (
                  <CoupangBanner key={`ad-${product.slot}`} variant="row" />
                ) : (
                  <ProductCard
                    key={product.id}
                    product={{
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      image: product.photos?.[0],
                      createdAt: product.createdAt,
                      category: product.category,
                      status: product.status,
                      wishCount: product._count?.favs,
                      viewCount: product.viewCount,
                      photoCount: product.photos?.length ?? 0,
                      sellerId: product.userId,
                      seller: product.user ?? null,
                      dealType: product.dealType,
                      petInfo: product.petInfo,
                      regionSido: product.regionSido,
                      regionSigungu: product.regionSigungu,
                    }}
                    markUnread
                  />
                )
              )
            : renderState()}

          {products.length > 0 ? (
            nextPageError || isLoadingMore ? (
              <RetryFooter
                loading={isLoadingMore}
                error={nextPageError}
                onRetry={() => void setSize(loadedPages + 1)}
              />
            ) : !hasMore ? (
              <p className="py-6 text-center text-[13px] text-app-muted">모든 글을 봤어요</p>
            ) : null
          ) : null}
          <div ref={sentinelRef} aria-hidden="true" />
        </div>

        <FloatingButton href={writeHref} label={listKind === "foster" ? "임보 구하는 글 쓰기" : "가족 찾는 글 쓰기"} hideOnScroll>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </FloatingButton>
      </SaleTabSwipeArea>
    </Layout>
  );
}
