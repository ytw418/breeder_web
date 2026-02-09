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

/** 상태 탭 */
const STATUS_TABS = [
  { id: "전체", name: "전체" },
  { id: "진행중", name: "진행중" },
  { id: "종료", name: "종료" },
];

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
  const [selectedStatus, setSelectedStatus] = useState("진행중");
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
    const statusParam = selectedStatus !== "전체" ? `&status=${selectedStatus}` : "";
    return `/api/auctions?page=${pageIndex + 1}${statusParam}`;
  };

  const { data, setSize, mutate } = useSWRInfinite<AuctionsListResponse>(getKey);
  const page = useInfiniteScroll();

  useEffect(() => {
    setSize(page);
  }, [setSize, page]);

  useEffect(() => {
    mutate();
  }, [selectedStatus]);

  return (
    <Layout icon hasTabBar seoTitle="경매" showSearch>
      <div className="flex flex-col h-full">
        {/* 헤더 */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900">경매</h1>
            <Link
              href="/auctions/rules"
              className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              룰 안내
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">희귀한 곤충을 입찰하세요</p>
        </div>

        {/* 상태 탭 */}
        <div className="sticky top-14 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
          <div className="flex overflow-x-auto scrollbar-hide px-4 py-3 gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                  selectedStatus === tab.id
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                    href={`/auctions/${auction.id}`}
                    className="block overflow-hidden rounded-xl border border-slate-100 bg-white"
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
                        <div className="w-full h-full bg-gray-100" />
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
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {auction.title}
                      </h3>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400">현재가</p>
                          <p className="text-sm font-bold text-primary line-clamp-1">
                            {auction.currentPrice.toLocaleString()}원
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">
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
                              <div className="w-4 h-4 rounded-full bg-gray-200" />
                            )}
                            <span className="max-w-[56px] truncate text-[10px] text-gray-500">
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
                <div key={i} className="overflow-hidden rounded-xl border border-slate-100 bg-white animate-pulse">
                  <div className="aspect-[4/3] bg-gray-200" />
                  <div className="p-2.5 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 빈 상태 */}
          {data && data.length > 0 && data[0].auctions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <p className="text-lg font-medium">등록된 경매가 없습니다</p>
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
