"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWRInfinite from "swr/infinite";

import Layout from "@components/features/MainLayout";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { ProductCard } from "@components/app/ProductCard";
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
import { ProductFeedEmpty } from "./_components/ProductFeedEmpty";
import { PriceRangeSheet } from "./_components/PriceRangeSheet";
import { ProductRowSkeleton } from "./_components/ProductRowSkeleton";
import { SortDropdown } from "./_components/SortDropdown";

const PAGE_SIZE = 12;
const CATEGORY_TABS = [{ id: "전체", name: "전체" }, ...TOP_LEVEL_CATEGORIES];

/**
 * 상품 목록(앱 src/app/products/index.tsx). 필터 블록(대분류·하위분류·정렬·타입·판매중만·가격)을
 * 헤더 아래 고정하고, 그 아래 "전체 N개 · 초기화" 요약과 상품 행을 그린다.
 * 필터는 화면 상태로 두되 바꿀 때마다 URL 에 적고(router.replace), URL 이 바뀌면(링크·뒤로가기) 다시 읽는다.
 * 그래서 상세에 갔다가 뒤로 오면 고른 필터가 그대로다(홈 "상품목록 ›", 무료나눔 카드, 하위분류 링크).
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { blockedIds } = useBlocks();

  const getKey = (pageIndex: number, previous: ProductsResponse | null) => {
    if (previous && pageIndex >= (previous.pages ?? 0)) return null;
    return toProductsApiUrl(filters, { page: pageIndex + 1, size: PAGE_SIZE });
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
  const total = data?.[0]?.total;
  const isDefault = isDefaultFilters(filters);
  const showSummary = typeof total === "number" || !isDefault;
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

  const subcategories = filters.category === "전체" ? [] : getSubcategories(filters.category);

  const renderState = () => {
    if (isFirstLoading) return <ProductRowSkeleton count={5} />;
    if (firstPageError) {
      return (
        <QueryErrorState title="상품 목록을 불러오지 못했어요" onRetry={() => void mutate()} />
      );
    }
    if (!isDefault) {
      return (
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <p className="text-[16px] font-semibold tracking-[-0.3px] text-app-text">
            조건에 맞는 상품이 없어요
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
    <Layout canGoBack title="상품 목록" seoTitle="상품 목록">
      {/* 필터 블록(헤더 아래 고정) */}
      <div className="sticky top-14 z-10 border-b border-app-line bg-app-bg">
        <div ref={categoryRailRef} className="flex h-11 items-center gap-2 overflow-x-auto px-4 scrollbar-hide">
          {CATEGORY_TABS.map((tab) => (
            <FilterChip
              key={tab.id}
              label={tab.name}
              selected={filters.category === tab.id}
              onClick={() => {
                if (filters.category === tab.id) return;
                updateFilters({ ...filters, category: tab.id, subcategory: "" });
              }}
            />
          ))}
        </div>

        {subcategories.length ? (
          // 대분류가 바뀌면 다시 마운트해 이전 가로 스크롤 위치를 버린다.
          <FilterChipRail key={filters.category}>
            <FilterChip
              label="전체"
              selected={!filters.subcategory}
              onClick={() => {
                if (!filters.subcategory) return;
                updateFilters({ ...filters, subcategory: "" });
              }}
            />
            {subcategories.map((sub) => (
              <FilterChip
                key={sub}
                label={sub}
                selected={filters.subcategory === sub}
                onClick={() =>
                  updateFilters({
                    ...filters,
                    subcategory: filters.subcategory === sub ? "" : sub,
                  })
                }
              />
            ))}
          </FilterChipRail>
        ) : null}

        <FilterChipRail>
          <SortDropdown
            value={filters.sort}
            onChange={(value) => updateFilters({ ...filters, sort: value as ProductSort })}
            ariaLabel="정렬 기준"
            options={PRODUCT_SORT_OPTIONS}
          />
          {PRODUCT_TYPES.map((type) => (
            <FilterChip
              key={type.id}
              label={type.name}
              selected={filters.productType === type.id}
              onClick={() =>
                updateFilters({
                  ...filters,
                  productType: filters.productType === type.id ? "" : type.id,
                })
              }
            />
          ))}
          <FilterChip
            label="판매중만"
            selected={filters.onSaleOnly}
            onClick={() => updateFilters({ ...filters, onSaleOnly: !filters.onSaleOnly })}
          />
          <FilterChip
            label={priceChipLabel(filters)}
            selected={hasPriceFilter(filters)}
            onClick={() => setPriceSheetOpen(true)}
          />
        </FilterChipRail>
      </div>

      {showSummary ? (
        <div className="flex h-9 items-center justify-between bg-app-bg px-4">
          <span className="text-[13px] text-app-muted">
            {typeof total === "number" && data ? `전체 ${total.toLocaleString("ko-KR")}개` : ""}
          </span>
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

      <div className="pb-24">
        {products.length > 0
          ? products.map((product) => (
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
                }}
                markUnread
              />
            ))
          : renderState()}

        {products.length > 0 ? (
          nextPageError || isLoadingMore ? (
            <RetryFooter
              loading={isLoadingMore}
              error={nextPageError}
              onRetry={() => void setSize(loadedPages + 1)}
            />
          ) : !hasMore ? (
            <p className="py-6 text-center text-[13px] text-app-muted">모든 상품을 봤어요</p>
          ) : null
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>

      {/* 탭바가 없는 화면이라 FAB 를 하단 safe-area 바로 위에 둔다. */}
      <Link
        href="/products/upload"
        aria-label="상품 등록"
        className="fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-[max(16px,calc((100vw-36rem)/2+16px))] z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-app-brand text-white shadow-[0_12px_28px_rgba(249,115,22,0.35)] dark:shadow-none"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </Link>

      <PriceRangeSheet
        open={priceSheetOpen}
        minPrice={filters.minPrice}
        maxPrice={filters.maxPrice}
        onApply={(range) =>
          updateFilters({ ...filters, minPrice: range.minPrice, maxPrice: range.maxPrice })
        }
        onClose={() => setPriceSheetOpen(false)}
      />
    </Layout>
  );
}
