"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWRInfinite from "swr/infinite";

import Layout from "@components/features/MainLayout";
import FloatingButton from "@components/atoms/floating-button";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { RetryFooter } from "@components/app/RetryFooter";
import { cn } from "@libs/client/utils";
import { uniqueAuctionsById } from "@libs/auctionRules";
import { TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import type { AuctionsListResponse } from "pages/api/auctions";
import useCategoryScope from "hooks/useCategoryScope";
import { CATEGORY_SCOPE_SURFACES } from "@libs/shared/categories";
import { AuctionCard, AuctionSkeletonGrid } from "./AuctionCard";

const STATUS_TABS = ["전체", "진행중", "종료"] as const;
const CATEGORY_TABS = [{ id: "전체", name: "전체" }, ...TOP_LEVEL_CATEGORIES];

const TEXT_LINKS = [
  { label: "도구 소개", href: "/auction-tool" },
  { label: "운영 룰", href: "/auctions/rules" },
];

function SearchIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-app-muted">
      <path
        d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden className="text-app-caption">
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5l5 5M14.5 9.5l-5 5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 목록 조회 실패(앱 AuctionListStates AuctionErrorState 와 같은 문구·모양). */
function AuctionErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-lg border border-app-border bg-app-elevated px-4 py-8">
      <p className="text-[14px] font-semibold text-app-strong">경매 목록을 불러오지 못했습니다</p>
      <p className="mt-1 text-center text-[12px] leading-relaxed text-app-muted">잠시 후 다시 시도해주세요.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 h-9 rounded-lg bg-app-inverse px-3 text-[12px] font-semibold text-app-inverse-text"
      >
        다시 불러오기
      </button>
    </div>
  );
}

/** 빈 목록(앱 AuctionEmptyState). */
function AuctionEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="text-[18px] font-medium text-app-muted">조건에 맞는 경매가 없습니다</p>
      <p className="mt-1 text-[14px] text-app-muted">첫 경매를 등록해 보세요!</p>
    </div>
  );
}

export default function AuctionsClient() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("전체");
  const [category, setCategory] = useState("전체");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  // 1분마다 남은 시간·마감 표시를 갱신한다.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // 관심 카테고리 범위: 경매는 구조만(CATEGORY_SCOPE_SURFACES.auctions 가 켜지면 범위를 보낸다).
  const scope = useCategoryScope();
  const scopePath = CATEGORY_SCOPE_SURFACES.auctions ? scope.categoryPath : undefined;

  const getKey = (pageIndex: number, previous: AuctionsListResponse | null) => {
    if (previous && pageIndex >= (previous.pages ?? 1)) return null;
    const params = new URLSearchParams({ page: String(pageIndex + 1) });
    if (status !== "전체") params.set("status", status);
    if (category !== "전체") params.set("category", category);
    if (q) params.set("q", q);
    if (scopePath) params.set("categoryPath", scopePath);
    return `/api/auctions?${params.toString()}`;
  };

  const { data, error, size, setSize, mutate, isValidating } =
    useSWRInfinite<AuctionsListResponse>(getKey, { revalidateFirstPage: false });

  // 페이지 사이에 새 경매가 끼면 같은 경매가 다음 페이지에 또 올 수 있어 id 로 거른다.
  const auctions = useMemo(
    () => uniqueAuctionsById((data ?? []).flatMap((page) => page?.auctions ?? [])),
    [data]
  );
  const isLoading = !data && !error;
  const totalPages = data?.[data.length - 1]?.pages ?? 1;
  const hasMore = !!data && data.length < totalPages;
  const isLoadingMore = !!data && size > data.length && !error;
  const nextPageFailed = !!error && auctions.length > 0;

  // 진행중인데 마감 시각이 지난 카드가 생기면 서버 정산(종료/유찰)을 받으러 경매마다 한 번만 다시 받는다.
  const expiredRefetchIds = useRef(new Set<number>());
  const onAuctionTimeOver = useCallback(
    (auctionId: number) => {
      if (expiredRefetchIds.current.has(auctionId)) return;
      expiredRefetchIds.current.add(auctionId);
      void mutate();
    },
    [mutate]
  );

  // 바닥 센티널이 보이면 다음 페이지. 실패하면 자동으로 다시 부르지 않고 푸터의 '다시 시도'로만 부른다.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoadingMore || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void setSize((s) => s + 1);
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, error, setSize]);

  const onSearchReset = () => {
    setSearchInput("");
    setQ("");
  };

  return (
    <Layout icon hasTabBar seoTitle="경매" showSearch>
      <div className="flex min-h-full flex-col bg-app-bg pb-28">
        {/* 제목 */}
        <div className="px-4 py-3">
          <h1 className="text-[18px] font-bold tracking-[-0.3px] text-app-text">경매</h1>
        </div>

        {/* 검색 pill */}
        <form
          role="search"
          className="px-4"
          onSubmit={(event) => {
            event.preventDefault();
            setQ(searchInput.trim());
          }}
        >
          <div className="flex h-11 items-center gap-2 rounded-[22px] bg-app-surface px-3.5">
            <SearchIcon />
            <input
              type="search"
              enterKeyHint="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="제목, 설명, 판매자 검색"
              aria-label="경매 검색"
              className="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-app-text placeholder:text-app-caption focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchInput || q ? (
              <button
                type="button"
                onClick={onSearchReset}
                aria-label="검색어 지우기"
                className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center"
              >
                <ClearIcon />
              </button>
            ) : null}
          </div>
        </form>

        {/* 텍스트 링크(터치 높이 44) */}
        <div className="flex items-center gap-4 px-4">
          {TEXT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-[44px] items-center gap-0.5 text-[13px] text-app-muted"
            >
              {link.label}
              <ChevronRight />
            </Link>
          ))}
        </div>

        {/* 카테고리 칩 1줄 + 상태 텍스트 세그먼트(헤더 아래 고정) */}
        <div className="sticky top-14 z-10 border-b border-app-line bg-app-bg">
          <FilterChipRail>
            {CATEGORY_TABS.map((tab) => (
              <FilterChip
                key={tab.id}
                label={tab.name}
                selected={category === tab.id}
                onClick={() => setCategory(tab.id)}
              />
            ))}
          </FilterChipRail>
          <div className="flex items-center px-2.5" role="tablist" aria-label="경매 상태">
            {STATUS_TABS.map((tab, index) => {
              const active = status === tab;
              return (
                <Fragment key={tab}>
                  {index > 0 ? (
                    <span aria-hidden className="mx-0.5 text-[13px] text-app-border">
                      ·
                    </span>
                  ) : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatus(tab)}
                    className={cn(
                      "min-h-[44px] px-1.5 text-[13px] leading-[18px]",
                      active ? "font-bold text-app-text" : "font-medium text-app-muted"
                    )}
                  >
                    {tab}
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* 경매 목록 */}
        <div className="px-4">
          {isLoading ? (
            <AuctionSkeletonGrid />
          ) : error && auctions.length === 0 ? (
            <div className="py-4">
              <AuctionErrorState onRetry={() => void mutate()} />
            </div>
          ) : auctions.length === 0 ? (
            <AuctionEmptyState />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 py-4">
                {auctions.map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    nowMs={nowMs}
                    onTimeOver={onAuctionTimeOver}
                  />
                ))}
              </div>
              {isLoadingMore ? (
                <AuctionSkeletonGrid className="pt-0" />
              ) : (
                <RetryFooter
                  error={nextPageFailed}
                  loading={false}
                  onRetry={() => {
                    if (!isValidating) void mutate();
                  }}
                />
              )}
              <div ref={sentinelRef} aria-hidden className="h-px" />
            </>
          )}
        </div>

        <FloatingButton href="/auctions/create" label="경매 등록">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </FloatingButton>
      </div>
    </Layout>
  );
}
