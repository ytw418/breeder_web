"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import useSWRInfinite from "swr/infinite";

import Layout from "@components/features/MainLayout";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { ThreadPostCard } from "@components/app/ThreadFeedCard";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import RegionGateCard from "@components/features/region/RegionGateCard";
import UnderlineTabs from "@components/features/profile/UnderlineTabs";
import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath } from "hooks/useCategoryScope";
import useUser from "hooks/useUser";
import {
  ALL_POSTS_ALL_CATEGORY,
  ALL_POSTS_CATEGORIES,
  ALL_POSTS_SORTS,
  allPostsHref,
  parseAllPostsParams,
  type AllPostsFilter,
  type AllPostsSort,
} from "@libs/shared/allPostsFilter";
import { withoutBlocked } from "@libs/shared/blockFilter";
import { REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import { regionOf } from "@libs/shared/regions";
import type { PostsListResponse } from "pages/api/posts";

const SORT_TABS = ALL_POSTS_SORTS.map((sort) => ({ id: sort.id, label: sort.label }));

/** 홈 쓰레드식 피드 한 줄 스켈레톤(HomePostsFeed 와 같은 모양). */
function SkeletonPostRow() {
  return (
    <div className="flex gap-3 p-4" aria-hidden="true">
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-app-placeholder" />
      <div className="flex-1">
        <div className="h-3.5 w-24 animate-pulse rounded bg-app-placeholder" />
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-app-placeholder" />
        <div className="mt-2 h-3.5 w-full animate-pulse rounded bg-app-placeholder" />
        <div className="mt-3 aspect-[4/3] w-full animate-pulse rounded-lg bg-app-placeholder" />
      </div>
    </div>
  );
}

/**
 * 게시글 전체보기(홈 인기글 TOP 10 오른쪽 '전체보기 ›' → /posts/all?sort=popular). 앱 src/app/posts/all.tsx 와 같다.
 * 머리 '게시글'(뒤로) → 카테고리 칩(전체·정보·자유·질문·자랑·후기·사진·토론·동네·변이) → 인기순·댓글순·최신순 밑줄 탭 → 글 목록(무한 스크롤).
 * 목록은 홈 '전체 게시글'과 같은 카드(ThreadPostCard)·같은 `/api/posts` 쿼리이고 관심 카테고리 고정 범위를 따른다
 * ('동네' 칩은 홈과 같이 내 동네가 있어야 한다). 필터는 주소 쿼리에 두고(libs/shared/allPostsFilter.ts), 글을 보고 뒤로 오면 같은 필터로 열린다.
 */
export default function AllPostsClient() {
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() ?? "";
  const filter = parseAllPostsParams(searchParams);
  const { category, sort } = filter;

  const { blockedIds } = useBlocks();
  const scope = useCategoryScope();
  const { user, isLoading: userLoading } = useUser();
  const myRegion = regionOf(user);
  const isRegionCategory = category === REGION_POST_CATEGORY;
  // 계정을 받는 중에는 안내 카드 대신 스켈레톤을 둔다(홈과 같다).
  const showRegionGate = isRegionCategory && !myRegion && !userLoading;

  /** region: 동네 글 필터. 시/도만 주면 시/도 전체, 시/군/구까지 주면 그 동네만. */
  const makeGetKey =
    (region: { sido: string; sigungu?: string } | null) =>
    (pageIndex: number, previousPageData: PostsListResponse | null) => {
      if (previousPageData && (!previousPageData.posts.length || pageIndex >= previousPageData.pages)) return null;
      const categoryParam =
        category !== ALL_POSTS_ALL_CATEGORY ? `&category=${encodeURIComponent(category)}` : "";
      const sortParam = sort !== "latest" ? `&sort=${sort}` : "";
      const regionParam = region
        ? `&regionSido=${encodeURIComponent(region.sido)}${
            region.sigungu ? `&regionSigungu=${encodeURIComponent(region.sigungu)}` : ""
          }`
        : "";
      return withCategoryPath(
        `/api/posts?page=${pageIndex + 1}${categoryParam}${sortParam}${regionParam}`,
        scope.categoryPath
      );
    };

  // 동네 글은 먼저 시/군/구로 받고, 1페이지가 0건이면 시/도 전체로 넓혀 다시 받는다(홈과 같다).
  const sigunguList = useSWRInfinite<PostsListResponse>(
    isRegionCategory && !myRegion ? () => null : makeGetKey(isRegionCategory ? myRegion : null),
    { revalidateFirstPage: false }
  );
  const widenToSido = Boolean(
    isRegionCategory && myRegion && sigunguList.data && (sigunguList.data[0]?.posts.length ?? 0) === 0
  );
  const sidoList = useSWRInfinite<PostsListResponse>(
    widenToSido && myRegion ? makeGetKey({ sido: myRegion.sido }) : () => null,
    { revalidateFirstPage: false }
  );
  const list = widenToSido ? sidoList : sigunguList;
  const { data, error, size, setSize, isValidating, mutate } = list;

  // 페이지 사이에 새 글이 끼면 같은 글이 다음 페이지에 또 올 수 있어 id 로 거른다. 공개 캐시라 차단도 여기서 거른다.
  const posts = useMemo(() => {
    const seen = new Set<number>();
    const all = (data ?? []).flatMap((page) => page?.posts ?? []).filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
    return withoutBlocked(all, blockedIds, (post) => post.user?.id);
  }, [data, blockedIds]);

  const loadedPages = data?.length ?? 0;
  const totalPages = data?.[0]?.pages ?? 0;
  const hasMore = Boolean(data?.[loadedPages - 1]?.posts.length) && loadedPages < totalPages;
  const isInitialLoading = !data && !error;

  // 바닥 감시 칸이 보이면 다음 페이지 하나만 받는다(홈과 같다).
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || error) return;
    const observer = new IntersectionObserver(
      (entries, self) => {
        if (!entries[0]?.isIntersecting || isValidating) return;
        self.disconnect();
        void setSize(loadedPages + 1);
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, error, isValidating, loadedPages, setSize]);

  // 주소로 바로 들어온 카테고리 칩이 줄 끝에 있으면 보이는 곳으로 가져온다(가로 스크롤만).
  const filtersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (category === ALL_POSTS_ALL_CATEGORY) return;
    filtersRef.current
      ?.querySelector<HTMLElement>('button[aria-pressed="true"]')
      ?.scrollIntoView?.({ inline: "center", block: "nearest" });
    // 처음 열 때만 맞춘다. 칩을 눌러 바꿀 때는 이미 보이는 칩이다.
  }, []);

  // 화면 → 주소. 쿼리만 바꾼다(기록 쌓기·서버 왕복 없음, Next 가 useSearchParams 에 반영). 다른 쿼리(utm 등)는 남긴다.
  const changeFilter = (next: AllPostsFilter) => {
    if (next.category === category && next.sort === sort) return;
    window.history.replaceState(null, "", allPostsHref(next, searchKey));
    void setSize(1);
    window.scrollTo({ top: 0 });
  };

  return (
    <Layout canGoBack title="게시글" seoTitle="게시글">
      <div className="min-h-full bg-app-bg pb-4">
        {/* 카테고리 칩 + 정렬 탭: 스크롤하면 헤더 바로 아래에 붙는다. */}
        <div ref={filtersRef} className="sticky top-14 z-10 bg-app-bg" data-testid="all-posts-filters">
          <FilterChipRail className="h-[52px] pr-2" scrollHint>
            {ALL_POSTS_CATEGORIES.map((id) => (
              <FilterChip
                key={id}
                label={id}
                selected={category === id}
                onClick={() => changeFilter({ category: id, sort })}
              />
            ))}
          </FilterChipRail>
          <UnderlineTabs<AllPostsSort>
            tabs={SORT_TABS}
            active={sort}
            onChange={(id) => changeFilter({ category, sort: id })}
          />
        </div>

        {showRegionGate ? (
          <RegionGateCard className="mt-2" from={allPostsHref({ category, sort })} />
        ) : isInitialLoading ? (
          <div>
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonPostRow key={i} />
            ))}
          </div>
        ) : error && !loadedPages ? (
          <QueryErrorState title="게시글을 불러오지 못했어요" onRetry={() => void mutate()} className="py-[60px]" />
        ) : posts.length === 0 && !hasMore ? (
          <p className="px-4 py-[72px] text-center text-[14px] text-app-muted">아직 글이 없어요</p>
        ) : (
          <div>
            {posts.map((post) => (
              <ThreadPostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {loadedPages ? (
          <RetryFooter
            loading={Boolean(size > loadedPages && isValidating && !error)}
            error={Boolean(error)}
            onRetry={() => void mutate()}
          />
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>
    </Layout>
  );
}
