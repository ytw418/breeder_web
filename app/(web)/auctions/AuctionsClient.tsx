"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "@components/atoms/Image";

import Layout from "@components/features/MainLayout";
import FloatingButton from "@components/atoms/floating-button";
import useSWRInfinite from "swr/infinite";
import { useInfiniteScroll } from "hooks/useInfiniteScroll";

import { cn, makeImageUrl } from "@libs/client/utils";
import { AuctionsListResponse } from "pages/api/auctions";
import { toAuctionPath } from "@libs/auction-route";
import { TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";

/** 상태 탭 */
const STATUS_TABS = [
  { id: "전체", name: "전체" },
  { id: "진행중", name: "진행중" },
  { id: "종료", name: "종료" },
];

const CATEGORY_TABS = [{ id: "전체", name: "전체" }, ...TOP_LEVEL_CATEGORIES];

/** 남은 시간 계산 */
const getTimeRemaining = (endAt: string | Date) => {
  const end = new Date(endAt).getTime();
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) return "종료됨";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  return `${minutes}분 남음`;
};

export default function AuctionsClient() {
  const [selectedStatus, setSelectedStatus] = useState("전체");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [, setTick] = useState(0);

  // 1분마다 카운트다운 갱신
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const getKey = (
    pageIndex: number,
    previousPageData: AuctionsListResponse | null
  ) => {
    if (previousPageData && !previousPageData.auctions.length) return null;
    const statusParam =
      selectedStatus !== "전체"
        ? `&status=${encodeURIComponent(selectedStatus)}`
        : "";
    const categoryParam =
      selectedCategory !== "전체"
        ? `&category=${encodeURIComponent(selectedCategory)}`
        : "";
    const queryParam = searchQuery
      ? `&q=${encodeURIComponent(searchQuery)}`
      : "";
    return `/api/auctions?page=${pageIndex + 1}${statusParam}${categoryParam}${queryParam}`;
  };

  const { data, setSize, mutate } = useSWRInfinite<AuctionsListResponse>(getKey);
  const page = useInfiniteScroll();

  useEffect(() => {
    setSize(page);
  }, [setSize, page]);

  useEffect(() => {
    mutate();
  }, [selectedStatus, selectedCategory, searchQuery, mutate]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const handleSearchReset = () => {
    setSearchInput("");
    setSearchQuery("");
  };

  return (
    <Layout icon hasTabBar seoTitle="경매" showSearch>
      <div className="flex flex-col h-full">
        <div className="px-4 pt-3 pb-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Bredy Auction
                  </p>
                  <h1 className="mt-1 text-xl font-black tracking-[-0.02em] text-slate-900 dark:text-slate-50">
                    카페/밴드 링크형 경매
                  </h1>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    카카오 로그인 기반 참여, 자동 연장, 입찰 검증으로
                    경매 운영 리스크를 줄였습니다.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Link
                    href="/auctions/create"
                    className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-gradient-to-r from-amber-300 to-orange-300 px-3.5 text-[11px] font-bold text-slate-900 shadow-[0_6px_14px_rgba(251,146,60,0.28)] transition hover:brightness-95"
                  >
                    1분만에 경매 생성하기
                  </Link>
                  <Link
                    href="/auction-tool"
                    className="inline-flex h-8 items-center rounded-full bg-slate-900 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    도구 소개
                  </Link>
                  <Link
                    href="/auctions/rules"
                    className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    운영 룰
                  </Link>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">입찰 검증</p>
                  <p className="mt-0.5 text-[12px] font-bold text-slate-800 dark:text-slate-100">호가 단위 자동 검증</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">마감 정책</p>
                  <p className="mt-0.5 text-[12px] font-bold text-slate-800 dark:text-slate-100">마감 임박 시 자동 연장</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">운영 정책</p>
                  <p className="mt-0.5 text-[12px] font-bold text-slate-800 dark:text-slate-100">신고/위반 계정 참여 제한</p>
                </article>
              </div>

              <form onSubmit={handleSearchSubmit} className="mt-3 flex items-center gap-2">
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="경매 매물 검색 (제목/설명/판매자)"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
                />
                <button
                  type="submit"
                  className="inline-flex h-9 shrink-0 items-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  검색
                </button>
                {(searchInput || searchQuery) && (
                  <button
                    type="button"
                    onClick={handleSearchReset}
                    className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    초기화
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* 상태 탭 */}
        <div className="sticky top-14 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex overflow-x-auto scrollbar-hide px-4 pt-3 gap-2">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                  selectedCategory === tab.id
                    ? "bg-slate-200 text-slate-900 dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
              >
                {tab.name}
              </button>
            ))}
          </div>
          <div className="flex overflow-x-auto scrollbar-hide px-4 py-3 gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                  selectedStatus === tab.id
                    ? "bg-gray-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* 경매 목록 */}
        <div className="px-4 py-4">
          {data ? (
            <div className="grid grid-cols-2 gap-3">
              {data.map((result) =>
                result?.auctions?.map((auction) => (
                  <Link
                    key={auction.id}
                    href={toAuctionPath(auction.id, auction.title)}
                    className="block overflow-hidden rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
                  >
                    {/* 이미지 */}
                    <div className="relative aspect-[4/3]">
                      {auction.photos?.[0] ? (
                        <Image
                          src={makeImageUrl(auction.photos[0], "public")}
                          className="w-full h-full object-cover"
                          alt={auction.title}
                          fill
                          sizes="(max-width: 640px) 50vw, 280px"
                        />
                      ) : (
                        <div className="h-full w-full bg-gray-100 dark:bg-slate-800" />
                      )}
                      {/* 상태 뱃지 */}
                      <div className="absolute top-2 left-2">
                        <span
                          className={cn(
                            "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[10px] font-semibold leading-none",
                            auction.status === "진행중"
                              ? "bg-emerald-500 text-white"
                              : auction.status === "종료"
                              ? "bg-slate-700 text-white"
                              : "bg-amber-500 text-white"
                          )}
                        >
                          {auction.status}
                        </span>
                      </div>
                    </div>

                    {/* 정보 */}
                    <div className="p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        {auction.category && (
                          <span className="inline-flex h-5 items-center rounded-md bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                            {auction.category}
                          </span>
                        )}
                        {auction.status === "진행중" && (
                          <span className="line-clamp-1 text-[10px] font-medium text-emerald-600">
                            {getTimeRemaining(auction.endAt)}
                          </span>
                        )}
                      </div>
                      <h3 className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {auction.title}
                      </h3>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 dark:text-slate-500">현재가</p>
                          <p className="text-sm font-bold text-primary line-clamp-1">
                            {auction.currentPrice.toLocaleString()}원
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 dark:text-slate-500">
                            입찰 {auction._count.bids}회
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {auction.user?.avatar ? (
                              <Image
                                src={makeImageUrl(auction.user.avatar, "avatar")}
                                className="w-4 h-4 rounded-full object-cover"
                                width={16}
                                height={16}
                                alt=""
                              />
                            ) : (
                              <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-slate-700" />
                            )}
                            <span className="max-w-[56px] truncate text-[10px] text-gray-500 dark:text-slate-400">
                              {auction.user?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <div className="aspect-[4/3] bg-gray-200 dark:bg-slate-800" />
                  <div className="space-y-2 p-2.5">
                    <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-slate-700" />
                    <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-slate-700" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 빈 상태 */}
          {data && data.length > 0 && data[0].auctions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-slate-500">
              <p className="text-lg font-medium">조건에 맞는 경매가 없습니다</p>
              <p className="text-sm mt-1">첫 경매를 등록해 보세요!</p>
            </div>
          )}
        </div>

        {/* 경매 등록 버튼 */}
        <FloatingButton href="/auctions/create">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </FloatingButton>
      </div>
    </Layout>
  );
}
