"use client";

import { HorizontalRail } from "@components/ui/HorizontalRail";
import useScopeTerms from "@/hooks/useScopeTerms";
import { withBreederWord } from "@libs/shared/scopeTerms";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";

import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import FloatingButton from "@components/atoms/floating-button";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { PostCard } from "@components/app/PostCard";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath } from "hooks/useCategoryScope";
import useUser from "hooks/useUser";

import { cn, makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import { POST_CATEGORIES } from "@libs/constants";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { getSubcategories, TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import SubcategoryChipRow from "@components/features/category/SubcategoryChipRow";
import {
  activeSubcategory,
  categoryQueryValue,
  subcategoryChipOptions,
} from "@libs/shared/subcategoryChips";
import { withoutBlocked } from "@libs/shared/blockFilter";
import { FOLLOWING_POST_FILTER, REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import { regionOf } from "@libs/shared/regions";
import type { PostsListResponse } from "pages/api/posts";
import type { NoticePostsResponse } from "pages/api/posts/notices";
import type { NearbyBreedersResponse } from "pages/api/users/nearby";
import type {
  BloodlineRankingItem,
  BreederRankingItem,
  HotDiscussionItem,
} from "@libs/shared/ranking";
import TopBreederList, { TOP_BREEDER_HIGHLIGHTS } from "@components/features/post/TopBreederList";
import NearbyBreederList, { NEARBY_BREEDER_COUNT } from "@components/features/post/NearbyBreederList";
import RegionGateCard from "@components/features/region/RegionGateCard";
import FollowingFeedCard from "@components/features/post/FollowingFeedCard";
import RealtimeHotRail, {
  RealtimeHotRailSkeleton,
  type RealtimeHotItem,
} from "@components/features/post/RealtimeHotRail";
import AwaitingAnswerCard from "@components/features/post/AwaitingAnswerCard";
import type { HotRealtimeMeta, UnansweredSummary } from "@libs/shared/communityVibe";
import { PostFilterDropdown } from "./_components/PostFilterDropdown";

/** 카테고리 칩 목록. '팔로잉'은 카테고리가 아니라 내가 팔로우한 사람의 글 필터다(앱 posts.tsx). */
const TABS = [
  { id: "전체", name: "전체" },
  { id: FOLLOWING_POST_FILTER, name: FOLLOWING_POST_FILTER },
  ...POST_CATEGORIES,
];
const SORT_TABS = [
  { id: "latest", name: "최신순" },
  { id: "popular", name: "인기순" },
  { id: "comments", name: "댓글순" },
] as const;
type SortType = (typeof SORT_TABS)[number]["id"];
/** 상단 세그먼트(community-vibe §3.5): 실시간 TOP 토론 · 답 기다려요 N · 동네 · 랭킹. */
type HighlightTab = "hot" | "waiting" | "nearby" | "breeder";
const HIGHLIGHT_TABS: { id: HighlightTab; label: string }[] = [
  { id: "hot", label: "실시간 TOP 토론" },
  { id: "waiting", label: "답 기다려요" },
  { id: "nearby", label: "동네" },
  { id: "breeder", label: "랭킹" },
];
type RealtimePostsResponse = {
  success?: boolean;
  posts?: (PostsListResponse["posts"][number] & Partial<HotRealtimeMeta>)[];
};
type UnansweredResponse = { success?: boolean; posts?: PostsListResponse["posts"] } & Partial<UnansweredSummary>;
/** HOT 토론은 상위 3개만 보여 준다(앱 d8f0211). */
const HOT_DISCUSSION_COUNT = 3;

const SPECIES_OPTIONS = [
  { value: "전체", label: "전체 종" },
  ...TOP_LEVEL_CATEGORIES.map((s) => ({ value: s.id, label: s.name })),
];
const SORT_OPTIONS = SORT_TABS.map((s) => ({ value: s.id, label: s.name }));

const NOTICE_FALLBACK_TITLE = "게시글 작성 전 커뮤니티 운영 가이드를 확인해 주세요.";

const BACKUP_COMMUNITY_CONTENT = [
  {
    id: "community-fallback-1",
    title: "브리더 노하우 공유 시작",
    description: "사육, 변이, 거래 팁을 나누고 서로 성장할 수 있어요.",
    cta: "첫 게시글 작성하기",
    href: "/posts/upload",
  },
  {
    id: "community-fallback-2",
    title: "궁금한 점이 있다면 편하게 물어보세요",
    description: "좋은 답변을 받기 위한 질문 가이드도 함께 제공해요.",
    cta: "질문 글 쓰기",
    href: "/posts/upload",
  },
] as const;

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-app-placeholder", className)} />;
}

/** 앱 SkeletonPostRow */
function SkeletonPostRow() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="flex-1">
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="mt-2 h-4 w-3/4" />
        <SkeletonBlock className="mt-2 h-3 w-full" />
        <SkeletonBlock className="mt-2 h-3 w-1/2" />
      </div>
      <SkeletonBlock className="h-[72px] w-[72px] rounded-lg" />
    </div>
  );
}

export default function PostsClient({ initialCategory }: { initialCategory?: string } = {}) {
  const { breeder } = useScopeTerms();
  // 홈 '동네 사랑방'처럼 ?category=동네 로 들어오면 그 칩으로 시작한다(앱 posts.tsx 와 같다).
  const [selectedCategory, setSelectedCategory] = useState(() =>
    initialCategory && TABS.some((tab) => tab.id === initialCategory) ? initialCategory : "전체"
  );
  const [selectedSort, setSelectedSort] = useState<SortType>("latest");
  const [selectedSpecies, setSelectedSpecies] = useState("전체");
  const [pickedTab, setPickedTab] = useState<HighlightTab | null>(null);
  const { blockedIds } = useBlocks();
  // 관심 카테고리 고정 범위(앱 category-pin). 목록·HOT 토론·TOP 브리더가 같은 범위를 쓴다.
  const scope = useCategoryScope();
  // 종 드롭다운은 범위 안 대분류만 보여 주고, 고른 종이 범위 밖이면 전체 종으로 돌린다.
  const speciesOptions = useMemo(
    () =>
      SPECIES_OPTIONS.filter(
        (option) =>
          option.value === "전체" || !scope.topLevelNames || scope.topLevelNames.has(option.value)
      ),
    [scope.topLevelNames]
  );
  const activeSpecies = speciesOptions.some((option) => option.value === selectedSpecies)
    ? selectedSpecies
    : "전체";
  // 종을 고르면 정렬 줄 아래에 소분류 칩(선택, 앱과 같다). 서버 species 는 소분류 이름도 받는다.
  const [selectedSubSpecies, setSelectedSubSpecies] = useState("");
  const subSpeciesOptions = useMemo(
    () =>
      activeSpecies === "전체"
        ? []
        : subcategoryChipOptions(
            activeSpecies,
            getSubcategories(activeSpecies),
            scope.pins.map((pin) => pin.label)
          ),
    [activeSpecies, scope.pins]
  );
  const activeSubSpecies = activeSubcategory(selectedSubSpecies, subSpeciesOptions);
  const speciesQuery = categoryQueryValue(activeSpecies, activeSubSpecies);

  // '동네' 칩·'우리 동네' 탭은 내 동네(시/도·시/군/구)가 있어야 한다(앱 posts.tsx). 없으면 RegionGateCard 로 안내하고 목록은 받지 않는다.
  const { user, isLoading: userLoading } = useUser();
  const myRegion = regionOf(user);
  const isRegionCategory = selectedCategory === REGION_POST_CATEGORY;
  // '팔로잉' 칩은 로그인해야 받는다(서버도 비로그인 401). 비로그인은 FollowingFeedCard 로 로그인을 안내한다.
  const isFollowingFilter = selectedCategory === FOLLOWING_POST_FILTER;
  const showFollowingGate = isFollowingFilter && !user && !userLoading;
  // 계정을 받는 중에는 안내 카드 대신 스켈레톤을 둔다(안내 카드가 잠깐 비치지 않게).
  const showRegionGate = !myRegion && !userLoading;

  /** region: 동네 글 필터. 시/도만 주면 시/도 전체, 시/군/구까지 주면 그 동네만. */
  const makeGetKey =
    (region: { sido: string; sigungu?: string } | null) =>
    (pageIndex: number, previousPageData: PostsListResponse | null) => {
      if (previousPageData && (!previousPageData.posts.length || pageIndex >= previousPageData.pages)) {
        return null;
      }
      const categoryParam = isFollowingFilter
        ? "&following=1"
        : selectedCategory !== "전체"
          ? `&category=${encodeURIComponent(selectedCategory)}`
          : "";
      const sortParam = selectedSort !== "latest" ? `&sort=${selectedSort}` : "";
      const speciesParam = speciesQuery ? `&species=${encodeURIComponent(speciesQuery)}` : "";
      const regionParam = region
        ? `&regionSido=${encodeURIComponent(region.sido)}${
            region.sigungu ? `&regionSigungu=${encodeURIComponent(region.sigungu)}` : ""
          }`
        : "";
      return withCategoryPath(
        `/api/posts?page=${pageIndex + 1}${categoryParam}${sortParam}${speciesParam}${regionParam}`,
        scope.categoryPath
      );
    };

  // 동네 글은 먼저 시/군/구로 받고, 1페이지가 0건이면 시/도 전체로 넓혀 다시 받는다(앱 AC-14).
  const sigunguList = useSWRInfinite<PostsListResponse>(
    (isRegionCategory && !myRegion) || (isFollowingFilter && !user)
      ? () => null
      : makeGetKey(isRegionCategory ? myRegion : null),
    { revalidateFirstPage: false }
  );
  const widenToSido = Boolean(
    isRegionCategory && myRegion && sigunguList.data && (sigunguList.data[0]?.posts.length ?? 0) === 0
  );
  const sidoList = useSWRInfinite<PostsListResponse>(
    widenToSido && myRegion ? makeGetKey({ sido: myRegion.sido }) : () => null,
    { revalidateFirstPage: false }
  );
  const {
    data,
    error: listError,
    size,
    setSize,
    isValidating,
    mutate: mutateList,
  } = widenToSido ? sidoList : sigunguList;
  // 동네 목록 제목 아래 범위 표시: 시/군/구, 넓혔으면 "서울특별시 전체".
  const regionScopeLabel =
    isRegionCategory && myRegion ? (widenToSido ? `${myRegion.sido} 전체` : myRegion.sigungu) : null;
  // TOP 브리더: /ranking '전체' 기간과 같은 데이터(범위 포함) + 상위 사진·좋아요·팔로워(highlights).
  // '혈통 부자' 칭호용으로 혈통 랭킹도 받는다.
  const {
    data: breedersData,
    error: breedersError,
    mutate: mutateBreeders,
  } = useSWR<{ success: boolean; items: BreederRankingItem[] }>(
    withCategoryPath(
      `/api/rankings/breeders?limit=50&period=all&highlights=${TOP_BREEDER_HIGHLIGHTS}`,
      scope.categoryPath
    )
  );
  const { data: bloodlinesData } = useSWR<{ success: boolean; items: BloodlineRankingItem[] }>(
    "/api/rankings/bloodlines?limit=50&period=all"
  );
  const { data: noticeData } = useSWR<NoticePostsResponse>("/api/posts/notices");
  const {
    data: nearbyData,
    error: nearbyError,
    mutate: mutateNearby,
  } = useSWR<NearbyBreedersResponse>(myRegion ? `/api/users/nearby?limit=${NEARBY_BREEDER_COUNT}` : null);
  // 실시간 TOP 토론: 최근 24시간 활동 점수순(서버 hot=realtime). 구 서버면 home/feed 의 HOT 토론으로 대신한다.
  const {
    data: realtimeData,
    error: realtimeError,
    mutate: mutateRealtime,
  } = useSWR<RealtimePostsResponse>(
    withCategoryPath(`/api/posts?hot=realtime&limit=${HOT_DISCUSSION_COUNT}`, scope.categoryPath),
    { revalidateOnFocus: false }
  );
  const realtimeUnsupported = Boolean(
    realtimeError || (realtimeData && !realtimeData.posts?.some((post) => post.lastActivityAt))
  );
  const { data: homeFeedData } = useSWR<{ hotDiscussions: HotDiscussionItem[] }>(
    realtimeUnsupported ? withCategoryPath("/api/home/feed?scope=public", scope.categoryPath) : null,
    { revalidateOnFocus: false }
  );
  // 답 기다려요: 가장 오래 답 없는 질문 1개 + 전체 개수.
  const { data: unansweredData } = useSWR<UnansweredResponse>("/api/posts?unanswered=1&limit=1", {
    revalidateOnFocus: false,
  });
  const sentinelRef = useRef<HTMLDivElement>(null);

  const resetList = () => {
    setSize(1);
    window.scrollTo({ top: 0 });
  };

  // 시작 칩으로 쓴 ?category= 는 주소에서 지운다. 이후 칩을 바꿔도 주소와 어긋나지 않는다.
  useEffect(() => {
    if (initialCategory) window.history.replaceState(null, "", "/posts");
  }, [initialCategory]);

  const handleCategoryChange = (categoryId: string) => {
    if (categoryId === selectedCategory) return;
    trackEvent(ANALYTICS_EVENTS.postsCategorySelected, {
      selected_category: categoryId,
      previous_category: selectedCategory,
    });
    setSelectedCategory(categoryId);
    resetList();
  };
  const handleSortChange = (sortType: SortType) => {
    if (selectedSort === sortType) return;
    trackEvent(ANALYTICS_EVENTS.postsSortChanged, {
      selected_sort: sortType,
      previous_sort: selectedSort,
    });
    setSelectedSort(sortType);
    resetList();
  };
  const handleSpeciesChange = (species: string) => {
    if (activeSpecies === species) return;
    trackEvent(ANALYTICS_EVENTS.postsSpeciesChanged, {
      selected_species: species,
      previous_species: activeSpecies,
    });
    setSelectedSpecies(species);
    setSelectedSubSpecies("");
    resetList();
  };

  // 페이지 사이에 새 글이 끼면 같은 글이 다음 페이지에 또 올 수 있어 id 로 거른다.
  const posts = useMemo(() => {
    const seen = new Set<number>();
    const all = (data ?? []).flatMap((pageData) => pageData?.posts ?? []).filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
    return withoutBlocked(all, blockedIds, (post) => post.user?.id);
  }, [data, blockedIds]);

  // 공개 캐시 응답(HOT 토론·브리디 랭킹)은 서버가 차단을 거르지 않아 여기서 거른다.
  const hotItems = useMemo<RealtimeHotItem[] | undefined>(() => {
    if (!realtimeUnsupported) {
      if (!realtimeData) return undefined;
      return withoutBlocked(realtimeData.posts ?? [], blockedIds, (post) => post.user?.id)
        .slice(0, HOT_DISCUSSION_COUNT)
        .map((post) => ({
          id: post.id,
          title: post.title,
          image: post.images?.[0] ?? post.image ?? null,
          authorName: post.user?.name ?? "",
          comments: post._count?.comments ?? 0,
          lastActivityAt: post.lastActivityAt ?? String(post.createdAt),
          lastActivityKind: post.lastActivityKind ?? "post",
        }));
    }
    if (!homeFeedData) return undefined;
    return withoutBlocked(homeFeedData.hotDiscussions ?? [], blockedIds, (item) => item.user?.id)
      .slice(0, HOT_DISCUSSION_COUNT)
      .map((item) => ({
        id: item.id,
        title: item.title,
        image: item.image || null,
        authorName: item.user?.name ?? "",
        comments: item.commentsCount,
        lastActivityAt: item.createdAt,
        lastActivityKind: "post" as const,
      }));
  }, [realtimeUnsupported, realtimeData, homeFeedData, blockedIds]);
  const awaitingQuestion = useMemo(
    () => withoutBlocked(unansweredData?.posts ?? [], blockedIds, (post) => post.user?.id)[0] ?? null,
    [unansweredData, blockedIds]
  );
  const unansweredCount = unansweredData?.unansweredCount ?? 0;
  const topBreeders = useMemo(
    () =>
      breedersData
        ? withoutBlocked(breedersData.items ?? [], blockedIds, (item) => item.user?.id)
        : undefined,
    [breedersData, blockedIds]
  );

  // 사용자가 직접 고르기 전까지, 실시간 토론이 비어 있으면 랭킹이 기본.
  const highlightTab: HighlightTab =
    pickedTab ?? (hotItems && hotItems.length === 0 ? "breeder" : "hot");

  const noticePost = noticeData?.posts?.[0] ?? null;
  const noticeHref = noticePost ? toPostPath(noticePost.id, noticePost.title) : "/posts/notices";
  const noticeTitle = noticePost?.title ?? NOTICE_FALLBACK_TITLE;

  const listTitle = selectedCategory === "전체" ? "전체 게시글" : `${selectedCategory} 게시글`;

  const lastPage = data?.[data.length - 1];
  const totalPages = data?.[0]?.pages ?? 0;
  const hasMore = Boolean(data && lastPage?.posts.length && data.length < totalPages);
  const isInitialLoading = !data && !listError;
  const isLoadingMore = Boolean(data && size > data.length && isValidating && !listError);
  const loadedPages = data?.length ?? 0;

  // 바닥 감시 칸이 보이면 다음 페이지 하나만 받는다. 더 없거나 받는 중이면 부르지 않는다
  // (스크롤마다 페이지 수를 올리면 바닥에서 1페이지를 계속 다시 받아 목록이 깜박였다).
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || listError) return;
    const observer = new IntersectionObserver(
      (entries, self) => {
        if (!entries[0]?.isIntersecting || isValidating) return;
        // setSize 는 같은 크기로 불러도 다시 받는다. 한 번 부르면 끊고, 받은 뒤 새 감시가 이어 간다.
        self.disconnect();
        void setSize(loadedPages + 1);
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, listError, isValidating, loadedPages, setSize]);

  const selectHighlightTab = (tab: HighlightTab) => {
    trackEvent(ANALYTICS_EVENTS.postsHighlightTabChanged, { tab });
    setPickedTab(tab);
  };

  // 높이 34 r8 surface, 선택은 검정(이모지·빨강 채움 없음).
  const highlightTabClass = (active: boolean) =>
    cn(
      "inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[14px] font-semibold transition-colors",
      active ? "bg-app-inverse text-app-inverse-text" : "bg-app-surface text-app-sub"
    );

  return (
    <Layout icon hasTabBar title="반려생활" seoTitle="반려생활" showSearch>
      <div className="flex min-h-full flex-col bg-app-bg pb-20">
        {/* 1. 공지 한 줄(높이 40) */}
        <div className="px-4">
          <Link
            href={noticeHref}
            aria-label="공지 보기"
            className="flex h-10 items-center gap-2 rounded-lg bg-app-gap px-3"
          >
            <span className="shrink-0 text-[12px] font-bold text-app-text">공지</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-app-sub">{noticeTitle}</span>
            <svg className="h-3.5 w-3.5 shrink-0 text-app-caption" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        </div>

        {/* 2. 세그먼트: 실시간 TOP 토론 · 답 기다려요 N · 동네 · 랭킹 */}
        <section className="pt-4">
          <HorizontalRail className="gap-2 px-4" role="tablist" aria-label="하이라이트 탭">
            {HIGHLIGHT_TABS.map((tab) => {
              const active = highlightTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectHighlightTab(tab.id)}
                  className={highlightTabClass(active)}
                >
                  {tab.label}
                  {tab.id === "waiting" && unansweredCount > 0 ? (
                    <span
                      className={cn(
                        "text-[12px] font-bold tabular-nums",
                        active ? "text-orange-300" : "text-app-brand"
                      )}
                      data-testid="unanswered-count"
                    >
                      {unansweredCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </HorizontalRail>

          <div className="mt-3" role="tabpanel">
            {highlightTab === "hot" ? (
              <>
                {realtimeError && homeFeedData === undefined && !hotItems ? (
                  <QueryErrorState
                    title="실시간 토론을 불러오지 못했어요"
                    onRetry={() => void mutateRealtime()}
                    className="py-6"
                  />
                ) : !hotItems ? (
                  <RealtimeHotRailSkeleton />
                ) : hotItems.length > 0 ? (
                  <RealtimeHotRail
                    items={hotItems}
                    onOpen={(item, index) =>
                      trackEvent(ANALYTICS_EVENTS.postsHotDiscussionClicked, {
                        post_id: item.id,
                        post_title: item.title,
                        rank_index: index + 1,
                        comments_count: item.comments,
                      })
                    }
                  />
                ) : (
                  <div className="mx-4 rounded-xl bg-app-gap px-4 py-4">
                    <p className="text-[15px] font-semibold text-app-text">첫 토론을 열어 보세요</p>
                    <p className="mt-0.5 text-[13px] text-app-muted">
                      댓글이 달리면 바로 여기 맨 앞에 올라와요
                    </p>
                    <Link
                      href="/posts/upload"
                      className="mt-3 inline-flex h-9 items-center rounded-lg bg-app-inverse px-3.5 text-[14px] font-semibold text-app-inverse-text"
                    >
                      글쓰기
                    </Link>
                  </div>
                )}
                {awaitingQuestion ? (
                  <AwaitingAnswerCard question={awaitingQuestion} className="mx-4 mt-4" />
                ) : null}
              </>
            ) : highlightTab === "waiting" ? (
              awaitingQuestion ? (
                <AwaitingAnswerCard question={awaitingQuestion} className="mx-4" />
              ) : (
                <div className="mx-4 rounded-xl bg-app-gap px-4 py-4">
                  <p className="text-[15px] font-semibold text-app-text">모든 질문에 답이 달렸어요</p>
                  <p className="mt-0.5 text-[13px] text-app-muted">
                    궁금한 게 있으면 질문을 올려 보세요. 동네 {breeder}가 답해 줘요
                  </p>
                  <Link
                    href={`/posts/upload?category=${encodeURIComponent("질문")}`}
                    className="mt-3 inline-flex h-9 items-center rounded-lg bg-app-inverse px-3.5 text-[14px] font-semibold text-app-inverse-text"
                  >
                    질문하기
                  </Link>
                </div>
              )
            ) : highlightTab === "nearby" ? (
              !showRegionGate ? (
                <NearbyBreederList
                  data={nearbyData}
                  isError={Boolean(nearbyError)}
                  onRetry={() => void mutateNearby()}
                />
              ) : (
                <RegionGateCard />
              )
            ) : breedersError && !breedersData ? (
              <QueryErrorState
                title={`${breeder} 랭킹을 불러오지 못했어요`}
                onRetry={() => void mutateBreeders()}
                className="py-6"
              />
            ) : (
              <TopBreederList
                breeders={topBreeders}
                bloodlines={bloodlinesData?.items ?? []}
                scoped={!!scope.categoryPath}
                onOpen={(breeder, index) =>
                  trackEvent(ANALYTICS_EVENTS.postsBreederTabClicked, {
                    breeder_id: breeder.user.id,
                    breeder_name: breeder.user.name,
                    rank_index: index + 1,
                    score: breeder.score,
                  })
                }
              />
            )}
          </div>
        </section>

        {/* 3. 게시글 목록 제목(개수·'…으로 노출됩니다' 없음, §3.1) */}
        <section id="all-posts" className="px-4 pb-1 pt-7">
          <h2 className="app-t-section truncate">{listTitle}</h2>
          {regionScopeLabel ? (
            <p className="app-t-cap mt-0.5">{regionScopeLabel}</p>
          ) : null}
        </section>

        {/* 4. 카테고리 칩 + 종·정렬: 스크롤하면 헤더 바로 아래에 붙는다(§9, 틈 없음). */}
        <div className="sticky top-14 z-10 bg-app-bg" data-testid="posts-sticky-filters">
          <FilterChipRail className="h-[52px]">
            {TABS.map((tab) => (
              <FilterChip
                key={tab.id}
                label={tab.name}
                selected={selectedCategory === tab.id}
                onClick={() => handleCategoryChange(tab.id)}
              />
            ))}
          </FilterChipRail>
          <div className="flex items-center justify-end gap-2 px-4 pb-2">
            <PostFilterDropdown
              value={activeSpecies}
              onChange={handleSpeciesChange}
              ariaLabel="종 필터"
              options={speciesOptions}
            />
            <span className="text-[13px] text-app-caption" aria-hidden="true">
              ·
            </span>
            <PostFilterDropdown
              value={selectedSort}
              onChange={(v) => handleSortChange(v as SortType)}
              ariaLabel="정렬 기준"
              options={SORT_OPTIONS}
            />
          </div>
          <SubcategoryChipRow
            options={subSpeciesOptions}
            value={activeSubSpecies}
            onChange={setSelectedSubSpecies}
            className="-mt-1.5 mb-0.5"
          />
        </div>

        {/* 7. 게시글 목록 */}
        {isRegionCategory && showRegionGate ? (
          <RegionGateCard className="mt-2" from={`/posts?category=${encodeURIComponent(REGION_POST_CATEGORY)}`} />
        ) : showFollowingGate ? (
          <FollowingFeedCard variant="login" className="mt-2" />
        ) : isInitialLoading ? (
          <div>
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonPostRow key={i} />
            ))}
          </div>
        ) : listError && !data?.length ? (
          <QueryErrorState
            title="게시글을 불러오지 못했어요"
            onRetry={() => void mutateList()}
            className="py-[60px]"
          />
        ) : posts.length === 0 && !hasMore && isRegionCategory && myRegion ? (
          // 시/도까지 넓혀도 0건(앱 S-2.빈): 첫 인사를 유도한다.
          <div className="flex flex-col items-center px-4 py-7 text-center">
            <p className="break-keep text-[14px] text-app-muted">아직 {myRegion.sido} 동네 글이 없어요. 첫 인사를 남겨 보세요</p>
            <Link
              href={`/posts/upload?category=${encodeURIComponent(REGION_POST_CATEGORY)}`}
              className="mt-3.5 flex h-11 items-center justify-center rounded-md bg-app-surface px-5 text-[14px] font-semibold text-app-strong"
            >
              인사 남기기
            </Link>
          </div>
        ) : posts.length === 0 && !hasMore && isFollowingFilter ? (
          // 아무도 팔로우하지 않았으면 '브리더 찾기', 팔로우했는데 글이 없으면 다른 문구(구 서버는 followingCount 가 없다).
          <FollowingFeedCard
            variant={data?.[0]?.followingCount === 0 ? "noFollowing" : "noPosts"}
            className="mt-2"
          />
        ) : posts.length === 0 && !hasMore ? (
          <div className="bg-app-bg pt-5">
            <p className="px-4 text-[14px] text-app-muted">
              아직 올라온 글이 없어요. 질문과 정보 글을 먼저 올리면 대화가 더 빨리 시작돼요.
            </p>
            <div className="mt-3">
              {BACKUP_COMMUNITY_CONTENT.map((content) => (
                <Link
                  key={content.id}
                  href={content.href}
                  className="block border-b border-app-line px-4 py-3.5"
                >
                  <p className="text-[16px] font-medium text-app-text">{withBreederWord(content.title, breeder)}</p>
                  <p className="mt-1 truncate text-[14px] text-app-muted">{content.description}</p>
                  <p className="mt-2 text-[13px] font-semibold text-app-brand">{content.cta}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {data?.length ? (
          <RetryFooter
            loading={isLoadingMore}
            error={Boolean(listError)}
            onRetry={() => void mutateList()}
          />
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" />

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
      </div>
    </Layout>
  );
}
