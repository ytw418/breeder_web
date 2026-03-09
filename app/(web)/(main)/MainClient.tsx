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
import useUser from "hooks/useUser";
import { toAuctionPath } from "@libs/auction-route";
import { toPostPath } from "@libs/post-route";
import { HomeFeedResponse } from "@libs/shared/ranking";

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

const formatGrowthRate = (growthRate: number) => {
  return `${growthRate >= 0 ? "+" : ""}${Math.round(growthRate * 100)}%`;
};

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
  // 상단 홈 경험은 단일 피드 API로 묶고, 상품 리스트만 기존 무한스크롤 구조를 유지한다.
  const { data: homeFeedData } = useSWR<HomeFeedResponse>("/api/home/feed?period=weekly");
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

  return (
    <div className="app-page flex flex-col h-full">
      {/* 상단 배너/히어로 */}
      <section className="app-reveal">
        <div
          ref={bannerRef}
          onScroll={handleBannerScroll}
          className="app-rail flex gap-0"
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

      <section className="app-section app-reveal app-reveal-1 py-2">
        <SectionHeader
          title="이번 주 TOP 브리더"
          subtitle="게시, 댓글, 입찰, 낙찰 활동을 합산한 주간 리더보드"
          href="/ranking"
          actionLabel="랭킹 보기"
        />
        <div className="mt-1 px-5">
          {homeFeedData?.heroBreeder ? (
            // 첫 스크린은 주간 1위 브리더와 즉시 행동 CTA에 집중해 홈 방향성을 명확히 준다.
            <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.22),_transparent_38%),linear-gradient(135deg,#0f172a,#111827_55%,#1d4ed8)] p-5 text-white shadow-xl">
              <p className="app-kicker text-white/70">Weekly Hero</p>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">
                    {homeFeedData.heroBreeder.user.name}
                  </h3>
                  <p className="mt-1 text-sm text-white/75">
                    점수 {homeFeedData.heroBreeder.score.toLocaleString()} · {formatRankDelta(homeFeedData.heroBreeder.rankDelta)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-white/10 px-2.5 py-1">게시 {homeFeedData.heroBreeder.postsCount}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1">댓글 {homeFeedData.heroBreeder.commentsCount}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1">입찰 {homeFeedData.heroBreeder.bidsCount}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1">낙찰 {homeFeedData.heroBreeder.auctionWinsCount}</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
                  <p className="text-[11px] text-white/70">현재 순위</p>
                  <p className="text-3xl font-black">#{homeFeedData.heroBreeder.rank}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(homeFeedData.heroBreeder.badges || []).slice(0, 2).map((badge) => (
                    <span key={badge.id} className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
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
                    router.push(user ? "/ranking" : "/auth/login?next=%2Franking");
                  }}
                  className="inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold text-slate-900"
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

      <section className="app-section app-reveal app-reveal-1 py-2">
        <SectionHeader
          title="카테고리별 최고가 경매"
          subtitle="이번 주 가장 높은 낙찰가를 기록한 경매"
          href="/auctions"
        />
        <div className="mt-1 px-5">
          <div className="app-rail flex gap-3">
            {homeFeedData?.topAuctionsByCategory?.length ? (
              homeFeedData.topAuctionsByCategory.map((auction, index) => (
                <Link
                  key={auction.auctionId}
                  href={toAuctionPath(auction.auctionId, auction.title)}
                  onClick={() => {
                    trackEvent(ANALYTICS_EVENTS.rankingCardClick, {
                      ranking_type: "auction",
                      rank: auction.rank,
                      entity_id: auction.auctionId,
                      section_id: "auction_ranking",
                    });
                    trackEvent(ANALYTICS_EVENTS.homeOngoingAuctionClicked, {
                      auction_id: auction.auctionId,
                      auction_title: auction.title,
                      rank_index: index,
                      current_price: auction.currentPrice,
                      user_id: user?.id || null,
                    });
                  }}
                  className="snap-start shrink-0 w-60 app-card app-card-interactive p-4"
                >
                  <p className="app-kicker">{auction.topLevelCategory}</p>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{auction.title}</h3>
                  <p className="mt-3 text-xl font-black tracking-tight text-primary">
                    {auction.currentPrice.toLocaleString()}원
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    판매자 {auction.seller.name} · {new Date(auction.endAt).toLocaleDateString("ko-KR")}
                  </p>
                </Link>
              ))
            ) : (
              <div className="app-card p-4 text-sm text-slate-400">이번 주 낙찰 데이터가 없습니다.</div>
            )}
          </div>
        </div>
      </section>

      <section className="app-section app-reveal app-reveal-1 py-2">
        <SectionHeader
          title="인기 혈통 TOP"
          subtitle="팔로우, 거래 수, 평균 낙찰가를 반영한 혈통 랭킹"
          href="/bloodline-management"
          actionLabel="혈통 관리"
        />
        <div className="mt-1 px-5">
          <div className="app-rail flex gap-3">
            {homeFeedData?.topBloodlines?.length ? (
              homeFeedData.topBloodlines.map((bloodline) => (
                <Link
                  key={bloodline.bloodlineRootId}
                  href={`/bloodline-management/card/${bloodline.bloodlineRootId}`}
                  onClick={() =>
                    trackEvent(ANALYTICS_EVENTS.rankingCardClick, {
                      ranking_type: "bloodline",
                      rank: bloodline.rank,
                      entity_id: bloodline.bloodlineRootId,
                      section_id: "bloodline_ranking",
                    })
                  }
                  className="snap-start shrink-0 w-64 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
                      {bloodline.image ? (
                        <Image
                          src={makeImageUrl(bloodline.image, "public")}
                          alt={bloodline.name}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-amber-500">#{bloodline.rank}</p>
                      <h3 className="truncate text-sm font-semibold text-slate-900">{bloodline.name}</h3>
                      <p className="text-xs text-slate-500">
                        {bloodline.speciesType || "종 미지정"} · {bloodline.creator.name}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">팔로우 {bloodline.followCount}</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">거래 {bloodline.tradeCount}</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">평균가 {bloodline.avgClosingPrice.toLocaleString()}원</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">상승률 {formatGrowthRate(bloodline.growthRate7d)}</div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="app-card p-4 text-sm text-slate-400">집계 가능한 혈통 활동이 아직 부족합니다.</div>
            )}
          </div>
        </div>
      </section>

      <section className="app-section app-reveal app-reveal-1 py-2">
        <SectionHeader
          title="급상승 커뮤니티"
          subtitle="최근 24시간 반응이 빠르게 늘어난 글"
          href="/posts"
        />
        <div className="mt-1 px-5">
          <div className="app-rail flex gap-3">
            {homeFeedData?.trendingPosts?.length ? (
              homeFeedData.trendingPosts.map((item) => (
                <Link
                  key={item.post.id}
                  href={toPostPath(item.post.id, item.post.title)}
                  onClick={() =>
                    trackEvent(ANALYTICS_EVENTS.rankingCardClick, {
                      ranking_type: "community",
                      rank: item.rank,
                      entity_id: item.post.id,
                      section_id: "trending_community",
                    })
                  }
                  className="snap-start shrink-0 w-64 app-card app-card-interactive p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-rose-500">#{item.rank} 상승중</p>
                      <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-900">
                        {item.post.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">
                        {item.post.description}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{item.post.user.name}</span>
                        <span>좋아요 {item.likes24h}</span>
                        <span>댓글 {item.comments24h}</span>
                      </div>
                    </div>
                    {item.post.image ? (
                      <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-100">
                        <Image
                          src={makeImageUrl(item.post.image, "public")}
                          className="h-full w-full object-cover"
                          width={64}
                          height={64}
                          alt={item.post.title}
                        />
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))
            ) : (
              <div className="app-card p-4 text-sm text-slate-400">급상승 글이 집계되면 여기에 표시됩니다.</div>
            )}
          </div>
        </div>
      </section>

      <section className="app-section app-reveal app-reveal-2 py-2">
        <SectionHeader
          title={user ? "내 랭킹 현황" : "랭킹 참여 시작하기"}
          subtitle={
            user
              ? "이번 주 순위와 미션 진행도를 한 번에 확인하세요"
              : "로그인 후 순위, 미션, 배지까지 이어지는 성장 루프를 시작하세요"
          }
          href={user ? "/ranking" : "/auth/login?next=%2Franking"}
          actionLabel={user ? "내 순위 보기" : "로그인"}
        />
        <div className="mt-1 px-5">
          {user && homeFeedData?.myRanking ? (
            // 로그인 사용자는 현재 순위와 미션을 한 카드에서 보고 다음 행동을 바로 선택할 수 있어야 한다.
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="app-kicker">My Weekly Rank</p>
                  <h3 className="mt-1 text-2xl font-black text-slate-900">
                    {homeFeedData.myRanking.currentRank ? `#${homeFeedData.myRanking.currentRank}` : "집계 대기"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    점수 {homeFeedData.myRanking.score.toLocaleString()} · {formatRankDelta(homeFeedData.myRanking.rankDelta)}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {homeFeedData.myRanking.badges.slice(0, 2).map((badge) => (
                    <span key={badge.id} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {homeFeedData.myMissionSummary.map((mission) => (
                  <div key={mission.key} className="rounded-2xl bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-700">{mission.title}</span>
                      <span className="text-xs text-slate-500">
                        {mission.progress}/{mission.targetCount}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-all"
                        style={{
                          width: `${Math.min(100, (mission.progress / mission.targetCount) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
              <p className="app-kicker text-white/70">Join The Stage</p>
              <h3 className="mt-2 text-xl font-black">실력은 기록되고, 신뢰는 거래로 증명됩니다</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                로그인 후 주간 랭킹, 미션, 배지, 알림까지 한 화면에서 이어집니다.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 혈통카드 */}
      <section className="app-section app-reveal app-reveal-2 py-2">
        <SectionHeader
          title="혈통카드"
          subtitle="랭킹 이후의 신뢰 증빙 레이어"
          href="/bloodline-cards/create"
          actionLabel="만들기"
        />
        <div className="mt-1 px-5">
          <Link
            href="/bloodline-cards/create"
            className="relative overflow-hidden app-card app-card-interactive block border border-white/15 bg-gradient-to-r from-slate-900 via-violet-900 to-indigo-900 p-4 text-white transition duration-200 hover:-translate-y-0.5"
          >
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            <div className="pointer-events-none absolute -left-6 -top-6 h-16 w-16 rounded-full bg-violet-300/20 blur-2xl" />
            <div className="pointer-events-none absolute -right-8 -bottom-8 h-16 w-16 rounded-full bg-indigo-300/18 blur-2xl" />
            <p className="app-kicker text-white/90">Bloodline Card</p>
            <h3 className="mt-1.5 text-base font-semibold text-white">내 혈통카드 만들기</h3>
            <p className="mt-1.5 text-xs leading-snug text-white/85">
              대표 혈통을 공개하고 거래/보유 이력을 신뢰 레이어로 연결하세요.
            </p>
          </Link>
        </div>
      </section>

      {/* 브리디북 랜딩 */}
      <section className="app-section app-reveal app-reveal-2 py-2">
        <SectionHeader
          title="브리디북"
          subtitle="메인 유입이 아닌 증빙 기록 레이어"
          href="/bredybook-landing"
          actionLabel="바로가기"
        />
        <div className="mt-1 px-5">
          <Link
            href="/bredybook-landing"
            className="relative overflow-hidden app-card app-card-interactive block border border-orange-400/45 bg-gradient-to-r from-[#ff8b2a] via-[#ff6f0f] to-[#ff8b2a] p-4 text-white transition duration-200 hover:-translate-y-0.5 overflow-hidden"
          >
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="pointer-events-none absolute -left-6 -top-6 h-16 w-16 rounded-full bg-white/20 blur-2xl" />
            <div className="pointer-events-none absolute -right-8 -bottom-8 h-16 w-16 rounded-full bg-yellow-100/20 blur-2xl" />
            <p className="app-kicker text-white/90">Bredybook</p>
            <h3 className="mt-1.5 text-base font-semibold text-white">공식 기록으로 실력을 증명하세요</h3>
            <p className="mt-1.5 text-xs leading-snug text-white/85">
              프로필과 랭킹에서 신뢰 근거로 이어지는 기록을 축적합니다.
            </p>
          </Link>
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
