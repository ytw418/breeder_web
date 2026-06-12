"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "@components/atoms/Image";
import {
  BreederProgramBadgeList,
  getBreederProgramFrameClassName,
  hasBreederProgramFrame,
} from "@components/features/breeder/BreederProgramDecorators";

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
    previousPageData: AuctionsListResponse | null,
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
    return `/api/auctions?page=${
      pageIndex + 1
    }${statusParam}${categoryParam}${queryParam}`;
  };

  const {
    data,
    error: auctionsError,
    setSize,
    mutate,
  } = useSWRInfinite<AuctionsListResponse>(getKey);
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
      <div className="flex h-full flex-col">
        <section className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[12px] font-semibold text-primary">
                Bredy Auction
              </p>
              <h1 className="mt-1 text-[21px] font-bold tracking-[-0.02em] text-slate-950 dark:text-slate-50">
                진행 중인 경매
              </h1>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                링크 공유, 자동 연장, 입찰 검증을 한 화면에서 확인하세요.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/auctions/create"
                className="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                경매 등록
              </Link>
              <Link
                href="/auction-tool"
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                도구 소개
              </Link>
              <Link
                href="/auctions/rules"
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                운영 룰
              </Link>
            </div>

            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2"
            >
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="제목, 설명, 판매자 검색"
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
              />
              <button
                type="submit"
                className="inline-flex h-10 shrink-0 items-center rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                검색
              </button>
              {(searchInput || searchQuery) && (
                <button
                  type="button"
                  onClick={handleSearchReset}
                  className="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  초기화
                </button>
              )}
            </form>
          </div>
        </section>

        {/* 상태 탭 */}
        <div className="sticky top-14 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex gap-2 overflow-x-auto px-4 pt-3 scrollbar-hide">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={cn(
                  "flex-shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  selectedCategory === tab.id
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                {tab.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={cn(
                  "flex-shrink-0 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                  selectedStatus === tab.id
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* 경매 목록 */}
        <div className="px-4 py-4">
          {auctionsError ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                경매 목록을 불러오지 못했습니다
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                잠시 후 다시 시도해주세요.
              </p>
              <button
                type="button"
                onClick={() => mutate()}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                다시 불러오기
              </button>
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 gap-3">
              {data.map(
                (result) =>
                  result?.auctions?.map((auction) => (
                    <Link
                      key={auction.id}
                      href={toAuctionPath(auction.id, auction.title)}
                      className="block overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
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
                              "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-[10px] font-semibold leading-none",
                              auction.status === "진행중"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : auction.status === "종료"
                                ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
                            )}
                          >
                            {auction.status}
                          </span>
                        </div>
                      </div>

                      {/* 정보 */}
                      <div className="p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          {auction.category && (
                            <span className="inline-flex h-5 items-center rounded-md bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {auction.category}
                            </span>
                          )}
                          {auction.status === "진행중" && (
                            <span className="line-clamp-1 text-[10px] font-semibold text-emerald-600">
                              {getTimeRemaining(auction.endAt)}
                            </span>
                          )}
                        </div>
                        <h3 className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                          {auction.title}
                        </h3>
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-400 dark:text-slate-500">
                              현재가
                            </p>
                            <p className="text-sm font-bold text-slate-950 line-clamp-1 dark:text-slate-50">
                              {auction.currentPrice.toLocaleString()}원
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 dark:text-slate-500">
                              입찰 {auction._count.bids}회
                            </p>
                            <div className="mt-1 flex items-center justify-end gap-1">
                              <div
                                className={cn(
                                  hasBreederProgramFrame(
                                    auction.user?.breederPrograms,
                                  )
                                    ? "rounded-full p-0.5"
                                    : "",
                                  hasBreederProgramFrame(
                                    auction.user?.breederPrograms,
                                  )
                                    ? getBreederProgramFrameClassName(
                                        auction.user?.breederPrograms,
                                      )
                                    : "",
                                )}
                              >
                                {auction.user?.avatar ? (
                                  <Image
                                    src={makeImageUrl(
                                      auction.user.avatar,
                                      "avatar",
                                    )}
                                    className={cn(
                                      "h-4 w-4 rounded-full object-cover",
                                      hasBreederProgramFrame(
                                        auction.user?.breederPrograms,
                                      )
                                        ? "ring-1 ring-white/70"
                                        : "",
                                    )}
                                    width={16}
                                    height={16}
                                    alt=""
                                  />
                                ) : (
                                  <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-slate-700" />
                                )}
                              </div>
                              <div className="min-w-0 text-right">
                                <span className="block max-w-[72px] truncate text-[10px] text-gray-500 dark:text-slate-400">
                                  {auction.user?.name}
                                </span>
                                <BreederProgramBadgeList
                                  programs={auction.user?.breederPrograms}
                                  compact
                                  className="mt-1 justify-end"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )),
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
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
          {!auctionsError &&
            data &&
            data.length > 0 &&
            data[0].auctions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-slate-500">
                <p className="text-lg font-medium">
                  조건에 맞는 경매가 없습니다
                </p>
                <p className="text-sm mt-1">첫 경매를 등록해 보세요!</p>
              </div>
            )}
        </div>

        {/* 경매 등록 버튼 */}
        <FloatingButton href="/auctions/create">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </FloatingButton>
      </div>
    </Layout>
  );
}
