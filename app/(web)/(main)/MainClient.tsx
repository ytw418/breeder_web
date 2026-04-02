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

import SkeletonItem from "@components/atoms/SkeletonItem";
import { cn, makeImageUrl } from "@libs/client/utils";
import { CATEGORIES } from "@libs/constants";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import useUser from "hooks/useUser";
import { FreeProductItem, HomeFeedResponse } from "@libs/shared/ranking";
import { HomeBanner, ProductsResponse } from "@libs/shared/home";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/** 탭 목록: "전체" + 카테고리 목록 */
const TABS = [{ id: "전체", name: "전체" }, ...CATEGORIES];

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

const formatRankDelta = (rankDelta: number) => {
  if (rankDelta > 0) return `▲ ${rankDelta}`;
  if (rankDelta < 0) return `▼ ${Math.abs(rankDelta)}`;
  return "유지";
};


const toRankingHref = (tab: "breeders" | "auctions" | "bloodlines" | "community", period: "weekly" | "all") =>
  `/ranking?tab=${tab}&period=${period}`;

const MainClient = ({
  initialHomeFeed,
  initialProducts,
  initialBanners,
}: {
  initialHomeFeed: HomeFeedResponse;
  initialProducts: ProductsResponse;
  initialBanners: HomeBanner[];
}) => {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [showPostLoginGuide, setShowPostLoginGuide] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installLoading, setInstallLoading] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  const getKey = (
    pageIndex: number,
    previousPageData: ProductsResponse | null
  ) => {
    if (previousPageData && !previousPageData.products.length) return null;
    const categoryParam =
      selectedCategory !== "전체" ? `&category=${selectedCategory}` : "";
    return `/api/products?page=${pageIndex + 1}${categoryParam}`;
  };

  const hasInitializedCategory = useRef(false);
  const { data, setSize } = useSWRInfinite<ProductsResponse>(getKey, {
    fallbackData: [initialProducts],
    revalidateFirstPage: false,
    revalidateOnFocus: false,
    revalidateOnMount: false,
    revalidateIfStale: false,
  });
  // 상단 홈 경험은 단일 피드 API로 묶고, 상품 리스트만 기존 무한스크롤 구조를 유지한다.
  const { data: homeFeedData } = useSWR<HomeFeedResponse>(
    "/api/home/feed?scope=public",
    {
      fallbackData: initialHomeFeed,
      revalidateOnFocus: false,
      revalidateOnMount: false,
      revalidateIfStale: false,
    }
  );
  const banners = initialBanners;

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
    if (!hasInitializedCategory.current) {
      hasInitializedCategory.current = true;
      return;
    }

    void setSize(1);
  }, [selectedCategory, setSize]);

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

  useEffect(() => {
    if (!homeFeedData?.success) return;
    // 랭킹 우선 IA 전환 이후 섹션별 노출량을 비교할 수 있도록 홈 진입 시 한 번에 기록한다.
    const sectionIds = [
      "hero_breeder",
      "auction_ranking",
      "bloodline_ranking",
      "trending_community",
      "bloodline_card",
      "free_giveaway",
      "personalized_home",
    ];
    sectionIds.forEach((sectionId, index) => {
      trackEvent(ANALYTICS_EVENTS.homeSectionView, {
        section_id: sectionId,
        position: index + 1,
        user_tier: user ? "member" : "guest",
        season_id: homeFeedData.currentSeasonId,
      });
    });
  }, [homeFeedData?.currentSeasonId, homeFeedData?.success, user]);

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
  const heroBreederPeriod = homeFeedData?.heroBreederMode ?? "weekly";
  const auctionPeriod = homeFeedData?.topAuctionsMode === "all" ? "all" : "weekly";
  const bloodlinePeriod = homeFeedData?.topBloodlinesMode ?? "weekly";
  const communityPeriod = homeFeedData?.trendingPostsMode === "all" ? "all" : "weekly";
  const bloodlineSubtitle = "가장 많은 사용자가 보유한 혈통카드를 기준으로 집계한 랭킹";
  const communitySubtitle = "좋아요와 댓글 반응이 높은 커뮤니티 글";

  return (
    <div className="app-page flex flex-col h-full">
      {/* Section 1: 상단 배너/히어로 */}
      <section className="app-reveal">
        <div
          ref={bannerRef}
          onScroll={handleBannerScroll}
          className="app-rail flex gap-0"
        >
            {banners.map((banner) => (
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
                  "snap-start shrink-0 w-full app-card-interactive rounded-none border-0 shadow-none px-5 py-5 text-white bg-gradient-to-r relative overflow-hidden from-emerald-500 to-teal-500",
                  banner.bgClass
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
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {banners.map((banner, index: number) => (
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

      {/* Section 2: 혈통카드 공유 챌린지 (compact) */}
      <section className="app-section app-reveal app-reveal-1 py-2">
        <div className="relative mx-5 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 p-3 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/15 blur-xl" />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest">
                  이벤트
                </span>
                <h3 className="text-sm font-black leading-tight">혈통카드 공유 챌린지</h3>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-white/90">
                내 혈통카드를 공유하고 특별 배지를 받으세요!
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Link
                href="/bloodline-management"
                onClick={() =>
                  trackEvent(ANALYTICS_EVENTS.challengeJoin, {
                    challenge_id: "bloodline_card_share",
                    entry_type: user ? "member" : "guest",
                  })
                }
                className="inline-flex h-7 items-center rounded-full bg-white px-3 text-[11px] font-bold text-orange-600"
              >
                보기
              </Link>
              <Link
                href="/bloodline-cards/create"
                className="inline-flex h-7 items-center rounded-full border border-white/40 bg-white/20 px-3 text-[11px] font-semibold text-white backdrop-blur-sm"
              >
                만들기
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: TOP 브리더 hero card */}
      <section className="app-section app-reveal app-reveal-1 py-2">
        <SectionHeader
          title="이번 주 TOP 브리더"
          href={toRankingHref("breeders", heroBreederPeriod)}
          actionLabel="랭킹 보기"
        />
        <div className="mt-1 px-5">
          {homeFeedData?.heroBreeder ? (
            // 첫 스크린은 주간 1위 브리더와 즉시 행동 CTA에 집중해 홈 방향성을 명확히 준다.
            <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.22),_transparent_38%),linear-gradient(135deg,#0f172a,#111827_55%,#1d4ed8)] p-4 text-white shadow-xl">
              <p className="app-kicker text-white/70 text-[10px]">
                {heroBreederPeriod === "weekly" ? "Weekly Hero" : "All-time Leader"}
              </p>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
                      {homeFeedData.heroBreeder.user.avatar ? (
                        <Image
                          src={makeImageUrl(homeFeedData.heroBreeder.user.avatar, "avatar")}
                          alt={homeFeedData.heroBreeder.user.name}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-black tracking-tight">
                        {homeFeedData.heroBreeder.user.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-white/75">
                        브리더 랭킹 {homeFeedData.heroBreeder.rank}위
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-white/75">
                    점수 {homeFeedData.heroBreeder.score.toLocaleString()} · {formatRankDelta(homeFeedData.heroBreeder.rankDelta)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded-full bg-white/10 px-2 py-1">게시 {homeFeedData.heroBreeder.postsCount}</span>
                    <span className="rounded-full bg-white/10 px-2 py-1">댓글 {homeFeedData.heroBreeder.commentsCount}</span>
                    <span className="rounded-full bg-white/10 px-2 py-1">입찰 {homeFeedData.heroBreeder.bidsCount}</span>
                    <span className="rounded-full bg-white/10 px-2 py-1">낙찰 {homeFeedData.heroBreeder.auctionWinsCount}</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-right backdrop-blur-sm">
                  <p className="text-[10px] text-white/70">현재 순위</p>
                  <p className="text-2xl font-black">#{homeFeedData.heroBreeder.rank}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {(homeFeedData.heroBreeder.badges || []).slice(0, 2).map((badge) => (
                    <span key={badge.id} className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold">
                      {badge.label}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    trackEvent(ANALYTICS_EVENTS.challengeJoin, {
                      challenge_id: "weekly_breeder_rank",
                      entry_type: user ? "member" : "guest",
                    });
                    router.push(
                      user
                        ? toRankingHref("breeders", "weekly")
                        : "/auth/login?next=%2Franking%3Ftab%3Dbreeders%26period%3Dweekly"
                    );
                  }}
                  className="inline-flex h-8 items-center rounded-full bg-white px-3.5 text-xs font-semibold text-slate-900"
                >
                  내 순위 올리기
                </button>
              </div>
            </div>
          ) : (
            <div className="app-card p-4 text-sm text-slate-400">이번 주 브리더 집계가 준비 중입니다.</div>
          )}
        </div>
      </section>

      {/* Section 3: 2x2 Grid — 경매 / 혈통 / 커뮤니티 / 무료나눔 */}
      <section className="app-section app-reveal app-reveal-1 py-2">
        <div className="grid grid-cols-2 gap-3 px-5">
          {/* 최고가 경매 */}
          <Link
            href={toRankingHref("auctions", auctionPeriod)}
            onClick={() =>
              trackEvent(ANALYTICS_EVENTS.rankingCardClick, {
                ranking_type: "auction",
                rank: 1,
                entity_id: homeFeedData?.topAuctionsByCategory?.[0]?.auctionId ?? "",
                section_id: "auction_ranking",
              })
            }
            className="app-card app-card-interactive flex flex-col gap-2 p-3"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">최고가 경매</h3>
                <span className="text-[10px] text-slate-400">더보기 ›</span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">카테고리별 최고 낙찰가</p>
            </div>
            <div className="mt-2 space-y-1.5">
              {homeFeedData?.topAuctionsByCategory?.length ? (
                homeFeedData.topAuctionsByCategory.slice(0, 2).map((auction) => (
                  <div key={auction.auctionId} className="flex items-center gap-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {auction.photo ? (
                        <Image
                          src={makeImageUrl(auction.photo, "public")}
                          alt={auction.title}
                          width={32}
                          height={32}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-700">{auction.title}</p>
                      <p className="text-[10px] text-primary font-semibold">
                        {auction.currentPrice.toLocaleString()}원
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-400">집계 준비 중</p>
              )}
            </div>
          </Link>

          {/* 인기 혈통 TOP */}
          <Link
            href={toRankingHref("bloodlines", bloodlinePeriod)}
            onClick={() =>
              trackEvent(ANALYTICS_EVENTS.rankingCardClick, {
                ranking_type: "bloodline",
                rank: 1,
                entity_id: homeFeedData?.topBloodlines?.[0]?.bloodlineRootId ?? "",
                section_id: "bloodline_ranking",
              })
            }
            className="app-card app-card-interactive flex flex-col gap-2 p-3"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">인기 혈통 TOP</h3>
                <span className="text-[10px] text-slate-400">더보기 ›</span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">보유자 수 기준 랭킹</p>
            </div>
            <div className="mt-2 space-y-1.5">
              {homeFeedData?.topBloodlines?.length ? (
                homeFeedData.topBloodlines.slice(0, 2).map((bloodline) => (
                  <div key={bloodline.bloodlineRootId} className="flex items-center gap-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {bloodline.image ? (
                        <Image
                          src={makeImageUrl(bloodline.image, "public")}
                          alt={bloodline.name}
                          width={32}
                          height={32}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-end bg-[linear-gradient(145deg,#111827,#1f2937_58%,#f59e0b)] p-1">
                          <span className="text-[6px] font-semibold tracking-wider text-white/80">BL</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-700">{bloodline.name}</p>
                      <p className="text-[10px] text-slate-400">보유자 {bloodline.ownerCount}명</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-400">집계 준비 중</p>
              )}
            </div>
          </Link>

          {/* 급상승 커뮤니티 */}
          <Link
            href={toRankingHref("community", communityPeriod)}
            onClick={() =>
              trackEvent(ANALYTICS_EVENTS.rankingCardClick, {
                ranking_type: "community",
                rank: 1,
                entity_id: homeFeedData?.trendingPosts?.[0]?.post?.id ?? "",
                section_id: "trending_community",
              })
            }
            className="app-card app-card-interactive flex flex-col gap-2 p-3"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">급상승 커뮤니티</h3>
                <span className="text-[10px] text-slate-400">더보기 ›</span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">{communitySubtitle}</p>
            </div>
            <div className="mt-2 space-y-1.5">
              {homeFeedData?.trendingPosts?.length ? (
                homeFeedData.trendingPosts.slice(0, 2).map((item) => (
                  <div key={item.post.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-700">{item.post.title}</p>
                      <p className="text-[10px] text-slate-400">#{item.rank} 상승중</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-400">급상승 글 집계 중</p>
              )}
            </div>
          </Link>

          {/* 무료나눔 */}
          {homeFeedData?.freeGiveawayProducts?.length ? (
            <Link
              href="/products?status=판매중&price=0"
              onClick={() =>
                trackEvent(ANALYTICS_EVENTS.rankingCardClick, {
                  ranking_type: "free_giveaway",
                  rank: 1,
                  entity_id: homeFeedData.freeGiveawayProducts[0]?.id ?? "",
                  section_id: "free_giveaway",
                })
              }
              className="app-card app-card-interactive flex flex-col gap-2 p-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">무료나눔</h3>
                  <span className="text-[10px] text-slate-400">더보기 ›</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">가격 0원 · 지금 연락하세요</p>
              </div>
              <div className="mt-2 space-y-1.5">
                {homeFeedData.freeGiveawayProducts.slice(0, 2).map((item: FreeProductItem) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {item.photos[0] ? (
                        <Image
                          src={makeImageUrl(item.photos[0], "public")}
                          alt={item.name}
                          width={32}
                          height={32}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-700">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.user.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Link>
          ) : (
            <Link
              href="/products/upload"
              className="app-card app-card-interactive flex flex-col items-center justify-center p-3 text-center"
            >
              <h3 className="text-sm font-bold text-slate-900">무료나눔</h3>
              <p className="mt-2 text-xs text-slate-500">아직 무료나눔이 없어요</p>
              <p className="mt-1 text-[10px] font-semibold text-primary">첫 번째로 등록해보세요 ›</p>
            </Link>
          )}
        </div>
      </section>

      {/* Section 5: 카테고리 탭 */}
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
                className="h-11 rounded-xl bg-slate-600 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
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
