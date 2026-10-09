"use client";

import { UIEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { useRouter } from "next/navigation";

import FloatingButton from "@components/atoms/floating-button";
import Image from "@components/atoms/Image";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { ProductCard } from "@components/app/ProductCard";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import { cn, makeImageUrl } from "@libs/client/utils";
import { TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { withoutBlocked } from "@libs/shared/blockFilter";
import { uniqueById } from "@libs/productFilters";
import useUser from "hooks/useUser";
import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath, withinScope } from "hooks/useCategoryScope";
import CategoryScopeBar from "@components/features/category/CategoryScopeBar";
import NeighborhoodBreederSection from "@components/features/home/NeighborhoodBreederSection";
import { BreederRankingItem, HomeFeedResponse } from "@libs/shared/ranking";
import { pickBreederKeywords, type BreederKeyword, type BreederTitleKey } from "@libs/shared/breederKeywords";
import { filterHomeFeedForBlocked, HomeBanner, ProductsResponse } from "@libs/shared/home";
import { ProductRowSkeleton } from "../products/_components/ProductRowSkeleton";
import { ProductFeedEmpty } from "../products/_components/ProductFeedEmpty";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/** 탭 목록: "전체" + 대분류(앱 TOP_LEVEL_CATEGORIES) */
const TABS = [{ id: "전체", name: "전체" }, ...TOP_LEVEL_CATEGORIES];
const HOME_FEED_KEY = "/api/home/feed?scope=public";

type RankingTabId = "breeders" | "auctions" | "bloodlines" | "community";
type RankingPeriodId = "weekly" | "all";

const toRankingHref = (tab: RankingTabId, period: RankingPeriodId) =>
  `/ranking?tab=${tab}&period=${period}`;

const formatRankDelta = (rankDelta: number) => {
  if (rankDelta > 0) return `▲ ${rankDelta}`;
  if (rankDelta < 0) return `▼ ${Math.abs(rankDelta)}`;
  return "유지";
};

/** 섹션 제목(앱 SectionHeader: 18/700 strong + 12 muted 부제 + 오른쪽 13 muted 링크). */
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
  <div className="flex items-end justify-between gap-3 px-4">
    <div>
      <h2 className="text-[18px] font-bold tracking-tight text-app-strong">{title}</h2>
      {subtitle ? <p className="mt-1 text-[12px] font-medium text-app-muted">{subtitle}</p> : null}
    </div>
    {href ? (
      <Link
        href={href}
        className="inline-flex h-7 shrink-0 items-center text-[13px] font-medium text-app-muted"
      >
        {actionLabel} ›
      </Link>
    ) : null}
  </div>
);

function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded bg-app-surface", className)} />;
}

type MiniCardRow = {
  id: string | number;
  image?: string | null;
  main: string;
  sub: string;
  /** 행을 눌러 이동할 곳(무료나눔 → 상품 상세). */
  href?: string;
};

/** 2x2 그리드 카드(앱 MiniCard). 카드 전체가 링크이고, href 가 있는 행은 행 단위로 이동한다. */
function MiniCard({
  title,
  subtitle,
  rows,
  href,
  loading = false,
  showThumb = true,
  subTone,
  onOpen,
}: {
  title: string;
  subtitle: string;
  rows: MiniCardRow[];
  href: string;
  loading?: boolean;
  showThumb?: boolean;
  subTone?: "price";
  onOpen?: () => void;
}) {
  const router = useRouter();
  const open = () => {
    onOpen?.();
    router.push(href);
  };

  const rowContent = (row: MiniCardRow) => (
    <>
      {showThumb ? (
        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-app-placeholder">
          {row.image ? (
            <Image
              src={makeImageUrl(row.image, "public")}
              alt={row.main}
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          ) : null}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-app-sub">{row.main}</span>
        <span
          className={cn(
            "block text-[10px]",
            subTone === "price" ? "font-semibold text-app-brand" : "text-app-muted"
          )}
        >
          {row.sub}
        </span>
      </span>
    </>
  );

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`${title} 더보기`}
      onClick={open}
      onKeyDown={(event) => {
        // 안쪽 행 링크에서 누른 Enter 는 그 링크가 처리한다(카드 이동과 겹치지 않게).
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter") open();
      }}
      className="flex min-h-[126px] cursor-pointer flex-col gap-2 rounded-xl border border-app-border bg-app-elevated p-3 shadow-card"
    >
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-app-strong">{title}</h3>
          <span className="text-[10px] text-app-muted">더보기 ›</span>
        </div>
        <p className="mt-0.5 break-keep text-[10px] text-app-muted">{subtitle}</p>
      </div>
      <div className="mt-2 space-y-1.5">
        {loading
          ? [0, 1].map((i) => (
              <div key={i} className="flex items-center gap-2">
                {showThumb ? <Skeleton className="h-8 w-8 rounded-lg" /> : null}
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-2.5 w-4/5" />
                  <Skeleton className="mt-1 h-2 w-1/2" />
                </div>
              </div>
            ))
          : rows.map((row) =>
              row.href ? (
                <Link
                  key={row.id}
                  href={row.href}
                  onClick={(event) => event.stopPropagation()}
                  className="flex items-center gap-2"
                >
                  {rowContent(row)}
                </Link>
              ) : (
                <div key={row.id} className="flex items-center gap-2">
                  {rowContent(row)}
                </div>
              )
            )}
      </div>
    </div>
  );
}

/** 무료나눔이 0건일 때 카드(앱 FreeGiveawayEmptyCard, 2026-10-09 사용자 결정: 숨기지 않고 등록을 권한다). */
function FreeGiveawayEmptyCard() {
  return (
    <Link
      // 등록 화면에서 가격 '무료나눔'을 미리 고른 채로 연다.
      href="/products/upload?free=1"
      className="flex min-h-[126px] flex-col items-center justify-center rounded-xl border border-app-border bg-app-elevated p-3 text-center shadow-card"
    >
      <h3 className="text-sm font-bold text-app-strong">무료나눔</h3>
      <p className="mt-2 text-xs text-app-muted">아직 무료나눔이 없어요</p>
      <p className="mt-1 text-[10px] font-semibold text-app-brand">첫 번째로 등록해보세요 ›</p>
    </Link>
  );
}

/** 칭호 → 아래 숫자 칸 중 강조할 칸(앱 index.tsx HERO_TITLE_STATS). */
const HERO_TITLE_STATS: Partial<Record<BreederTitleKey, string[]>> = {
  auction: ["입찰", "낙찰"],
  talk: ["댓글"],
  post: ["게시"],
  listing: ["분양"],
};

function HeroBreederCard({
  hero,
  keyword,
  onChallenge,
}: {
  hero: BreederRankingItem;
  /** 칭호('경매왕'·'팔로워 부자' 등, 왜 1위인지). 구 서버면 없다. */
  keyword: BreederKeyword | null;
  onChallenge: () => void;
}) {
  const badge = hero.badges?.[0];
  const profileHref = `/profiles/${hero.user.id}`;
  const highlighted = (keyword && HERO_TITLE_STATS[keyword.key]) || [];
  return (
    <div className="overflow-hidden rounded-xl border border-app-border bg-app-elevated shadow-card">
      <div className="flex items-center gap-3 px-4 pb-3 pt-3.5">
        <Link
          href={profileHref}
          aria-label={`${hero.rank}위 ${hero.user.name}${keyword ? `, ${keyword.label} ${keyword.detail}` : ""}, ${hero.score.toLocaleString()}점, 프로필 보기`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="relative shrink-0">
            <div className="h-11 w-11 overflow-hidden rounded-full bg-app-placeholder ring-2 ring-amber-400/60">
              {hero.user.avatar ? (
                <Image
                  src={makeImageUrl(hero.user.avatar, "avatar")}
                  alt={hero.user.name}
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-app-border text-sm font-bold text-app-muted">
                  {hero.user.name.charAt(0)}
                </div>
              )}
            </div>
            {/* 다크에서도 amber 위 글자가 읽히도록 테마와 무관한 어두운 잉크를 쓴다(앱 S.onAccent). */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-app-warning text-[9px] font-black text-neutral-900">
              {hero.rank}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-bold text-app-strong">{hero.user.name}</h3>
              {badge ? (
                <span className="shrink-0 rounded bg-app-warning-soft px-1.5 py-0.5 text-[9px] font-semibold text-app-warning-text">
                  {badge.label}
                </span>
              ) : null}
            </div>
            {keyword ? (
              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 rounded-full bg-app-brand-soft px-2 py-[2px] text-[12px] font-semibold leading-4 text-app-brand">
                  {keyword.emoji} {keyword.label}
                </span>
                <span className="truncate text-[12px] text-app-muted">{keyword.detail}</span>
              </div>
            ) : null}
            <p className="mt-0.5 text-xs text-app-muted">
              {hero.score.toLocaleString()}점 · {formatRankDelta(hero.rankDelta)}
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={onChallenge}
          className="shrink-0 rounded-full bg-app-inverse px-3 py-1.5 text-[11px] font-semibold text-app-inverse-text"
        >
          도전하기
        </button>
      </div>
      <Link
        href={profileHref}
        tabIndex={-1}
        aria-hidden="true"
        className="flex divide-x divide-app-line border-t border-app-line"
      >
        {(hero.productsCount !== undefined
          ? // 관심 카테고리 범위 랭킹은 범위 안 게시글·분양글만 센다(앱 a158757).
            [
              { label: "게시", value: hero.postsCount },
              { label: "분양", value: hero.productsCount },
            ]
          : [
              { label: "게시", value: hero.postsCount },
              { label: "댓글", value: hero.commentsCount },
              { label: "입찰", value: hero.bidsCount },
              { label: "낙찰", value: hero.auctionWinsCount },
            ]
        ).map((stat) => {
          const on = highlighted.includes(stat.label);
          return (
            <div key={stat.label} className="flex-1 py-2.5 text-center">
              <p className={cn("text-sm font-bold", on ? "text-app-brand" : "text-app-strong")}>{stat.value}</p>
              <p className={cn("text-[10px]", on ? "font-semibold text-app-brand" : "text-app-muted")}>{stat.label}</p>
            </div>
          );
        })}
      </Link>
    </div>
  );
}

const MainClient = ({
  initialHomeFeed,
  initialProducts,
  initialBanners,
}: {
  initialHomeFeed: HomeFeedResponse | null;
  initialProducts: ProductsResponse | null;
  initialBanners: HomeBanner[];
}) => {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const { blockedIds } = useBlocks();
  const [selectedCategory, setSelectedCategory] = useState("전체");
  // 관심 카테고리 고정 범위(앱 category-pin). 홈 상품·피드가 같은 범위를 쓴다.
  const scope = useCategoryScope();
  // 범위 밖 대분류 칩은 숨기고, 고른 칩이 범위 밖으로 나가면 전체로 돌린다.
  const tabs = useMemo(
    () => withinScope(TABS, scope.topLevelNames, (tab) => tab.id, (tab) => tab.id === "전체"),
    [scope.topLevelNames]
  );
  const activeCategory = tabs.some((tab) => tab.id === selectedCategory) ? selectedCategory : "전체";
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [showPostLoginGuide, setShowPostLoginGuide] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installLoading, setInstallLoading] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── 상품 목록(무한 스크롤) ──────────────────────────────────────────────
  const getKey = (pageIndex: number, previousPageData: ProductsResponse | null) => {
    if (previousPageData && pageIndex >= (previousPageData.pages ?? 0)) return null;
    const categoryParam =
      activeCategory !== "전체" ? `&category=${encodeURIComponent(activeCategory)}` : "";
    return withCategoryPath(`/api/products?page=${pageIndex + 1}${categoryParam}`, scope.categoryPath);
  };
  // SSR 1페이지는 범위 없는 "전체" 목록이다. 다른 카테고리·범위에 그 값을 보여주지 않게 그때만 넘긴다.
  const productFallback =
    activeCategory === "전체" && !scope.categoryPath && initialProducts ? [initialProducts] : undefined;
  const {
    data: productPages,
    error: productsError,
    size,
    setSize,
    isValidating: productsValidating,
    mutate: reloadProducts,
  } = useSWRInfinite<ProductsResponse>(getKey, {
    fallbackData: productFallback,
    revalidateFirstPage: false,
    revalidateOnFocus: false,
    revalidateOnMount: !productFallback,
    revalidateIfStale: false,
  });

  // ── 홈 피드(공개 캐시) ─────────────────────────────────────────────────
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
  const banners = initialBanners;

  const products = useMemo(
    () =>
      withoutBlocked(
        uniqueById((productPages ?? []).flatMap((pageData) => pageData?.products ?? [])),
        blockedIds,
        (product) => product.userId
      ),
    [productPages, blockedIds]
  );
  const totalPages = productPages?.[productPages.length - 1]?.pages ?? 0;
  const loadedPages = productPages?.length ?? 0;
  const hasMore = loadedPages > 0 && loadedPages < totalPages;
  const isLoadingMore = productsValidating && size > loadedPages;
  const firstPageError = Boolean(productsError) && loadedPages === 0;
  const nextPageError = Boolean(productsError) && loadedPages > 0;

  // 바닥 근처에 오면 다음 페이지. 다음 페이지가 실패하면 자동으로 다시 부르지 않고 '다시 시도'로만 부른다.
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || productsError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !productsValidating) {
          void setSize((current) => (current <= loadedPages ? loadedPages + 1 : current));
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, productsError, productsValidating, loadedPages, setSize]);

  const handleCategoryChange = (categoryId: string) => {
    if (categoryId === activeCategory) return;
    trackEvent(ANALYTICS_EVENTS.homeCategorySelected, {
      selected_category: categoryId,
      previous_category: activeCategory,
      user_id: user?.id || null,
    });
    setSelectedCategory(categoryId);
  };

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
    if (!feedOk) return;
    // 랭킹 우선 IA 전환 이후 섹션별 노출량을 비교할 수 있도록 홈 진입 시 한 번에 기록한다.
    const sectionIds = [
      "hero_breeder",
      "auction_ranking",
      "bloodline_ranking",
      "trending_community",
      "neighborhood_breeders",
      "free_giveaway",
      "personalized_home",
    ];
    sectionIds.forEach((sectionId, index) => {
      trackEvent(ANALYTICS_EVENTS.homeSectionView, {
        section_id: sectionId,
        position: index + 1,
        user_tier: user ? "member" : "guest",
        season_id: feedOk.currentSeasonId,
      });
    });
  }, [feedOk?.currentSeasonId, feedOk?.success, user]);

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
  const auctionPeriod: RankingPeriodId = feed?.topAuctionsMode === "all" ? "all" : "weekly";
  const bloodlinePeriod: RankingPeriodId = feed?.topBloodlinesMode === "all" ? "all" : "weekly";
  const communityPeriod: RankingPeriodId = feed?.trendingPostsMode === "all" ? "all" : "weekly";
  const weeklyBreederRankingHref = toRankingHref("breeders", "weekly");

  // 앱과 같은 결정(2026-10-06): 집계가 빈 카드는 숨긴다. 로딩 중에는 스켈레톤으로 자리를 둔다.
  const topAuctionRows: MiniCardRow[] = (feed?.topAuctionsByCategory ?? []).slice(0, 2).map((a) => ({
    id: a.auctionId,
    image: a.photo,
    main: a.title,
    sub: `${a.currentPrice.toLocaleString()}원`,
  }));
  const topBloodlineRows: MiniCardRow[] = (feed?.topBloodlines ?? []).slice(0, 2).map((b) => ({
    id: b.bloodlineRootId,
    image: b.image,
    main: b.name,
    sub: `보유자 ${b.ownerCount}명`,
  }));
  const trendingRows: MiniCardRow[] = (feed?.trendingPosts ?? []).slice(0, 2).map((t) => ({
    id: t.post.id,
    main: t.post.title,
    sub: `#${t.rank} 상승중`,
  }));
  const freeGiveawayRows: MiniCardRow[] = (feed?.freeGiveawayProducts ?? []).slice(0, 2).map((f) => ({
    id: f.id,
    image: f.photos[0],
    main: f.name,
    sub: f.user.name,
    href: `/products/${f.id}`,
  }));
  const showMini = (rows: MiniCardRow[]) => feedLoading || rows.length > 0;
  // 무료나눔 카드는 비어도 등록 권유 카드로 남으므로 그리드는 피드 오류일 때만 숨긴다.
  const showGrid = !feedError;
  const showTopBreeder = feedError || feedLoading || Boolean(hero);

  const trackRankingCard = (rankingType: string, entityId: number | string, sectionId: string) =>
    trackEvent(ANALYTICS_EVENTS.rankingCardClick, {
      ranking_type: rankingType,
      rank: 1,
      entity_id: entityId,
      section_id: sectionId,
    });

  const productsHref =
    activeCategory === "전체"
      ? "/products"
      : `/products?category=${encodeURIComponent(activeCategory)}`;

  return (
    <div className="flex h-full flex-col bg-app-bg">
      {/* 현재 관심 분야(고정 범위). 앱처럼 헤더 바로 아래에 고정하고, 누르면 설정 > 관심 카테고리. 온보딩을 마치면 숨는다. */}
      <div className="sticky top-14 z-20">
        <CategoryScopeBar />
      </div>
      {/* 배너 슬라이더(관리자 배너 API, 웹 그라데이션 카드 유지 — 좌우 여백만 16) */}
      <section className="relative bg-app-bg pb-1 pt-3">
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
                "app-card-interactive relative flex min-h-[132px] w-[calc(100vw-32px)] max-w-[calc(36rem-32px)] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-white/20 bg-gradient-to-br from-emerald-500 to-teal-500 px-4 py-4 text-white shadow-none",
                banner.bgClass
              )}
            >
              <div>
                <span className="text-[11px] font-semibold leading-none text-white/70">Bredy</span>
                <h2 className="mt-2 text-[20px] font-extrabold leading-tight tracking-normal text-white">
                  {banner.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-[1.45] tracking-normal text-white/85">
                  {banner.description}
                </p>
              </div>
              <span className="mt-4 inline-flex h-7 w-fit items-center rounded-md bg-white/15 px-2.5 text-[11px] font-bold text-white">
                자세히 보기
              </span>
            </Link>
          ))}
        </div>
        {banners.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center">
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
                    activeBannerIndex === index ? "bg-black" : "bg-black/25"
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {/* 우리 동네 브리더(2026-10-09, 앱과 같이) — '내 혈통 만들기' 이벤트 카드 자리 */}
      <NeighborhoodBreederSection />

      {/* 이번 주 TOP 브리더 — 집계가 비면 섹션을 숨긴다 */}
      {showTopBreeder ? (
        <section className="pb-2 pt-4">
          <SectionHeader
            title="이번 주 TOP 브리더"
            href={toRankingHref("breeders", heroBreederPeriod)}
            actionLabel="랭킹 보기"
          />
          <div className="mt-3 px-4">
            {feedError ? (
              <div className="rounded-xl border border-app-border bg-app-elevated shadow-card">
                <QueryErrorState
                  title="랭킹을 불러오지 못했어요"
                  onRetry={() => void reloadFeed()}
                  className="py-6"
                />
              </div>
            ) : feedLoading ? (
              <div className="space-y-2 rounded-xl border border-app-border bg-app-elevated p-4 shadow-card">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-[35%]" />
              </div>
            ) : hero ? (
              <HeroBreederCard
                hero={hero}
                keyword={heroKeyword}
                onChallenge={() => {
                  trackEvent(ANALYTICS_EVENTS.challengeJoin, {
                    challenge_id: "weekly_breeder_rank",
                    entry_type: user ? "member" : "guest",
                  });
                  router.push(
                    user
                      ? weeklyBreederRankingHref
                      : `/auth/login?next=${encodeURIComponent(weeklyBreederRankingHref)}`
                  );
                }}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 2x2 그리드 — 피드 오류면 위 오류 상태로 대신하고, 빈 카드는 숨긴다(무료나눔만 등록 권유 카드) */}
      {showGrid ? (
        <section className="py-2">
          <div className="grid grid-cols-2 gap-3 px-4">
            {showMini(topAuctionRows) ? (
              <MiniCard
                title="최고가 경매"
                subtitle="카테고리별 최고 낙찰가"
                href={toRankingHref("auctions", auctionPeriod)}
                loading={feedLoading}
                subTone="price"
                rows={topAuctionRows}
                onOpen={() =>
                  trackRankingCard("auction", topAuctionRows[0]?.id ?? "", "auction_ranking")
                }
              />
            ) : null}
            {showMini(topBloodlineRows) ? (
              <MiniCard
                title="인기 혈통 TOP"
                subtitle="보유자 수 기준 랭킹"
                href={toRankingHref("bloodlines", bloodlinePeriod)}
                loading={feedLoading}
                rows={topBloodlineRows}
                onOpen={() =>
                  trackRankingCard("bloodline", topBloodlineRows[0]?.id ?? "", "bloodline_ranking")
                }
              />
            ) : null}
            {showMini(trendingRows) ? (
              <MiniCard
                title="급상승 커뮤니티"
                subtitle="좋아요와 댓글 반응이 높은 커뮤니티 글"
                href={toRankingHref("community", communityPeriod)}
                loading={feedLoading}
                showThumb={false}
                rows={trendingRows}
                onOpen={() =>
                  trackRankingCard("community", trendingRows[0]?.id ?? "", "trending_community")
                }
              />
            ) : null}
            {showMini(freeGiveawayRows) ? (
              <MiniCard
                title="무료나눔"
                subtitle="가격 0원 · 지금 연락하세요"
                href="/products?status=판매중&price=0"
                loading={feedLoading}
                rows={freeGiveawayRows}
                onOpen={() =>
                  trackRankingCard("free_giveaway", freeGiveawayRows[0]?.id ?? "", "free_giveaway")
                }
              />
            ) : (
              <FreeGiveawayEmptyCard />
            )}
          </div>
        </section>
      ) : null}

      {/* 카테고리 칩(sticky). 고정 중에도 아래가 비치지 않게 불투명 배경 + 하단 1px line. */}
      <div className="sticky top-[100px] z-10 border-b border-app-line bg-app-bg py-1">
        <FilterChipRail>
          {tabs.map((tab) => (
            <FilterChip
              key={tab.id}
              label={tab.name}
              selected={activeCategory === tab.id}
              onClick={() => handleCategoryChange(tab.id)}
            />
          ))}
        </FilterChipRail>
      </div>

      {/* 전체 상품 헤더 */}
      <section id="all-products" className="flex items-end justify-between bg-app-bg px-4 pb-2 pt-6">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight text-app-strong">
            {activeCategory === "전체" ? "전체 분양" : `${activeCategory} 분양`}
          </h2>
          <p className="mt-1 text-[12px] font-medium text-app-muted">최신 등록 순으로 노출됩니다.</p>
        </div>
        <Link
          href={productsHref}
          className="inline-flex h-7 shrink-0 items-center text-[13px] font-medium text-app-muted"
        >
          분양 목록 ›
        </Link>
      </section>

      {/* 상품 목록 */}
      <div className="bg-app-bg pb-4">
        {products.length > 0 ? (
          products.map((product) => (
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
        ) : firstPageError ? (
          <QueryErrorState
            title="분양 목록을 불러오지 못했어요"
            onRetry={() => void reloadProducts()}
          />
        ) : !productPages || (productsValidating && loadedPages === 0) ? (
          <ProductRowSkeleton count={5} />
        ) : (
          <ProductFeedEmpty />
        )}

        {products.length > 0 ? (
          <RetryFooter
            loading={isLoadingMore}
            error={nextPageError}
            onRetry={() => void setSize(loadedPages + 1)}
          />
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>

      <FloatingButton href="/products/upload" label="분양 등록">
        <svg
          className="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
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
