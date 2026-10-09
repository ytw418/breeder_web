"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useInfiniteScroll } from "hooks/useInfiniteScroll";
import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath } from "hooks/useCategoryScope";
import useUser from "hooks/useUser";

import { cn, makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import { POST_CATEGORIES } from "@libs/constants";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { withoutBlocked } from "@libs/shared/blockFilter";
import { REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import { regionOf } from "@libs/shared/regions";
import type { PostsListResponse } from "pages/api/posts";
import type { NoticePostsResponse } from "pages/api/posts/notices";
import type { NearbyBreedersResponse } from "pages/api/users/nearby";
import type {
  BloodlineRankingItem,
  BreederRankingItem,
  HotDiscussionItem,
} from "@libs/shared/ranking";
import TopBreederList from "@components/features/post/TopBreederList";
import NearbyBreederList, { NEARBY_BREEDER_COUNT } from "@components/features/post/NearbyBreederList";
import RegionGateCard from "@components/features/region/RegionGateCard";
import { PostFilterDropdown } from "./_components/PostFilterDropdown";

/** 카테고리 칩 목록 */
const TABS = [{ id: "전체", name: "전체" }, ...POST_CATEGORIES];
const SORT_TABS = [
  { id: "latest", name: "최신순" },
  { id: "popular", name: "인기순" },
  { id: "comments", name: "댓글순" },
] as const;
type SortType = (typeof SORT_TABS)[number]["id"];
type HighlightTab = "hot" | "breeder" | "nearby";
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

/** 웹 .app-card (앱 makeCardStyles.appCard): r12 + 1px 테두리 + 카드 그림자(다크 없음). */
const APP_CARD = "rounded-xl border border-app-border bg-app-elevated shadow-card";

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-app-placeholder", className)} />;
}

/** HOT 토론 로딩 카드 3장(순위 32 · 제목 2줄 · 썸네일 56). */
function HotDiscussionSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 px-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn(APP_CARD, "flex items-start gap-3 p-3.5")}>
          <SkeletonBlock className="h-8 w-8 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
            <SkeletonBlock className="h-3.5 w-[90%]" />
            <SkeletonBlock className="h-3.5 w-[55%]" />
          </div>
          <SkeletonBlock className="h-14 w-14 rounded-xl" />
        </div>
      ))}
    </div>
  );
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

export default function PostsClient() {
  const [selectedCategory, setSelectedCategory] = useState("전체");
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

  // '동네' 칩·'우리 동네' 탭은 내 동네(시/도·시/군/구)가 있어야 한다(앱 posts.tsx). 없으면 RegionGateCard 로 안내하고 목록은 받지 않는다.
  const { user } = useUser();
  const myRegion = regionOf(user);
  const isRegionCategory = selectedCategory === REGION_POST_CATEGORY;

  /** region: 동네 글 필터. 시/도만 주면 시/도 전체, 시/군/구까지 주면 그 동네만. */
  const makeGetKey =
    (region: { sido: string; sigungu?: string } | null) =>
    (pageIndex: number, previousPageData: PostsListResponse | null) => {
      if (previousPageData && (!previousPageData.posts.length || pageIndex >= previousPageData.pages)) {
        return null;
      }
      const categoryParam =
        selectedCategory !== "전체" ? `&category=${encodeURIComponent(selectedCategory)}` : "";
      const sortParam = selectedSort !== "latest" ? `&sort=${selectedSort}` : "";
      const speciesParam = activeSpecies !== "전체" ? `&species=${activeSpecies}` : "";
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
    isRegionCategory && !myRegion ? () => null : makeGetKey(isRegionCategory ? myRegion : null)
  );
  const widenToSido = Boolean(
    isRegionCategory && myRegion && sigunguList.data && (sigunguList.data[0]?.posts.length ?? 0) === 0
  );
  const sidoList = useSWRInfinite<PostsListResponse>(
    widenToSido && myRegion ? makeGetKey({ sido: myRegion.sido }) : () => null
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
  // TOP 브리더: /ranking '전체' 기간과 같은 데이터(범위 포함). '혈통 부자' 키워드용으로 혈통 랭킹도 받는다.
  const {
    data: breedersData,
    error: breedersError,
    mutate: mutateBreeders,
  } = useSWR<{ success: boolean; items: BreederRankingItem[] }>(
    withCategoryPath("/api/rankings/breeders?limit=50&period=all", scope.categoryPath)
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
  const {
    data: homeFeedData,
    error: homeFeedError,
    mutate: mutateHomeFeed,
  } = useSWR<{ hotDiscussions: HotDiscussionItem[] }>(
    withCategoryPath("/api/home/feed?scope=public", scope.categoryPath),
    { revalidateOnFocus: false }
  );
  const page = useInfiniteScroll();

  useEffect(() => {
    setSize(page);
  }, [setSize, page]);

  const resetList = () => {
    setSize(1);
    window.scrollTo({ top: 0 });
  };

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
  const hotDiscussions = useMemo(
    () =>
      withoutBlocked(homeFeedData?.hotDiscussions ?? [], blockedIds, (item) => item.user?.id).slice(
        0,
        HOT_DISCUSSION_COUNT
      ),
    [homeFeedData, blockedIds]
  );
  const topBreeders = useMemo(
    () =>
      breedersData
        ? withoutBlocked(breedersData.items ?? [], blockedIds, (item) => item.user?.id)
        : undefined,
    [breedersData, blockedIds]
  );

  // 사용자가 직접 고르기 전까지, HOT 토론이 비어 있으면 TOP 브리더가 기본.
  const highlightTab: HighlightTab =
    pickedTab ?? (homeFeedData && hotDiscussions.length === 0 ? "breeder" : "hot");

  const noticePost = noticeData?.posts?.[0] ?? null;
  const noticeHref = noticePost ? toPostPath(noticePost.id, noticePost.title) : "/posts/notices";
  const noticeTitle = noticePost?.title ?? NOTICE_FALLBACK_TITLE;

  const listTitle = selectedCategory === "전체" ? "전체 게시글" : `${selectedCategory} 게시글`;
  const listHint = regionScopeLabel ? `${regionScopeLabel} · ` : "";
  const sortLabel = SORT_TABS.find((s) => s.id === selectedSort)?.name ?? "최신순";

  const lastPage = data?.[data.length - 1];
  const totalPages = data?.[0]?.pages ?? 0;
  const hasMore = Boolean(data && lastPage?.posts.length && data.length < totalPages);
  const isInitialLoading = !data && !listError;
  const isLoadingMore = Boolean(data && size > data.length && isValidating && !listError);

  const selectHighlightTab = (tab: HighlightTab) => {
    trackEvent(ANALYTICS_EVENTS.postsHighlightTabChanged, { tab });
    setPickedTab(tab);
  };

  const highlightTabClass = (tab: HighlightTab, active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-[13px] font-semibold leading-4 transition-colors",
      active
        ? tab === "hot"
          ? "bg-app-danger text-app-inverse-text"
          : tab === "nearby"
            ? // '우리 동네'(앱 posts.tsx HIGHLIGHT_TAB_COLORS.nearby): 브랜드 주황, 주황 위 글자는 흰색 고정.
              "bg-app-brand text-white"
            : "bg-app-warning text-app-inverse-text"
        : "bg-app-surface text-app-muted"
    );

  return (
    <Layout icon hasTabBar seoTitle="반려생활" showSearch>
      <div className="flex min-h-full flex-col bg-app-bg pb-20">
        {/* 1. 화면 제목 행 + '공지사항 더보기 ›' */}
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-[18px] font-bold text-app-text">반려생활</h1>
          <Link
            href="/posts/notices"
            className="-my-3.5 flex items-center gap-0.5 py-3.5 text-[13px] font-semibold text-app-muted"
          >
            공지사항 더보기
            <svg
              className="h-4 w-4 text-app-caption"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* 2. 공지 한 줄 */}
        <div className="px-4">
          <Link
            href={noticeHref}
            aria-label="공지 보기"
            className="flex h-11 items-center gap-2 rounded-lg bg-app-surface px-3"
          >
            <span className="shrink-0 rounded bg-app-elevated px-1.5 py-[3px] text-[12px] font-bold leading-4 text-app-text">
              공지
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-app-text">{noticeTitle}</span>
          </Link>
        </div>

        {/* 3. HOT 토론 / TOP 브리더 */}
        <section className="pb-2 pt-3.5">
          <div className="flex items-center gap-1 px-4" role="tablist" aria-label="하이라이트 탭">
            <button
              type="button"
              role="tab"
              aria-selected={highlightTab === "hot"}
              onClick={() => selectHighlightTab("hot")}
              className={highlightTabClass("hot", highlightTab === "hot")}
            >
              🔥 HOT 토론
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={highlightTab === "breeder"}
              onClick={() => selectHighlightTab("breeder")}
              className={highlightTabClass("breeder", highlightTab === "breeder")}
            >
              🏆 TOP 브리더
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={highlightTab === "nearby"}
              onClick={() => selectHighlightTab("nearby")}
              className={highlightTabClass("nearby", highlightTab === "nearby")}
            >
              📍 우리 동네
            </button>
          </div>

          <div className="mt-2" role="tabpanel">
            {highlightTab === "hot" ? (
              homeFeedError && !homeFeedData ? (
                <QueryErrorState
                  title="HOT 토론을 불러오지 못했어요"
                  onRetry={() => void mutateHomeFeed()}
                  className="py-6"
                />
              ) : !homeFeedData ? (
                <HotDiscussionSkeleton />
              ) : hotDiscussions.length > 0 ? (
                <div className="flex flex-col gap-2.5 px-4">
                  {hotDiscussions.map((item, index) => (
                    <Link
                      key={item.id}
                      href={toPostPath(item.id, item.title)}
                      onClick={() =>
                        trackEvent(ANALYTICS_EVENTS.postsHotDiscussionClicked, {
                          post_id: item.id,
                          post_title: item.title,
                          rank_index: index + 1,
                          comments_count: item.commentsCount,
                          wonder_count: item.wonderCount,
                        })
                      }
                      className={cn(APP_CARD, "flex items-start gap-3 p-3.5")}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-app-danger-soft text-[14px] font-black text-app-danger">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {item.category ? (
                            <span className="rounded-full bg-app-surface px-1.5 py-0.5 text-[11px] font-semibold leading-[11px] text-app-muted">
                              {item.category}
                            </span>
                          ) : null}
                          <span className="rounded-full bg-app-danger-soft px-1.5 py-0.5 text-[11px] font-semibold leading-[11px] text-app-danger">
                            HOT
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 break-keep text-[14px] font-semibold leading-5 text-app-strong">
                          {item.title}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-app-muted">
                          <span>{item.user.name}</span>
                          <span>댓글 {item.commentsCount}</span>
                          <span>좋아요 {item.wonderCount}</span>
                        </div>
                      </div>
                      {item.image ? (
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-app-placeholder">
                          <Image
                            src={makeImageUrl(item.image, "public")}
                            alt={item.title}
                            width={56}
                            height={56}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mx-4 flex flex-col items-center rounded-2xl border-2 border-dashed border-app-border bg-app-gap px-5 py-6">
                  <p className="text-2xl">💬</p>
                  <p className="mt-2 text-sm font-semibold text-app-sub">아직 HOT 토론이 없어요</p>
                  <p className="mt-1 text-xs text-app-muted">첫 번째 토론의 주인공이 되어보세요!</p>
                  <Link
                    href="/posts/upload"
                    className="mt-3 inline-flex items-center gap-1 rounded-full bg-app-danger px-4 py-2 text-xs font-semibold text-app-inverse-text"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    토론 만들기
                  </Link>
                </div>
              )
            ) : highlightTab === "nearby" ? (
              myRegion ? (
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
                title="브리더 랭킹을 불러오지 못했어요"
                onRetry={() => void mutateBreeders()}
                className="py-6"
              />
            ) : (
              <TopBreederList
                breeders={topBreeders}
                bloodlines={bloodlinesData?.items ?? []}
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

        {/* 섹션 사이 8px 회색 갭 */}
        <div className="h-2 bg-app-gap" />

        {/* 4. 게시글 목록 제목 + 개수 */}
        <section id="all-posts" className="flex items-end justify-between gap-3 px-4 pb-2 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[18px] font-bold leading-[22.5px] tracking-[-0.36px] text-app-text">
              {listTitle}
            </h2>
            <p className="mt-1 text-[12px] font-medium text-app-muted">
              {listHint}
              {sortLabel}으로 노출됩니다.
            </p>
          </div>
          {data && !(isRegionCategory && !myRegion) ? (
            <span className="rounded-full border border-app-border bg-app-bg px-2.5 py-1 text-[11px] font-semibold leading-[11px] text-app-muted">
              {posts.length}개
            </span>
          ) : null}
        </section>

        {/* 5. 카테고리 칩 1줄 */}
        <FilterChipRail>
          {TABS.map((tab) => (
            <FilterChip
              key={tab.id}
              label={tab.name}
              selected={selectedCategory === tab.id}
              onClick={() => handleCategoryChange(tab.id)}
            />
          ))}
        </FilterChipRail>

        {/* 6. 종 필터 + 정렬(우측 텍스트 드롭다운) */}
        <div className="flex items-center justify-end gap-2 px-4 pb-3 pt-1">
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

        {/* 7. 게시글 목록 */}
        {isRegionCategory && !myRegion ? (
          <RegionGateCard className="mt-2" />
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
            <p className="text-[14px] text-app-muted">아직 {myRegion.sido} 동네 글이 없어요. 첫 인사를 남겨 보세요</p>
            <Link
              href={`/posts/upload?category=${encodeURIComponent(REGION_POST_CATEGORY)}`}
              className="mt-3.5 flex h-11 items-center justify-center rounded-md bg-app-surface px-5 text-[14px] font-semibold text-app-strong"
            >
              인사 남기기
            </Link>
          </div>
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
                  <p className="text-[16px] font-medium text-app-text">{content.title}</p>
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
