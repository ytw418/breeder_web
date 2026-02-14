"use client";

import { UIEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useRouter } from "next/navigation";

import FloatingButton from "@components/atoms/floating-button";
import Image from "@components/atoms/Image";
import Item from "@components/features/item/item";
import useSWRInfinite from "swr/infinite";

import { useInfiniteScroll } from "hooks/useInfiniteScroll";

import { Product } from "@prisma/client";

import SkeletonItem from "@components/atoms/SkeletonItem";
import { cn, makeImageUrl } from "@libs/client/utils";
import { CATEGORIES } from "@libs/constants";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { getProductPath } from "@libs/product-route";
import { AuctionsListResponse } from "pages/api/auctions";
import { PopularProductsResponse } from "pages/api/products/popular";
import useUser from "hooks/useUser";

export interface ProductWithCount extends Product {
  _count: { favs: number };
}

interface ProductsResponse {
  success: boolean;
  products: ProductWithCount[];
  pages: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/** 탭 목록: "전체" + 카테고리 목록 */
const TABS = [{ id: "전체", name: "전체" }, ...CATEGORIES];

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
        className="inline-flex h-7 items-center text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700"
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
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [showPostLoginGuide, setShowPostLoginGuide] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installLoading, setInstallLoading] = useState(false);
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
    trackEvent(ANALYTICS_EVENTS.homeCategorySelected, {
      selected_category: categoryId,
      previous_category: selectedCategory,
      user_id: user?.id || null,
    });
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

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (isUserLoading || !user) return;
    try {
      const shouldShow = localStorage.getItem("bredy:show-post-login-guide");
      if (shouldShow === "1") {
        setShowPostLoginGuide(true);
        localStorage.removeItem("bredy:show-post-login-guide");
      }
    } catch {
      // noop
    }
  }, [isUserLoading, user]);

  const handleInstallClick = async () => {
    if (!deferredInstallPrompt) {
      alert("현재 브라우저에서는 자동 설치 프롬프트를 사용할 수 없습니다.");
      return;
    }

    try {
      trackEvent(ANALYTICS_EVENTS.homePostLoginInstallClicked, {
        user_id: user?.id || null,
      });
      setInstallLoading(true);
      await deferredInstallPrompt.prompt();
      const userChoice = await deferredInstallPrompt.userChoice;
      trackEvent(ANALYTICS_EVENTS.homePostLoginInstallCompleted, {
        user_id: user?.id || null,
        install_outcome: userChoice?.outcome || "unknown",
        platform: userChoice?.platform || "unknown",
      });
      setDeferredInstallPrompt(null);
      setShowPostLoginGuide(false);
    } finally {
      setInstallLoading(false);
    }
  };

  const handleGoPushSettings = () => {
    trackEvent(ANALYTICS_EVENTS.homePostLoginPushSettingsClicked, {
      user_id: user?.id || null,
    });
    setShowPostLoginGuide(false);
    router.push("/settings");
  };

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
            브리디 홈
          </h1>
        </div>
        <div className="px-5">
          <div
            ref={bannerRef}
            onScroll={handleBannerScroll}
            className="app-rail flex gap-3.5"
          >
            {banners.map((banner: any) => (
              <Link
                key={banner.id}
                href={banner.href}
                onClick={() =>
                  trackEvent(ANALYTICS_EVENTS.homeBannerClicked, {
                    banner_id: banner.id,
                    banner_title: banner.title,
                    banner_href: banner.href,
                    user_id: user?.id || null,
                  })
                }
                className={cn(
                  "snap-start shrink-0 w-[84%] app-card app-card-interactive p-5 text-white bg-gradient-to-r relative overflow-hidden border-transparent",
                  banner.bgClass || "from-gray-500 to-gray-600"
                )}
              >
                <span className="app-kicker text-white/75 relative z-10">Bredy</span>
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

      {/* 브리디북 랜딩 */}
      <section className="app-section app-reveal app-reveal-1">
        <SectionHeader
          title="브리디북"
          subtitle="당신의 브리딩 실력을 기록하세요"
          href="/bredybook-landing"
          actionLabel="바로가기"
        />
        <div className="mt-3 px-5">
          <Link
            href="/bredybook-landing"
            className="app-card app-card-interactive block overflow-hidden border-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white"
          >
            <p className="app-kicker text-white/70">Bredybook</p>
            <h3 className="mt-2 text-lg font-semibold">
              당신의 기록을 새로운 스탠다드로
            </h3>
            <p className="mt-2 text-sm text-white/80">
              이제 더이상 카더라 기네스는 그만. 공식 기록으로 증명하세요.
            </p>
            <span className="mt-4 inline-flex h-8 items-center rounded-full bg-white/15 px-3 text-xs font-semibold">
              브리디북 기록하러 가기
            </span>
          </Link>
        </div>
      </section>

      {/* 인기 상품 */}
      <section className="app-section-muted app-reveal app-reveal-1">
        <SectionHeader title="인기 상품" subtitle="좋아요가 많은 상품" />
        <div className="mt-3 px-5">
          <div className="app-rail flex gap-3">
            {popularProductsData ? (
              popularProductsData.products.length > 0 ? (
                popularProductsData.products.map((product, index) => (
                  <Link
                    key={product.id}
                    href={getProductPath(product.id, product.name)}
                    onClick={() =>
                      trackEvent(ANALYTICS_EVENTS.homePopularProductClicked, {
                        product_id: product.id,
                        product_name: product.name,
                        rank_index: index,
                        user_id: user?.id || null,
                      })
                    }
                    className="snap-start shrink-0 w-40 app-card app-card-interactive overflow-hidden"
                  >
                    <div className="relative aspect-square bg-gray-100">
                      <Image
                        src={makeImageUrl(product.photos?.[0], "product")}
                        alt={product.name}
                        className="object-cover"
                        fill
                        sizes="160px"
                        priority={index === 0}
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
                <div className="app-card mx-1 w-[92%] shrink-0 border-dashed px-4 py-5 text-center text-slate-500">
                  <p className="app-title-md text-slate-600">
                    등록된 상품이 아직 없습니다
                  </p>
                  <p className="app-body-sm mt-1">
                    지금 개체를 등록해 첫 거래를 시작해보세요.
                  </p>
                  <Link
                    href="/products/upload"
                    className="mt-3 inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white"
                  >
                    상품 등록하기
                  </Link>
                </div>
              )
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
            ongoingAuctionsData.auctions.length > 0 ? (
              ongoingAuctionsData.auctions.slice(0, 5).map((auction, index) => (
                <Link
                  key={auction.id}
                  href={`/auctions/${auction.id}`}
                  onClick={() =>
                    trackEvent(ANALYTICS_EVENTS.homeOngoingAuctionClicked, {
                      auction_id: auction.id,
                      auction_title: auction.title,
                      rank_index: index,
                      current_price: auction.currentPrice,
                      user_id: user?.id || null,
                    })
                  }
                  className="snap-start shrink-0 w-56 app-card app-card-interactive overflow-hidden"
                >
                  <div className="relative aspect-[4/3] bg-gray-100">
                    <Image
                      src={makeImageUrl(auction.photos?.[0], "public")}
                      alt={auction.title}
                      className="object-cover"
                      fill
                      sizes="224px"
                      priority={index === 0}
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
              <div className="app-card mx-1 w-[92%] shrink-0 border-dashed px-4 py-5 text-center text-slate-500">
                <p className="app-title-md text-slate-600">
                  등록된 경매가 없습니다
                </p>
                <p className="app-body-sm mt-1">
                  지금 개체를 등록해 첫 경매를 열어보세요!
                </p>
                <Link
                  href="/auctions/create"
                  className="mt-3 inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white"
                >
                  경매 등록하기
                </Link>
              </div>
            )
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
          <div className="app-rail flex gap-1.5 snap-none">
            {TABS.map((tab) => {
              const isActive = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleCategoryChange(tab.id)}
                  className={cn(
                    "flex-shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-slate-900 font-semibold text-white"
                      : "bg-slate-100 font-medium text-slate-600 hover:bg-slate-200"
                  )}
                >
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
      <div className="h-full border-y border-slate-100 bg-white pb-4">
        {data ? (
          data.map((result) => {
            return result?.products?.map((product) => (
              <Item
                key={product?.id}
                id={product?.id}
                title={product?.name}
                price={product?.price}
                hearts={product?._count?.favs}
                image={product?.photos[0]}
                createdAt={product.createdAt}
                category={product?.category}
                status={product?.status}
                minimal
              />
            ));
          })
        ) : (
          <div className="divide-y divide-slate-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4">
                <SkeletonItem />
              </div>
            ))}
          </div>
        )}

        {/* 결과 없을 때 */}
        {data &&
          data.length > 0 &&
          data[0].products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <p className="app-title-md text-slate-500">
                상품 피드가 활발해질 준비 중이에요
              </p>
              <p className="app-body-sm mt-1">
                지금 개체를 등록해 첫 상품을 올려보세요.
              </p>
              <Link
                href="/products/upload"
                className="mt-3 inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white"
              >
                상품 등록하러 가기
              </Link>
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

      {showPostLoginGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 px-4 py-8">
          <div className="mx-auto mt-16 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">시작 설정</h3>
            <p className="mt-1 text-sm text-slate-600">
              홈 화면 설치와 푸시 알림을 설정하면 새 소식을 빠르게 확인할 수 있습니다.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleInstallClick}
                className={cn(
                  "h-11 rounded-xl text-sm font-semibold transition-colors",
                  deferredInstallPrompt
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-slate-100 text-slate-500"
                )}
                disabled={!deferredInstallPrompt || installLoading}
              >
                {installLoading ? "설치 준비 중..." : "홈 화면에 설치하기"}
              </button>
              <button
                type="button"
                onClick={handleGoPushSettings}
                className="h-11 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                푸시 알림 설정하기
              </button>
              <button
                type="button"
                onClick={() => {
                  trackEvent(ANALYTICS_EVENTS.homePostLoginGuideDismissed, {
                    user_id: user?.id || null,
                  });
                  setShowPostLoginGuide(false);
                }}
                className="h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                나중에 하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MainClient;
