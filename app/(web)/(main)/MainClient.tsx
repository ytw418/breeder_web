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

const HERO_BANNERS = [
  {
    id: 1,
    title: "봄 시즌 이벤트",
    description: "인기 곤충/용품 최대 20% 할인",
    href: "/search",
    bgClass: "from-emerald-500 to-teal-500",
  },
  {
    id: 2,
    title: "경매 신규 기능 오픈",
    description: "실시간 입찰 알림과 상세 히스토리를 확인해 보세요",
    href: "/auctions",
    bgClass: "from-sky-500 to-cyan-500",
  },
  {
    id: 3,
    title: "브리더 랭킹 업데이트",
    description: "이번 달 TOP 브리더를 지금 확인하세요",
    href: "/ranking",
    bgClass: "from-orange-500 to-amber-500",
  },
  {
    id: 4,
    title: "안전거래 가이드",
    description: "거래 전 체크리스트로 더 안전하게 거래하세요",
    href: "/settings",
    bgClass: "from-indigo-500 to-blue-500",
  },
];

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
  href,
}: {
  title: string;
  href: string;
}) => (
  <div className="px-4 flex items-center justify-between">
    <h2 className="text-base font-bold text-gray-900">{title}</h2>
    <Link href={href} className="text-sm text-gray-500 hover:text-gray-700">
      더보기 &gt;
    </Link>
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

  return (
    <div className="flex flex-col h-full">
      {/* 상단 배너/히어로 */}
      <section className="py-6">
        <div
          ref={bannerRef}
          onScroll={handleBannerScroll}
          className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-3 px-4"
        >
          {HERO_BANNERS.map((banner) => (
            <Link
              key={banner.id}
              href={banner.href}
              className={cn(
                "snap-start shrink-0 w-[84%] rounded-2xl p-5 text-white shadow-sm bg-gradient-to-r",
                banner.bgClass
              )}
            >
              <p className="text-xs font-semibold text-white/80">Breeder</p>
              <h2 className="mt-2 text-xl font-bold">{banner.title}</h2>
              <p className="mt-1 text-sm text-white/90">{banner.description}</p>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {HERO_BANNERS.map((banner, index) => (
            <button
              key={banner.id}
              onClick={() => scrollToBanner(index)}
              aria-label={`${index + 1}번 배너로 이동`}
              className={cn(
                "h-2 rounded-full transition-all",
                activeBannerIndex === index ? "w-5 bg-gray-900" : "w-2 bg-gray-300"
              )}
            />
          ))}
        </div>
      </section>

      {/* 인기 상품 */}
      <section className="py-6 bg-gray-50">
        <SectionHeader title="인기 상품" href="#all-products" />
        <div className="mt-3 flex overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-3 px-4">
          {popularProductsData ? (
            popularProductsData.products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="snap-start shrink-0 w-40 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden"
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
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-primary">
                    {typeof product.price === "number"
                      ? `${product.price.toLocaleString()}원`
                      : "가격 문의"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    ❤️ {product._count.favs}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="snap-start shrink-0 w-40 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden animate-pulse"
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
      <section className="py-6">
        <SectionHeader title="진행중인 경매" href="/auctions" />
        <div className="mt-3 flex overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-3 px-4">
          {ongoingAuctionsData ? (
            ongoingAuctionsData.auctions.slice(0, 5).map((auction) => (
              <Link
                key={auction.id}
                href={`/auctions/${auction.id}`}
                className="snap-start shrink-0 w-56 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden"
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
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                    {auction.title}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-primary">
                    {auction.currentPrice.toLocaleString()}원
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {getTimeRemaining(auction.endAt)}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="snap-start shrink-0 w-56 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden animate-pulse"
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
      <div className="sticky top-14 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="flex overflow-x-auto scrollbar-hide px-4 py-3 gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleCategoryChange(tab.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                selectedCategory === tab.id
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      <section id="all-products" className="px-4 pt-6 pb-2">
        <h2 className="text-base font-bold text-gray-900">전체 상품</h2>
      </section>

      {/* 상품 목록 */}
      <div className="flex flex-col my-4 space-y-5 h-full">
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
          <div className="space-y-5">
            {[...Array(5)].map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </div>
        )}

        {/* 결과 없을 때 */}
        {data &&
          data.length > 0 &&
          data[0].products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <p className="text-lg font-medium">등록된 상품이 없습니다</p>
              <p className="text-sm mt-1">
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
