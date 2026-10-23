"use client";

import { useRailScroll } from "@components/ui/HorizontalRail";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWRInfinite from "swr/infinite";

import Layout from "@components/features/MainLayout";
import SaleTabSwitch, { SaleTabSwipeArea } from "@components/features/product/SaleTabSwitch";
import FloatingButton, { FAB_LIST_BOTTOM_PADDING_CLASS } from "@components/atoms/floating-button";
import CategoryScopeBar from "@components/features/category/CategoryScopeBar";
import FreeGiveawaySection from "@components/features/product/FreeGiveawaySection";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { ProductCard } from "@components/app/ProductCard";
import CoupangBanner from "@components/app/ads/CoupangBanner";
import { getCoupangWebConfig } from "@libs/client/adsConfig";
import { withAdRows } from "@libs/shared/ads/adRows";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import { PRODUCT_TYPES } from "@libs/constants";
import { getSubcategories, TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { ProductsResponse } from "@libs/shared/home";
import {
  DEFAULT_PRODUCT_FILTERS,
  hasPriceFilter,
  isDefaultFilters,
  parseProductFilterParams,
  priceChipLabel,
  PRODUCT_SORT_OPTIONS,
  sameProductFilters,
  toProductsApiUrl,
  uniqueById,
  type ProductFilterParams,
  type ProductFilters,
  type ProductSort,
  withProductFilterSearch,
} from "@libs/productFilters";
import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath, withinScope } from "hooks/useCategoryScope";
import {
  dogCatSaleFilters,
  dogCatSortOptions,
  hasDogCatPin,
  isDogCatOnly,
  saleSpeciesChips,
  saleSubcategoryNames,
} from "@libs/shared/petSpace";
import { ProductFeedEmpty } from "./_components/ProductFeedEmpty";
import { PriceRangeSheet } from "./_components/PriceRangeSheet";
import { ProductRowSkeleton } from "./_components/ProductRowSkeleton";
import { SortDropdown } from "./_components/SortDropdown";

const SALE_ADS_ENABLED = Boolean(getCoupangWebConfig());

const PAGE_SIZE = 12;
const CATEGORY_TABS = [{ id: "전체", name: "전체" }, ...TOP_LEVEL_CATEGORIES];

/**
 * 분양 탭(docs/prd/home-ia.md S-2, 2026-10-15 홈 구성 A안 — 앱 src/app/(tabs)/products.tsx).
 * 필터 블록(대분류·하위분류·정렬·타입·분양중만·가격)을 헤더 아래 고정하고, 그 아래 무료 분양 섹션(분류만 고른 상태),
 * 필터를 걸었을 때 '초기화', 분양글 행을 그린다. 개수 총계("전체 N개")는 보이지 않는다(community-vibe §3.1).
 * 필터는 화면 상태로 두되 바꿀 때마다 URL 에 적고(router.replace), URL 이 바뀌면(링크·뒤로가기) 다시 읽는다.
 * 그래서 상세에 갔다가 뒤로 오면 고른 필터가 그대로다(홈 "분양 더 보기 ›", 무료 분양 '전체 보기', 하위분류 링크).
 */
export default function ProductsClient({ initialParams }: { initialParams: ProductFilterParams }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() ?? "";
  // 뒤로가기로 돌아오면 서버 initialParams 는 처음 URL 일 수 있어 현재 URL 을 먼저 읽는다.
  const [filters, setFilters] = useState<ProductFilters>(() =>
    parseProductFilterParams(searchParams ?? initialParams)
  );

  // URL → 상태: 같은 화면에서 링크로 쿼리가 바뀌면 따라간다.
  useEffect(() => {
    const fromUrl = parseProductFilterParams(new URLSearchParams(searchKey));
    setFilters((prev) => (sameProductFilters(prev, fromUrl) ? prev : fromUrl));
  }, [searchKey]);

  // 상태 → URL: 기록을 쌓지 않고(replace) 스크롤도 건드리지 않는다.
  useEffect(() => {
    const current = window.location.search.replace(/^\?/, "");
    if (sameProductFilters(parseProductFilterParams(new URLSearchParams(current)), filters)) return;
    const next = withProductFilterSearch(current, filters);
    router.replace(next ? `${pathname}?${next}` : pathname || "/products", { scroll: false });
  }, [filters, pathname, router]);
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);
  const categoryRailRef = useRef<HTMLDivElement>(null);
  useRailScroll(categoryRailRef);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { blockedIds } = useBlocks();
  // 관심 카테고리 고정 범위(앱 category-pin). 대분류 칩·무료 분양·목록이 같은 범위를 쓴다.
  const scope = useCategoryScope();
  const categoryTabs = useMemo(
    () => withinScope(CATEGORY_TABS, scope.topLevelNames, (tab) => tab.id, (tab) => tab.id === "전체"),
    [scope.topLevelNames]
  );
  // 강아지·고양이를 고정했으면 '입양' 쪽이 따로 있어 분양 쪽은 가족 찾아요·임보 구해요 글을 뺀다
  // (docs/prd/pet-space.md §5.1). 강아지·고양이만이면 가격 없는 글뿐이라 가격 칩·무료 분양 섹션도 뺀다(§5.3).
  const pinPaths = scope.pins.map((pin) => pin.path);
  const withAdoptionSide = hasDogCatPin(pinPaths);
  const dogCatOnly = isDogCatOnly(pinPaths);
  // 종 칩: 대분류 아래 종만 고정했으면 '포유류' 대신 고른 종(강아지·고양이)을 칩으로(docs/prd/pet-space.md §5.3).
  const speciesChips = useMemo(
    () =>
      saleSpeciesChips(
        categoryTabs.filter((tab) => tab.id !== "전체").map((tab) => tab.id),
        scope.pins
      ),
    [categoryTabs, scope.pins]
  );
  // 범위 밖 대분류·종을 골라 두었으면(고정을 바꾼 뒤) 전체로 본다.
  const scopedFilters: ProductFilters =
    filters.category === "전체" ||
    speciesChips.some(
      (chip) =>
        chip.category === filters.category && (!chip.subcategory || chip.subcategory === filters.subcategory)
    )
      ? filters
      : { ...filters, category: "전체", subcategory: "" };
  // 강아지·고양이만이면 생물·용품·가격 칩과 가격순이 없다. 다른 공간에서 걸어 둔 값도 풀어서 본다.
  const activeFilters = dogCatOnly ? dogCatSaleFilters(scopedFilters) : scopedFilters;

  const getKey = (pageIndex: number, previous: ProductsResponse | null) => {
    if (previous && pageIndex >= (previous.pages ?? 0)) return null;
    const url = withCategoryPath(
      toProductsApiUrl(activeFilters, { page: pageIndex + 1, size: PAGE_SIZE }),
      scope.categoryPath
    );
    return withAdoptionSide ? `${url}${url.includes("?") ? "&" : "?"}dealGroup=sale` : url;
  };
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<ProductsResponse>(
    getKey,
    { revalidateFirstPage: false, revalidateOnFocus: false }
  );

  // 페이지 사이에 새 상품이 끼면 같은 상품이 다음 페이지에 또 올 수 있어 id 로 거른다.
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
  const isDefault = isDefaultFilters(activeFilters);
  // 개수 총계는 보이지 않는다(community-vibe §3.1 — 아직 글이 적다). 필터를 걸었을 때 '초기화'만 둔다.
  const showSummary = !isDefault;
  // 무료 분양 섹션은 분류(대·소분류)만 고른 상태에서 보인다. 가격·유형·정렬을 바꾸면 목록만 남긴다.
  const showFree =
    !dogCatOnly &&
    activeFilters.productType === DEFAULT_PRODUCT_FILTERS.productType &&
    activeFilters.onSaleOnly === DEFAULT_PRODUCT_FILTERS.onSaleOnly &&
    activeFilters.sort === DEFAULT_PRODUCT_FILTERS.sort &&
    !hasPriceFilter(activeFilters);
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

  // 링크(?category=식물)로 들어오면 선택 칩이 화면 밖일 수 있다. 처음 한 번만 보이게 민다.
  useEffect(() => {
    const rail = categoryRailRef.current;
    const chip = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!rail || !chip) return;
    const over = chip.offsetLeft + chip.offsetWidth + 16 - rail.clientWidth;
    if (over > 0) rail.scrollLeft = over;
  }, []);

  const updateFilters = (next: ProductFilters) => {
    setFilters(next);
    window.scrollTo({ top: 0 });
  };
  const resetFilters = () => {
    updateFilters(DEFAULT_PRODUCT_FILTERS);
    if (categoryRailRef.current) categoryRailRef.current.scrollLeft = 0;
  };

  // 아래 종 줄은 대분류 칩을 골랐을 때만(종 칩을 골랐으면 이미 종까지 고른 것이다). 종만 골라 고정했으면 고른 종만.
  const subcategories = speciesChips.some((chip) => !chip.subcategory && chip.category === activeFilters.category)
    ? saleSubcategoryNames(activeFilters.category, getSubcategories(activeFilters.category), scope.pins)
    : [];

  const renderState = () => {
    if (isFirstLoading) return <ProductRowSkeleton count={5} />;
    if (firstPageError) {
      return (
        <QueryErrorState title="분양 목록을 불러오지 못했어요" onRetry={() => void mutate()} />
      );
    }
    if (!isDefault) {
      return (
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <p className="text-[16px] font-semibold tracking-[-0.3px] text-app-text">
            조건에 맞는 분양글이 없어요
          </p>
          <p className="mt-1.5 text-[14px] tracking-[-0.2px] text-app-muted">
            필터를 바꾸거나 초기화해 보세요
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 h-11 rounded-md bg-app-surface px-[18px] text-[14px] font-semibold text-app-text"
          >
            필터 초기화
          </button>
        </div>
      );
    }
    return <ProductFeedEmpty />;
  };

  return (
    <Layout icon hasTabBar title="분양" seoTitle="분양" showSearch>
      {/* 현재 관심 분야(고정 범위). 온보딩을 마치면 숨는다(홈과 같다). */}
      <CategoryScopeBar />
      {/* '분양 | 경매' 전환(앱 docs/prd/home-v2.md S-2). 포유류만 고정이면 그리지 않는다. */}
      <SaleTabSwitch active="products" />
      {/* 목록을 좌우로 밀어도 칸을 넘긴다(앱 SaleTabSwipe 와 같은 규칙). */}
      <SaleTabSwipeArea active="products">
        {/* 필터 블록(헤더 아래 고정) */}
        <div className="sticky top-14 z-10 border-b border-app-line bg-app-bg">
          <div ref={categoryRailRef} className="flex h-11 items-center gap-2 overflow-x-auto px-4 scrollbar-hide">
            <FilterChip
              label="전체"
              selected={activeFilters.category === "전체"}
              onClick={() => {
                if (activeFilters.category === "전체") return;
                updateFilters({ ...activeFilters, category: "전체", subcategory: "" });
              }}
            />
            {speciesChips.map((chip) => {
              const selected =
                activeFilters.category === chip.category &&
                (!chip.subcategory || activeFilters.subcategory === chip.subcategory);
              return (
                <FilterChip
                  key={chip.id}
                  label={chip.label}
                  selected={selected}
                  onClick={() => {
                    if (selected) return;
                    updateFilters({ ...activeFilters, category: chip.category, subcategory: chip.subcategory });
                  }}
                />
              );
            })}
          </div>

          {subcategories.length ? (
            // 대분류가 바뀌면 다시 마운트해 이전 가로 스크롤 위치를 버린다.
            <FilterChipRail key={activeFilters.category}>
              <FilterChip
                label="전체"
                selected={!activeFilters.subcategory}
                onClick={() => {
                  if (!activeFilters.subcategory) return;
                  updateFilters({ ...activeFilters, subcategory: "" });
                }}
              />
              {subcategories.map((sub) => (
                <FilterChip
                  key={sub}
                  label={sub}
                  selected={activeFilters.subcategory === sub}
                  onClick={() =>
                    updateFilters({
                      ...activeFilters,
                      subcategory: activeFilters.subcategory === sub ? "" : sub,
                    })
                  }
                />
              ))}
            </FilterChipRail>
          ) : null}

          <FilterChipRail>
            <SortDropdown
              value={activeFilters.sort}
              onChange={(value) => updateFilters({ ...activeFilters, sort: value as ProductSort })}
              ariaLabel="정렬 기준"
              options={dogCatOnly ? dogCatSortOptions(PRODUCT_SORT_OPTIONS) : PRODUCT_SORT_OPTIONS}
            />
            {dogCatOnly
              ? null
              : PRODUCT_TYPES.map((type) => (
                  <FilterChip
                    key={type.id}
                    label={type.name}
                    selected={activeFilters.productType === type.id}
                    onClick={() =>
                      updateFilters({
                        ...activeFilters,
                        productType: activeFilters.productType === type.id ? "" : type.id,
                      })
                    }
                  />
                ))}
            <FilterChip
              label="분양중만"
              selected={activeFilters.onSaleOnly}
              onClick={() => updateFilters({ ...activeFilters, onSaleOnly: !activeFilters.onSaleOnly })}
            />
            {dogCatOnly ? null : (
              <FilterChip
                label={priceChipLabel(activeFilters)}
                selected={hasPriceFilter(activeFilters)}
                onClick={() => setPriceSheetOpen(true)}
              />
            )}
          </FilterChipRail>
        </div>

        {showFree ? (
          <FreeGiveawaySection
            category={activeFilters.subcategory || (activeFilters.category !== "전체" ? activeFilters.category : undefined)}
            categoryPath={scope.categoryPath}
            onShowAll={() =>
              updateFilters({ ...activeFilters, onSaleOnly: true, minPrice: 0, maxPrice: 0 })
            }
          />
        ) : null}

        {showSummary ? (
          <div className="flex h-9 items-center justify-end bg-app-bg px-4">
            {isDefault ? null : (
              <button
                type="button"
                aria-label="필터 초기화"
                onClick={resetFilters}
                className="text-[13px] text-app-text"
              >
                초기화
              </button>
            )}
          </div>
        ) : null}

        {/* 하단 여백 = FAB 높이 + 24(2026-10-21 디자인 리뷰, 앱 FAB_LIST_BOTTOM_PADDING). */}
        <div className={FAB_LIST_BOTTOM_PADDING_CLASS}>
          {products.length > 0
            ? // 8개마다 쿠팡 배너 한 줄(앱 분양 탭은 같은 간격의 AdMob 네이티브, 웹은 생물 거래 화면이라 AdSense 대신 쿠팡).
              withAdRows(products, SALE_ADS_ENABLED).map((product) =>
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
                ),
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
              <p className="py-6 text-center text-[13px] text-app-muted">모든 분양글을 봤어요</p>
            ) : null
          ) : null}
          <div ref={sentinelRef} aria-hidden="true" />
        </div>

        {/* 아래로 내리면 숨겨 카드 메타·찜 수를 가리지 않는다(2026-10-21 디자인 리뷰). */}
        <FloatingButton href="/products/upload" label="분양 등록" hideOnScroll>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </FloatingButton>

        <PriceRangeSheet
          open={priceSheetOpen}
          minPrice={activeFilters.minPrice}
          maxPrice={activeFilters.maxPrice}
          onApply={(range) =>
            updateFilters({ ...activeFilters, minPrice: range.minPrice, maxPrice: range.maxPrice })
          }
          onClose={() => setPriceSheetOpen(false)}
        />
      </SaleTabSwipeArea>
    </Layout>
  );
}
