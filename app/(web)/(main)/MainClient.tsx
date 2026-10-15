"use client";

import { useRailScroll } from "@components/ui/HorizontalRail";
import { Suspense, UIEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useRouter } from "next/navigation";

import FloatingButton from "@components/atoms/floating-button";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { cn } from "@libs/client/utils";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { withoutBlocked } from "@libs/shared/blockFilter";
import useUser from "hooks/useUser";
import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath } from "hooks/useCategoryScope";
import useScopeTerms from "@/hooks/useScopeTerms";
import { isAuctionHref } from "@libs/shared/scopeTerms";
import useSectionImpressions from "hooks/useSectionImpressions";
import CategoryScopeBar from "@components/features/category/CategoryScopeBar";
import CategoryOnboardingPrompt from "@components/features/category/CategoryOnboardingPrompt";
import NeighborhoodBreederSection from "@components/features/home/NeighborhoodBreederSection";
import ProductPhotoRail, { type RailProduct } from "@components/features/home/ProductPhotoRail";
import TopBreederRankCard from "@components/features/home/TopBreederRankCard";
import type { ProductRailFlags } from "@libs/shared/communityVibe";
import { BreederRankingItem, HomeFeedResponse } from "@libs/shared/ranking";
import { pickBreederKeywords } from "@libs/shared/breederKeywords";
import { filterHomeFeedForBlocked, HomeBanner, ProductsResponse } from "@libs/shared/home";
import HomeCommunityTop from "./HomeCommunityTop";
import HomePostsFeed from "./HomePostsFeed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const HOME_FEED_KEY = "/api/home/feed?scope=public";

/**
 * home_section_view 의 section_id 와 position(화면 위에서부터 순서). 요소에는 data-home-section 으로 붙인다.
 * 2026-10-15 홈 구성 A안(docs/prd/home-ia.md): 홈 = 커뮤니티, 분양 목록·2x2 그리드는 분양 탭(/products)으로.
 */
const HOME_SECTION_ORDER = [
  "realtime_discussion",
  "product_rail",
  "neighborhood_breeders",
  "hero_breeder",
  "posts_feed",
] as const;
type HomeSectionId = (typeof HOME_SECTION_ORDER)[number];

type RankingTabId = "breeders" | "auctions" | "bloodlines" | "community";
type RankingPeriodId = "weekly" | "all";

const toRankingHref = (tab: RankingTabId, period: RankingPeriodId) =>
  `/ranking?tab=${tab}&period=${period}`;

/** 섹션 제목(community-vibe 시안 .sec-h: section 18/700 + 오른쪽 13 muted 링크 ›). */
const SectionHeader = ({
  title,
  href,
  actionLabel = "더보기",
}: {
  title: string;
  href?: string;
  actionLabel?: string;
}) => (
  <div className="flex items-end justify-between gap-3 px-4">
    <h2 className="app-t-section">{title}</h2>
    {href ? (
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-0.5 text-[13px] leading-[18px] text-app-muted"
      >
        {actionLabel}
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>
    ) : null}
  </div>
);

function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded bg-app-surface", className)} />;
}

type RailResponse = {
  success?: boolean;
  items?: (ProductsResponse["products"][number] & Partial<ProductRailFlags>)[];
  products?: (ProductsResponse["products"][number] & Partial<ProductRailFlags>)[];
};
const RAIL_KEY = "/api/products?rail=1&limit=10";

const MainClient = ({
  initialHomeFeed,
  initialBanners,
}: {
  initialHomeFeed: HomeFeedResponse | null;
  initialBanners: HomeBanner[];
}) => {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const { blockedIds } = useBlocks();
  // 관심 카테고리 고정 범위(앱 category-pin). 실시간 토론·분양 레일·TOP 브리더·게시글이 같은 범위를 쓴다.
  const scope = useCategoryScope();
  // 포유류만 고정했으면 '브리더' 대신 '집사'로 부른다(앱 docs/prd/category-pin.md §15).
  const { breeder, showAuctions } = useScopeTerms();
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [showPostLoginGuide, setShowPostLoginGuide] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installLoading, setInstallLoading] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  useRailScroll(bannerRef);
  const homeRootRef = useRef<HTMLDivElement>(null);

  // ── 홈 피드(공개 캐시): 이번 주 TOP 브리더 ─────────────────────────────
  const {
    data: rawFeed,
    error: feedFetchError,
    mutate: reloadFeed,
  } = useSWR<HomeFeedResponse>(withCategoryPath(HOME_FEED_KEY, scope.categoryPath), {
    fallbackData: scope.categoryPath ? undefined : initialHomeFeed ?? undefined,
    revalidateOnFocus: false,
    revalidateOnMount: Boolean(scope.categoryPath) || !initialHomeFeed,
    revalidateIfStale: false,
  });
  const feedOk = rawFeed?.success ? rawFeed : undefined;
  const feedError = !feedOk && (Boolean(feedFetchError) || rawFeed?.success === false);
  const feedLoading = !feedOk && !feedError;

  // 공개 캐시 응답이라 서버가 차단 사용자를 거르지 못한다. 받은 뒤 여기서 뺀다.
  const feed = useMemo(
    () => (feedOk ? filterHomeFeedForBlocked(feedOk, blockedIds) : undefined),
    [feedOk, blockedIds]
  );
  // 1위 브리더를 차단했으면 같은 기간 랭킹에서 차단하지 않은 다음 브리더로 바꾼다.
  const { data: replacementRanking } = useSWR<{ success: boolean; items: BreederRankingItem[] }>(
    feed?.heroBlocked
      ? withCategoryPath(
          `/api/rankings/breeders?limit=10&period=${feed.heroBreederMode}&highlights=10`,
          scope.categoryPath
        )
      : null
  );
  const replacementPeers = useMemo(
    () => replacementRanking?.items?.filter((item) => !blockedIds.has(item.user.id)) ?? [],
    [replacementRanking, blockedIds]
  );
  const hero = feed?.heroBreeder ?? (feed?.heroBlocked ? replacementPeers[0] ?? null : null);
  // 1위의 칭호: 서버가 계산해 준다. 1위를 차단해 바꿨으면 같은 기간 랭킹으로 다시 고른다.
  const heroKeyword = useMemo(
    () =>
      feed?.heroBreeder
        ? feed.heroBreederKeyword ?? null
        : feed?.heroBlocked
          ? pickBreederKeywords(replacementPeers, [], 1)[0] ?? null
          : null,
    [feed, replacementPeers]
  );
  // 포유류만 고정했으면 경매로 가는 배너('실시간 경매 진행 중' 등)는 뺀다(앱 docs/prd/category-pin.md §15).
  const banners = showAuctions ? initialBanners : initialBanners.filter((banner) => !isAuctionHref(banner.href));

  // 지금 올라온 분양 레일: 서버 rail=1(최신 10 + 첫 분양글 24시간 맨 앞, isNew). 구 서버면 분양 목록 1페이지로 대신한다.
  const { data: railData, error: railError } = useSWR<RailResponse>(
    withCategoryPath(RAIL_KEY, scope.categoryPath),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const { data: railFallback } = useSWR<ProductsResponse>(
    railError || (railData && !railData.items && !railData.products)
      ? withCategoryPath("/api/products?page=1", scope.categoryPath)
      : null,
    { revalidateOnFocus: false }
  );
  const railItems = useMemo<RailProduct[]>(() => {
    const source: NonNullable<RailResponse["items"]> =
      railData?.items ?? railData?.products ?? railFallback?.products ?? [];
    return withoutBlocked(source, blockedIds, (product) => product.userId)
      .slice(0, 10)
      .map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.photos?.[0] ?? null,
        createdAt: product.createdAt,
        isNew: product.isNew,
      }));
  }, [railData, railFallback, blockedIds]);
  const railLoading = !railData && !railError;

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

  // 섹션이 화면에 절반 이상 보였을 때 섹션마다 한 번 기록한다(홈 진입 때 한꺼번에 찍으면 노출량을 비교할 수 없다).
  useSectionImpressions(homeRootRef, (sectionId) => {
    const position = HOME_SECTION_ORDER.indexOf(sectionId as HomeSectionId) + 1;
    trackEvent(ANALYTICS_EVENTS.homeSectionView, {
      section_id: sectionId,
      position: position > 0 ? position : null,
      user_tier: user ? "member" : "guest",
      season_id: feedOk?.currentSeasonId ?? null,
    });
  });

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
      const distance = Math.abs(child.offsetLeft - container.scrollLeft - 16);
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
    container.scrollTo({ left: target.offsetLeft - 16, behavior: "smooth" });
  };

  const heroBreederPeriod: RankingPeriodId = feed?.heroBreederMode === "all" ? "all" : "weekly";
  const showTopBreeder = feedError || feedLoading || Boolean(hero);

  return (
    <div ref={homeRootRef} className="flex h-full flex-col bg-app-bg pb-20">
      {/* 현재 관심 분야(고정 범위). 온보딩을 마치면 숨는다. 칩이 헤더 바로 아래 붙도록 이 줄은 고정하지 않는다. */}
      <CategoryScopeBar />
      {/* 관심 분야를 고른 기록이 계정·브라우저 어디에도 없으면 홈 위에 선택 시트를 띄운다(비로그인 포함). */}
      <CategoryOnboardingPrompt />

      {/* 1~2. 공지 · 실시간 TOP 토론 · 답 기다려요(옛 반려생활 위쪽) */}
      <HomeCommunityTop />

      {/* 3. 지금 올라온 분양(사진 레일, '분양 더 보기' → 분양 탭) */}
      <ProductPhotoRail items={railItems} loading={railLoading} />

      {/* 4. 우리 동네 브리더(강조, 시 단위 + 50km) */}
      <NeighborhoodBreederSection />

      {/* 5. 이번 주 TOP 브리더 + 내 순위 — 집계가 비면 섹션을 숨긴다 */}
      {showTopBreeder ? (
        <section className="pt-6" data-home-section="hero_breeder">
          <SectionHeader
            title={heroBreederPeriod === "weekly" ? `이번 주 TOP ${breeder}` : `TOP ${breeder}`}
            href={toRankingHref("breeders", heroBreederPeriod)}
            actionLabel="전체 랭킹 보기"
          />
          <div className="mt-3 px-4">
            {feedError ? (
              <div className="rounded-2xl bg-app-gap">
                <QueryErrorState
                  title="랭킹을 불러오지 못했어요"
                  onRetry={() => void reloadFeed()}
                  className="py-6"
                />
              </div>
            ) : feedLoading ? (
              <div className="space-y-2 rounded-2xl bg-app-gap p-4">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-[35%]" />
              </div>
            ) : hero ? (
              <TopBreederRankCard
                hero={hero}
                keyword={heroKeyword}
                period={heroBreederPeriod}
                scoped={Boolean(scope.categoryPath)}
                viewer={user ? { id: user.id, name: user.name, avatar: user.avatar ?? null } : null}
                viewerLoading={isUserLoading}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 6. 배너 슬라이더(관리자 배너 API) */}
      {banners.length > 0 ? (
        <section className="relative bg-app-bg pt-6">
          <div
            ref={bannerRef}
            onScroll={handleBannerScroll}
            className="app-rail flex snap-x snap-mandatory scroll-px-4 gap-3 px-4"
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
                  "app-card-interactive relative flex min-h-[132px] w-[calc(100vw-32px)] max-w-[calc(36rem-32px)] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-emerald-500 to-teal-500 px-4 py-4 text-white shadow-none",
                  banner.bgClass
                )}
              >
                <div>
                  <span className="text-[11px] font-semibold leading-none text-white/70">Bredy</span>
                  <h2 className="mt-2 text-[20px] font-bold leading-tight tracking-normal text-white">
                    {banner.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-[1.45] tracking-normal text-white/85">
                    {banner.description}
                  </p>
                </div>
                <span className="mt-4 inline-flex h-7 w-fit items-center rounded-lg bg-white/15 px-2.5 text-[11px] font-bold text-white">
                  자세히 보기
                </span>
              </Link>
            ))}
          </div>
          {banners.length > 1 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center">
              {banners.map((banner, index: number) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => scrollToBanner(index)}
                  aria-label={`${index + 1}번 배너로 이동`}
                  aria-current={activeBannerIndex === index ? "true" : undefined}
                  className="pointer-events-auto grid h-4 w-4 place-items-center rounded-full"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      activeBannerIndex === index ? "bg-white" : "bg-white/50"
                    )}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 7. 전체 게시글(옛 반려생활 목록). ?category= 를 읽어 useSearchParams 를 쓰므로 Suspense 로 감싼다. */}
      <Suspense fallback={null}>
        <HomePostsFeed />
      </Suspense>

      <FloatingButton href="/posts/upload" label="글쓰기">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </FloatingButton>

      {showPostLoginGuide && (
        <div className="fixed inset-0 z-50 bg-app-overlay px-4 py-8">
          <div className="mx-auto mt-16 w-full max-w-sm rounded-2xl border border-app-border bg-app-elevated p-5">
            <h3 className="text-base font-semibold text-app-text">시작 설정</h3>
            <p className="mt-1 text-sm text-app-sub">
              홈 화면 설치와 푸시 알림을 설정하면 새 소식을 빠르게 확인할 수 있습니다.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleInstallClick}
                className={cn(
                  "h-11 rounded-md text-sm font-semibold transition-colors",
                  deferredInstallPrompt
                    ? "bg-app-brand text-white"
                    : "bg-app-surface text-app-muted"
                )}
                disabled={!deferredInstallPrompt || installLoading}
              >
                {installLoading ? "설치 준비 중..." : "홈 화면에 설치하기"}
              </button>
              <button
                type="button"
                onClick={handleGoPushSettings}
                className="h-11 rounded-md bg-app-surface text-sm font-semibold text-app-text"
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
                className="h-10 rounded-md text-sm font-medium text-app-muted"
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
