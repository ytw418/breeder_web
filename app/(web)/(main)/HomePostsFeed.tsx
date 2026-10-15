"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useScopeTerms from "@/hooks/useScopeTerms";
import { withBreederWord } from "@libs/shared/scopeTerms";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWRInfinite from "swr/infinite";

import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { PostCard } from "@components/app/PostCard";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath } from "hooks/useCategoryScope";
import useUser from "hooks/useUser";

import { cn } from "@libs/client/utils";
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
import RegionGateCard from "@components/features/region/RegionGateCard";
import FollowingFeedCard from "@components/features/post/FollowingFeedCard";
import { LOUNGE_HREF } from "@components/features/home/NeighborhoodBreederSection";
import { PostFilterDropdown } from "../posts/_components/PostFilterDropdown";

/** 카테고리 칩 목록. '팔로잉'은 카테고리가 아니라 내가 팔로우한 사람의 글 필터다(앱 (tabs)/index.tsx). */
export const HOME_POST_TABS = [
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

const SPECIES_OPTIONS = [
  { value: "전체", label: "전체 종" },
  ...TOP_LEVEL_CATEGORIES.map((s) => ({ value: s.id, label: s.name })),
];
const SORT_OPTIONS = SORT_TABS.map((s) => ({ value: s.id, label: s.name }));


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

/**
 * 홈 아래 '전체 게시글'(docs/prd/home-ia.md S-1 9번, 2026-10-15 홈 구성 A안 — 옛 반려생활 탭의 글 목록).
 * 목록 제목 → 칩 + 종·정렬(스크롤하면 헤더 바로 아래 붙음) → 글 목록(무한 스크롤).
 * ?category=동네 로 들어오면(홈 '동네 사랑방', 옛 /posts 링크의 리다이렉트) 그 칩을 고르고 목록 제목으로 스크롤한 뒤 주소에서 지운다.
 * useSearchParams 를 쓰므로 부모가 Suspense 로 감싼다.
 */
export default function HomePostsFeed() {
  const { breeder } = useScopeTerms();
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedSort, setSelectedSort] = useState<SortType>("latest");
  const [selectedSpecies, setSelectedSpecies] = useState("전체");
  const { blockedIds } = useBlocks();
  // 관심 카테고리 고정 범위(앱 category-pin). 목록이 같은 범위를 쓴다.
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

  // '동네' 칩은 내 동네(시/도·시/군/구)가 있어야 한다. 없으면 RegionGateCard 로 안내하고 목록은 받지 않는다.
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLElement>(null);

  // 목록 제목을 헤더 바로 아래로(칩을 바꾸면 그 자리에서 목록을 처음부터 본다).
  const scrollToList = useCallback(() => {
    const title = titleRef.current;
    if (!title) return;
    // 위 섹션(사진 레일·동네·TOP 브리더)이 늦게 그려지며 제목을 밀 수 있어 한 번 더 맞춘다.
    title.scrollIntoView?.({ block: "start" });
    window.setTimeout(() => titleRef.current?.scrollIntoView?.({ block: "start" }), 600);
  }, []);
  const resetList = () => {
    setSize(1);
    scrollToList();
  };

  // ?category=동네 로 들어오면 그 칩을 고르고 목록으로 스크롤한 뒤 주소에서 지운다(앱 홈 category 파라미터와 같다).
  const searchParams = useSearchParams();
  const categoryParam = searchParams?.get("category") ?? null;
  useEffect(() => {
    if (!categoryParam) return;
    if (HOME_POST_TABS.some((tab) => tab.id === categoryParam)) setSelectedCategory(categoryParam);
    window.history.replaceState(null, "", "/");
    scrollToList();
  }, [categoryParam, scrollToList]);

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

  return (
    <>
      {/* 목록 제목(개수·'…으로 노출됩니다' 없음). 헤더(56) 아래로 스크롤해 오도록 scroll-margin. */}
      <section
        id="all-posts"
        ref={titleRef}
        data-home-section="posts_feed"
        className="scroll-mt-14 px-4 pb-1 pt-6"
      >
        <h2 className="app-t-section truncate">{listTitle}</h2>
        {regionScopeLabel ? <p className="app-t-cap mt-0.5">{regionScopeLabel}</p> : null}
      </section>

      {/* 카테고리 칩 + 종·정렬: 스크롤하면 헤더 바로 아래에 붙는다(틈 없음). */}
      <div className="sticky top-14 z-10 bg-app-bg" data-testid="posts-sticky-filters">
        <FilterChipRail className="h-[52px]">
          {HOME_POST_TABS.map((tab) => (
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

      {/* 게시글 목록 */}
      {isRegionCategory && showRegionGate ? (
        <RegionGateCard className="mt-2" from={LOUNGE_HREF} />
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
    </>
  );
}
