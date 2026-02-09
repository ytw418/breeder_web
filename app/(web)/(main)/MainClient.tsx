"use client";

import { UIEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import FloatingButton from "@components/atoms/floating-button";
import Image from "@components/atoms/Image";
import Item from "@components/features/item/item";
import useSWRInfinite from "swr/infinite";

import { useInfiniteScroll } from "hooks/useInfiniteScroll";

import { Product } from "@prisma/client";

import SkeletonItem from "@components/atoms/SkeletonItem";
import ItemWrapper from "@components/features/item/ItemWrapper";
import { cn, makeImageUrl } from "@libs/client/utils";
import { CATEGORIES } from "@libs/constants";
import { AuctionsListResponse } from "pages/api/auctions";
import { PopularProductsResponse } from "pages/api/products/popular";

export interface ProductWithCount extends Product {
  _count: { favs: number };
}

interface ProductsResponse {
  success: boolean;
  products: ProductWithCount[];
  pages: number;
}

/** 탭 목록: "전체" + 카테고리 목록 */
const TABS = [{ id: "전체", name: "전체" }, ...CATEGORIES];

const CATEGORY_ACCENT: Record<string, string> = {
  전체: "bg-slate-500",
  장수풍뎅이: "bg-emerald-500",
  사슴벌레: "bg-cyan-500",
  타란튤라: "bg-violet-500",
  전갈: "bg-amber-500",
  "나비/나방": "bg-pink-500",
  개미: "bg-lime-500",
  기타곤충: "bg-gray-500",
};

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

const SectionHeader = ({
  title,
  subtitle,
  href,
  actionLabel = "더보기",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  actionLabel?: string;
}) => (
  <div className="px-5 flex items-end justify-between gap-3">
    <div>
      <h2 className="app-section-title">{title}</h2>
      {subtitle ? <p className="mt-1 app-caption">{subtitle}</p> : null}
    </div>
    {href ? (
      <Link
        href={href}
        className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
      >
        {actionLabel}
        <span aria-hidden="true" className="ml-0.5">
          ›
        </span>
      </Link>
    ) : null}
  </div>
);

const MainClient = () => {
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  const getKey = (
    pageIndex: number,
    previousPageData: ProductsResponse | null
  ) => {
    if (previousPageData && !previousPageData.products.length) return null;
    const categoryParam =
      selectedCategory !== "전체" ? `&category=${selectedCategory}` : "";
    return `/api/products?page=${pageIndex + 1}${categoryParam}`;
  };

  const { data, setSize, mutate } = useSWRInfinite<ProductsResponse>(getKey);
  const { data: popularProductsData } = useSWR<PopularProductsResponse>(
    "/api/products/popular"
  );
  const { data: ongoingAuctionsData } = useSWR<AuctionsListResponse>(
    "/api/auctions?status=진행중&page=1"
  );
  // 배너 데이터 호출
  const { data: bannerData } = useSWR("/api/admin/banners");
  const banners = bannerData?.banners && bannerData.banners.length > 0 ? bannerData.banners : [];

  const page = useInfiniteScroll();

  useEffect(() => {
    setSize(page);
  }, [setSize, page]);

  // 카테고리 변경 시 목록 초기화
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  // 카테고리 변경 시 데이터 리셋
  useEffect(() => {
    mutate();
  }, [selectedCategory, mutate]);

  // 진행중 경매 남은 시간 갱신
  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => prev + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleBannerScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const children = Array.from(container.children) as HTMLElement[];
    if (!children.length) return;

    let nearestIndex = 0;
    let minDistance = Number.POSITIVE_INFINITY;

    children.forEach((child, index) => {
      const distance = Math.abs(child.offsetLeft - container.scrollLeft);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    });

    if (nearestIndex !== activeBannerIndex) {
      setActiveBannerIndex(nearestIndex);
    }
  };

  const scrollToBanner = (index: number) => {
    const container = bannerRef.current;
    if (!container) return;
    const target = container.children[index] as HTMLElement | undefined;
    if (!target) return;
    container.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
  };

  const loadedProductCount =
    data?.reduce((count, pageData) => count + (pageData?.products?.length ?? 0), 0) ?? 0;

  return (
    <div className="app-page flex flex-col h-full">
      {/* 상단 배너/히어로 */}
      <section className="app-section app-reveal">
        <div className="px-5 pb-3">
          <p className="app-kicker">TODAY</p>
          <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.03em] text-slate-950">
            브리더 홈
          </h1>
        </div>
        <div
          ref={bannerRef}
          onScroll={handleBannerScroll}
          className="app-rail flex gap-3.5 pl-5 pr-4"
        >
          {banners.map((banner: any) => (
            <Link
              key={banner.id}
              href={banner.href}
              className={cn(
                "snap-start shrink-0 w-[84%] app-card app-card-interactive p-5 text-white bg-gradient-to-r relative overflow-hidden border-transparent",
                banner.bgClass || "from-gray-500 to-gray-600"
              )}
            >
              <span className="app-kicker text-white/75 relative z-10">Breeder</span>
              <h2 className="mt-2 app-title-lg text-white relative z-10">{banner.title}</h2>
              <p className="mt-1 app-body-sm text-white/90 line-clamp-2 relative z-10">
                {banner.description}
              </p>
              <span className="mt-4 inline-flex h-7 items-center rounded-full bg-white/20 px-2.5 text-[11px] font-semibold text-white/95 backdrop-blur-sm relative z-10">
                자세히 보기
              </span>
              <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/12" />
            </Link>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {banners.map((banner: any, index: number) => (
            <button
              key={banner.id}
              onClick={() => scrollToBanner(index)}
              aria-label={`${index + 1}번 배너로 이동`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                activeBannerIndex === index ? "w-6 bg-slate-900" : "w-2 bg-slate-300"
              )}
            />
          ))}
        </div>
      </section>

      {/* 인기 상품 */}
      <section className="app-section-muted app-reveal app-reveal-1">
        <SectionHeader title="인기 상품" subtitle="좋아요가 많은 상품" />
        <div className="app-rail mt-3 flex gap-3 pl-5 pr-4">
          {popularProductsData ? (
            popularProductsData.products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="snap-start shrink-0 w-40 app-card app-card-interactive overflow-hidden"
              >
                <div className="relative aspect-square bg-gray-100">
                  <Image
                    src={makeImageUrl(product.photos?.[0], "product")}
                    alt={product.name}
                    className="object-cover"
                    fill
                    sizes="160px"
                  />
                </div>
                <div className="p-3">
                  <h3 className="app-title-md truncate">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-[15px] font-bold tracking-tight text-primary">
                    {typeof product.price === "number"
                      ? `${product.price.toLocaleString()}원`
                      : "가격 문의"}
                  </p>
                  <div className="mt-1">
                    <span className="app-pill-muted bg-rose-50 text-rose-500">
                      ❤ {product._count.favs}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="snap-start shrink-0 w-40 app-card overflow-hidden animate-pulse"
              >
                <div className="aspect-square bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-4/5" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 진행중 경매 */}
      <section className="app-section app-reveal app-reveal-2">
        <SectionHeader
          title="진행중인 경매"
          subtitle="마감 전 빠르게 확인"
          href="/auctions"
        />
        <div className="app-rail mt-3 flex gap-3 pl-5 pr-4">
          {ongoingAuctionsData ? (
            ongoingAuctionsData.auctions.slice(0, 5).map((auction) => (
              <Link
                key={auction.id}
                href={`/auctions/${auction.id}`}
                className="snap-start shrink-0 w-56 app-card app-card-interactive overflow-hidden"
              >
                <div className="relative aspect-[4/3] bg-gray-100">
                  <Image
                    src={makeImageUrl(auction.photos?.[0], "public")}
                    alt={auction.title}
                    className="object-cover"
                    fill
                    sizes="224px"
                  />
                  <span className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold">
                    {auction.status}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="app-title-md line-clamp-1">
                    {auction.title}
                  </h3>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[15px] font-bold tracking-tight text-primary">
                      {auction.currentPrice.toLocaleString()}원
                    </p>
                    <span className="app-pill-muted">{getTimeRemaining(auction.endAt)}</span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="snap-start shrink-0 w-56 app-card overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 카테고리 탭 */}
      <div className="app-sticky-rail app-reveal app-reveal-3">
        <div className="px-4 py-2.5">
          <div className="app-rail flex gap-2 snap-none">
            {TABS.map((tab) => {
              const isActive = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleCategoryChange(tab.id)}
                  className={cn(
                    "app-chip",
                    isActive
                      ? "app-chip-active"
                      : "app-chip-muted"
                  )}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isActive
                        ? "bg-white/90"
                        : CATEGORY_ACCENT[tab.id] ?? "bg-slate-400"
                    )}
                  />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section id="all-products" className="px-4 pt-6 pb-2">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="app-section-title">
              {selectedCategory === "전체" ? "전체 상품" : `${selectedCategory} 상품`}
            </h2>
            <p className="mt-1 app-caption">
              최신 등록 순으로 노출됩니다.
            </p>
          </div>
          <span className="app-count-chip">{loadedProductCount}개</span>
        </div>
      </section>

      {/* 상품 목록 */}
      <div className="h-full space-y-2 px-4 pb-4">
        {data ? (
          data.map((result) => {
            return result?.products?.map((product) => (
              <ItemWrapper key={product?.id}>
                <Item
                  id={product?.id}
                  title={product?.name}
                  price={product?.price}
                  hearts={product?._count?.favs}
                  image={product?.photos[0]}
                  createdAt={product.createdAt}
                  category={product?.category}
                  status={product?.status}
                />
              </ItemWrapper>
            ));
          })
        ) : (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </div>
        )}

        {/* 결과 없을 때 */}
        {data &&
          data.length > 0 &&
          data[0].products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <p className="app-title-md text-slate-500">등록된 상품이 없습니다</p>
              <p className="app-body-sm mt-1">
                첫 번째 상품을 등록해 보세요!
              </p>
            </div>
          )}
      </div>

      <FloatingButton href="/products/upload">
        <svg
          className="w-6 h-6"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
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
  );
};
export default MainClient;
