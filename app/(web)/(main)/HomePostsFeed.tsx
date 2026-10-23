"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useScopeTerms from "@/hooks/useScopeTerms";
import { withBreederWord } from "@libs/shared/scopeTerms";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWRInfinite from "swr/infinite";

import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { ThreadPostCard, ThreadProductCard } from "@components/app/ThreadFeedCard";
import CoupangBanner from "@components/app/ads/CoupangBanner";
import { getCoupangWebConfig } from "@libs/client/adsConfig";
import { withAdRows } from "@libs/shared/ads/adRows";
import { HOME_SALE_FILTER, mixHomeFeed, productsNeeded } from "@libs/shared/homeFeedMix";
import type { ProductsResponse } from "@libs/shared/home";
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
import {
  OTHER_PETS_FEED_OPEN,
  OTHER_PETS_FEED_TITLE,
  otherPetsFeedSub,
  showsOtherPetsFeed,
} from "@libs/shared/petSpace";
import { FOLLOWING_POST_FILTER, REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import { regionOf } from "@libs/shared/regions";
import type { PostsListResponse } from "pages/api/posts";
import RegionGateCard from "@components/features/region/RegionGateCard";
import FollowingFeedCard from "@components/features/post/FollowingFeedCard";
import { LOUNGE_HREF } from "@components/features/home/NeighborhoodBreederSection";
import { PostFilterDropdown } from "../posts/_components/PostFilterDropdown";
import {
  FEED_LIST_PARAM,
  FEED_LIST_VALUE,
  FEED_RESTORE_PREFIX,
  type FeedRestore,
  feedQuery,
  parseFeedParams,
  readFeedRestore,
  withFeedQuery,
} from "@libs/client/feedUrlState";

// 피드에 분양글이 섞이므로 AdSense 대신 쿠팡 행(생물 거래 화면에 AdSense 를 두지 않는다, 앱 docs/prd/ads.md §10).
const FEED_ADS_ENABLED = Boolean(getCoupangWebConfig());
/** 분양글 한 번에 받는 수. '전체'는 게시글 3개마다 1개라 한 페이지(게시글 10)에 3~4개면 된다. */
const PRODUCT_PAGE_SIZE = 12;

/**
 * 카테고리 칩 목록. '팔로잉'은 내가 팔로우한 사람의 글, '분양'은 분양글만 보는 피드 필터다(카테고리 아님).
 * '분양'은 동네 다음(앱 docs/prd/home-v2.md S-1 4번).
 */
export const HOME_POST_TABS = [
  { id: "전체", name: "전체" },
  { id: FOLLOWING_POST_FILTER, name: FOLLOWING_POST_FILTER },
  ...POST_CATEGORIES.flatMap((category) =>
    category.id === REGION_POST_CATEGORY ? [category, { id: HOME_SALE_FILTER, name: HOME_SALE_FILTER }] : [category]
  ),
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

/** 쓰레드 피드 한 줄 스켈레톤(앱 ThreadFeedSkeleton). */
function SkeletonPostRow() {
  return (
    <div className="flex gap-3 p-4">
      <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
      <div className="flex-1">
        <SkeletonBlock className="h-3.5 w-24" />
        <SkeletonBlock className="mt-2 h-4 w-3/4" />
        <SkeletonBlock className="mt-2 h-3.5 w-full" />
        <SkeletonBlock className="mt-3 aspect-[4/3] w-full rounded-lg" />
      </div>
    </div>
  );
}

/**
 * 홈 '다른 아이들 소식' 머리(앱 docs/prd/pet-space.md §5.7, 앱 OtherPetsHeader): 8 갭 + 제목 16/700 + 안내 13.
 * 열기 전엔 아래에 '다른 분야 글 보기'(36 r8 회색 채움)를 두고, 눌러야 범위 밖 글을 받는다(onOpen).
 */
function OtherPetsHeader({
  scopedEmpty,
  open,
  onOpen,
}: {
  scopedEmpty: boolean;
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <section aria-label={OTHER_PETS_FEED_TITLE} data-testid="other-pets-header">
      <div className="h-2 bg-app-gap" aria-hidden="true" />
      <div className={cn("px-4 pt-5", open ? "pb-1" : "pb-6")}>
        <h2 className="text-[16px] font-bold leading-[22px] text-app-text">{OTHER_PETS_FEED_TITLE}</h2>
        <p className="mt-0.5 break-keep text-[13px] leading-[18px] text-app-muted">
          {otherPetsFeedSub(scopedEmpty)}
        </p>
        {open ? null : (
          <button
            type="button"
            onClick={onOpen}
            // 보이는 36 그대로 누르는 칸만 위아래 4씩 늘려 44(강아지·고양이 칩과 같다).
            className="relative mt-3 h-9 rounded-lg bg-app-surface px-3.5 text-[14px] font-semibold text-app-text after:absolute after:inset-x-0 after:-inset-y-1"
          >
            {OTHER_PETS_FEED_OPEN}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * 홈 아래 '전체 게시글'(docs/prd/home-ia.md S-1 9번, 2026-10-15 홈 구성 A안 — 옛 반려생활 탭의 글 목록).
 * 목록 제목 → 칩 + 종·정렬(스크롤하면 헤더 바로 아래 붙음) → 글 목록(무한 스크롤).
 * 칩·정렬·종·소분류는 주소 쿼리(`?category=&sort=&species=&sub=`, libs/client/feedUrlState.ts)에 두고 지우지 않는다.
 * 글을 보고 뒤로 오면 같은 필터로 열리고, 불러온 페이지 수·스크롤은 sessionStorage 로 되살린다(10분, 2026-10-21 감사 11번).
 * 밖에서 `&at=list` 를 붙여 들어오면(홈 '동네 글', 옛 /posts 링크의 리다이렉트) 목록 제목으로 스크롤하고 at 만 지운다.
 * useSearchParams 를 쓰므로 부모가 Suspense 로 감싼다.
 */
export default function HomePostsFeed() {
  const { breeder } = useScopeTerms();
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() ?? "";
  // 첫 값은 주소에서 읽는다(글을 보고 뒤로 오면 같은 칩·정렬·종으로 연다).
  const [initialFeed] = useState(() => parseFeedParams(searchParams));
  const [selectedCategory, setSelectedCategory] = useState(initialFeed.category);
  const [selectedSort, setSelectedSort] = useState<SortType>(initialFeed.sort);
  const [selectedSpecies, setSelectedSpecies] = useState(initialFeed.species);
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
  const [selectedSubSpecies, setSelectedSubSpecies] = useState(initialFeed.sub);
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
  // '분양' 칩은 분양글만, '전체'는 게시글 3개마다 분양글 하나를 섞는다(libs/shared/homeFeedMix).
  const isSaleFilter = selectedCategory === HOME_SALE_FILTER;
  const mixProducts = selectedCategory === "전체";
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
    (isRegionCategory && !myRegion) || (isFollowingFilter && !user) || isSaleFilter
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
  const postList = widenToSido ? sidoList : sigunguList;
  const data = postList.data;

  // 분양글: '분양' 칩이면 목록 자체, '전체'면 섞을 분양글(최신순). 종 필터는 같이 건다.
  const productList = useSWRInfinite<ProductsResponse>(
    (pageIndex: number, previous: ProductsResponse | null) => {
      if (!isSaleFilter && !mixProducts) return null;
      if (previous && pageIndex >= (previous.pages ?? 0)) return null;
      const speciesParam = speciesQuery ? `&category=${encodeURIComponent(speciesQuery)}` : "";
      const sortParam = isSaleFilter && selectedSort === "popular" ? "&sort=popular" : "";
      return withCategoryPath(
        `/api/products?page=${pageIndex + 1}&size=${PRODUCT_PAGE_SIZE}${speciesParam}${sortParam}`,
        scope.categoryPath
      );
    },
    { revalidateFirstPage: false, revalidateOnFocus: false }
  );
  const products = useMemo(() => {
    const seen = new Set<number>();
    const all = (productList.data ?? []).flatMap((page) => page?.products ?? []).filter((product) => {
      if (seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    });
    return withoutBlocked(all, blockedIds, (product) => product.userId);
  }, [productList.data, blockedIds]);
  const productPages = productList.data?.length ?? 0;
  const productTotalPages = productList.data?.[productPages - 1]?.pages ?? 0;
  const productHasMore = productPages > 0 && productPages < productTotalPages;

  // 지금 목록(분양 칩이면 분양글, 아니면 게시글)의 페이지·오류·다시 받기.
  const primary = isSaleFilter ? productList : postList;
  const { error: listError, size, setSize, isValidating, mutate: mutateList } = primary;
  const primaryPages = primary.data?.length ?? 0;
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

  // 지금 필터의 주소 쿼리. 범위 밖으로 나간 종·소분류는 화면과 같이 '전체'로 쓴다.
  const feedQs = feedQuery({
    category: selectedCategory,
    sort: selectedSort,
    species: activeSpecies,
    sub: activeSubSpecies,
  });
  // 글을 보고 돌아왔을 때 되살릴 페이지 수·스크롤(첫 마운트에만 읽는다). 되살리는 동안엔 새로 저장하지 않는다.
  const pendingRestore = useRef<FeedRestore | null>(null);
  const restoreChecked = useRef(false);

  // 주소 → 화면. 첫 마운트와, 홈에 있는 채로 '동네 글'(?category=동네&at=list) 같은 링크를 눌렀을 때 맞춘다.
  // 내가 쓴 주소면 값이 같아 아무것도 바뀌지 않는다.
  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const fromUrl = parseFeedParams(params);
    setSelectedCategory(fromUrl.category);
    setSelectedSort(fromUrl.sort);
    setSelectedSpecies(fromUrl.species);
    setSelectedSubSpecies(fromUrl.sub);
    const toList = params.get(FEED_LIST_PARAM) === FEED_LIST_VALUE;
    if (!restoreChecked.current) {
      restoreChecked.current = true;
      if (!toList) {
        try {
          pendingRestore.current = readFeedRestore(
            window.sessionStorage.getItem(FEED_RESTORE_PREFIX + feedQuery(fromUrl)),
            Date.now()
          );
        } catch {
          pendingRestore.current = null;
        }
        // setSize 는 같은 크기로 불러도 1페이지를 다시 받으므로 더 많이 받아야 할 때만 부른다.
        if (pendingRestore.current && pendingRestore.current.size > size) void setSize(pendingRestore.current.size);
      }
    }
    if (toList) {
      // at=list 는 한 번만 쓰는 표시라 읽은 뒤 지운다(필터 값은 남긴다).
      window.history.replaceState(null, "", withFeedQuery(searchKey, feedQuery(fromUrl)));
      if (size !== 1) void setSize(1);
      scrollToList();
    }
    // searchKey 가 바뀔 때만 맞춘다(setSize·scrollToList 는 바뀌지 않는다).
  }, [searchKey]);

  // 화면 → 주소. 필터를 바꾸면 주소 쿼리만 바꾼다(스크롤·기록 쌓기 없음). 다른 쿼리(utm 등)는 남긴다.
  useEffect(() => {
    if (feedQuery(parseFeedParams(new URLSearchParams(searchKey))) === feedQs) return;
    window.history.replaceState(null, "", withFeedQuery(searchKey, feedQs));
    // searchKey 는 비교용이다. 필터가 바뀔 때만 쓴다.
  }, [feedQs]);

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

  const listTitle =
    selectedCategory === "전체" ? "전체 게시글" : isSaleFilter ? "분양글" : `${selectedCategory} 게시글`;

  const lastPage = data?.[data.length - 1];
  const totalPages = data?.[0]?.pages ?? 0;
  const postsHasMore = Boolean(data && lastPage?.posts.length && data.length < totalPages);
  const hasMore = isSaleFilter ? productHasMore : postsHasMore;
  const isInitialLoading = !primary.data && !listError;
  const isLoadingMore = Boolean(primaryPages && size > primaryPages && isValidating && !listError);
  const loadedPages = primaryPages;

  // 피드 행: '분양'이면 분양글만, '전체'면 게시글 3개마다 분양글 하나, 그 밖의 칩은 게시글만.
  const rows = useMemo(
    () =>
      isSaleFilter
        ? products.map((product) => ({ kind: "product" as const, product }))
        : mixHomeFeed(posts, mixProducts ? products : [], { postsDone: !postsHasMore }),
    [isSaleFilter, mixProducts, products, posts, postsHasMore]
  );
  // '전체': 게시글이 늘어 섞을 분양글이 모자라면 분양글 다음 페이지를 받는다.
  const needMoreProducts =
    mixProducts && productHasMore && !productList.isValidating && products.length < productsNeeded(posts.length);
  useEffect(() => {
    if (needMoreProducts) void productList.setSize(productPages + 1);
  }, [needMoreProducts, productPages]);

  // 홈 '다른 아이들 소식'(앱 docs/prd/pet-space.md §5.7): 관심 분야를 고정했고 '전체'·전체 종에서 고정 범위 글을
  // 끝까지 받았으면 아래에 머리를 두고, '다른 분야 글 보기'를 눌러야 범위 밖 게시글을 이어 받는다(분양글은 섞지 않는다,
  // 2026-10-24 코덱스 기획 리뷰). 연 것은 그 관심 분야에서만 기억한다. 이미 보인 글은 id 로 거른다
  // (옛 서버는 outsideCategoryPath 를 몰라 전체 글을 준다).
  const showOtherPets = showsOtherPetsFeed({
    categoryPath: scope.categoryPath,
    allChip: selectedCategory === "전체",
    allSpecies: !speciesQuery,
    scopedDone: Boolean(primaryPages) && !hasMore && !listError,
  });
  const [otherOpenFor, setOtherOpenFor] = useState<string | null>(null);
  const otherOpen = Boolean(scope.categoryPath) && otherOpenFor === scope.categoryPath;
  const loadOther = showOtherPets && otherOpen;
  const otherList = useSWRInfinite<PostsListResponse>(
    (pageIndex: number, previous: PostsListResponse | null) => {
      if (!loadOther || !scope.categoryPath) return null;
      if (previous && (!previous.posts.length || pageIndex >= previous.pages)) return null;
      const sortParam = selectedSort !== "latest" ? `&sort=${selectedSort}` : "";
      return `/api/posts?page=${pageIndex + 1}${sortParam}&outsideCategoryPath=${encodeURIComponent(scope.categoryPath)}`;
    },
    { revalidateFirstPage: false, revalidateOnFocus: false }
  );
  const {
    data: otherData,
    error: otherError,
    size: otherSize,
    setSize: setOtherSize,
    isValidating: otherValidating,
    mutate: mutateOther,
  } = otherList;
  const otherPosts = useMemo(() => {
    const seen = new Set(posts.map((post) => post.id));
    const all = (otherData ?? []).flatMap((page) => page?.posts ?? []).filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
    return withoutBlocked(all, blockedIds, (post) => post.user?.id);
  }, [otherData, posts, blockedIds]);
  const otherPages = otherData?.length ?? 0;
  const otherHasMore = Boolean(
    otherData?.[otherPages - 1]?.posts.length && otherPages < (otherData?.[0]?.pages ?? 0)
  );
  const otherLoading = loadOther && !otherError && otherValidating && otherSize > otherPages;
  const scopedEmpty = rows.length === 0;
  const otherRows = useMemo(
    () => (loadOther ? otherPosts.map((post) => ({ kind: "post" as const, post })) : []),
    [loadOther, otherPosts]
  );
  // 머리가 처음 보일 때(고정 범위가 얼마나 빨리 바닥나는지)와 '다른 분야 글 보기'를 누를 때 센다(앱 docs/prd/pet-space.md §10).
  const otherTracked = useRef(false);
  useEffect(() => {
    if (!showOtherPets || otherTracked.current) return;
    otherTracked.current = true;
    trackEvent(ANALYTICS_EVENTS.otherPetsFeedView, { scoped_empty: scopedEmpty });
  }, [showOtherPets, scopedEmpty]);
  const openOtherPets = () => {
    if (!scope.categoryPath) return;
    setOtherOpenFor(scope.categoryPath);
    trackEvent(ANALYTICS_EVENTS.otherPetsFeedOpen, { scoped_empty: scopedEmpty });
  };
  const otherSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = otherSentinelRef.current;
    if (!target || !loadOther || !otherHasMore || otherError) return;
    const observer = new IntersectionObserver(
      (entries, self) => {
        if (!entries[0]?.isIntersecting || otherValidating) return;
        self.disconnect();
        void setOtherSize(otherPages + 1);
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadOther, otherHasMore, otherError, otherValidating, otherPages, setOtherSize]);

  // 피드 행 그리기. 8행마다 쿠팡 한 줄(앱 홈 네이티브 광고와 같은 간격). 슬롯 번호가 위치로 정해져 다음 페이지가 붙어도 그대로다.
  // '다른 아이들 소식' 머리는 광고 간격에 세지 않고 고정 범위 마지막 글 바로 뒤에 둔다(열기 전후로 자리가 그대로다).
  // 그 자리에 올 광고(고정 범위 글이 8의 배수로 끝날 때)는 빼서 머리 아래 첫 줄이 늘 범위 밖 첫 글이다.
  type FeedListRow = (typeof rows)[number] | (typeof otherRows)[number];
  const renderFeedRows = (scoped: readonly FeedListRow[], other: readonly FeedListRow[]) => {
    const withAds = withAdRows<FeedListRow>([...scoped, ...other], FEED_ADS_ENABLED);
    const lastScoped = scoped[scoped.length - 1];
    const headerAt = lastScoped ? withAds.indexOf(lastScoped) + 1 : 0;
    const list =
      showOtherPets && withAds[headerAt]?.kind === "ad"
        ? [...withAds.slice(0, headerAt), ...withAds.slice(headerAt + 1)]
        : withAds;
    const nodes = list.map((row) =>
      row.kind === "ad" ? (
        <CoupangBanner key={`ad-${row.slot}`} variant="row" />
      ) : row.kind === "product" ? (
        <ThreadProductCard key={`product-${row.product.id}`} product={row.product} />
      ) : (
        <ThreadPostCard key={row.post.id} post={row.post} />
      )
    );
    if (showOtherPets) {
      nodes.splice(
        headerAt,
        0,
        <OtherPetsHeader key="other-header" scopedEmpty={scopedEmpty} open={otherOpen} onOpen={openOtherPets} />
      );
    }
    return nodes;
  };

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

  // 글을 보고 돌아왔으면 저장한 페이지 수만큼 받은 뒤 그 스크롤로 내려간다.
  useEffect(() => {
    const saved = pendingRestore.current;
    if (!saved) return;
    if (!primaryPages) {
      // 첫 페이지부터 못 받았으면 되살리지 않고 저장을 다시 시작한다.
      if (listError) pendingRestore.current = null;
      return;
    }
    if (primaryPages < saved.size && hasMore && !listError) return;
    pendingRestore.current = null;
    window.requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
  }, [primaryPages, hasMore, listError]);

  // 스크롤·페이지 수가 바뀌면 300ms 뒤 지금 필터 주소를 키로 저장한다. 화면을 떠날 때 남은 저장은 바로 쓴다.
  useEffect(() => {
    const key = FEED_RESTORE_PREFIX + feedQs;
    let timer: number | undefined;
    let lastY = 0;
    const write = () => {
      timer = undefined;
      if (pendingRestore.current) return;
      try {
        const value: FeedRestore = { size: Math.max(loadedPages, 1), scrollY: Math.round(lastY), at: Date.now() };
        window.sessionStorage.setItem(key, JSON.stringify(value));
      } catch {
        // 저장 공간이 없거나 막혀 있으면 되살리기만 못 한다.
      }
    };
    const schedule = () => {
      // 글로 넘어가며 새 화면이 맨 위로 올리는 스크롤은 홈 스크롤이 아니다(주소가 이미 바뀌어 있다).
      if (window.location.pathname !== "/") return;
      lastY = window.scrollY;
      window.clearTimeout(timer);
      timer = window.setTimeout(write, 300);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        write();
      }
    };
  }, [feedQs, loadedPages]);

  return (
    <>
      {/* 목록 자리(제목 글자는 화면 읽기용만, 시안 C — 8dp 갭 바로 아래 칩). 헤더(56) 아래로 스크롤해 오도록 scroll-margin. */}
      <section id="all-posts" ref={titleRef} data-home-section="posts_feed" className="scroll-mt-14">
        <h2 className="sr-only">{listTitle}</h2>
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
        {regionScopeLabel ? <p className="app-t-cap px-4 pb-2">{regionScopeLabel} 동네 글</p> : null}
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
      ) : listError && !primaryPages ? (
        <QueryErrorState
          title="게시글을 불러오지 못했어요"
          onRetry={() => void mutateList()}
          className="py-[60px]"
        />
      ) : isSaleFilter && products.length === 0 && !hasMore ? (
        <div className="flex flex-col items-center px-4 py-7 text-center">
          <p className="break-keep text-[14px] text-app-muted">아직 올라온 분양글이 없어요</p>
          <Link
            href="/products/upload"
            className="mt-3.5 flex h-10 items-center justify-center rounded-lg bg-app-surface px-4 text-[14px] font-semibold text-app-strong"
          >
            분양글 올리기
          </Link>
        </div>
      ) : rows.length === 0 && !hasMore && isRegionCategory && myRegion ? (
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
      ) : rows.length === 0 && !hasMore && isFollowingFilter ? (
        // 아무도 팔로우하지 않았으면 '브리더 찾기', 팔로우했는데 글이 없으면 다른 문구(구 서버는 followingCount 가 없다).
        <FollowingFeedCard
          variant={data?.[0]?.followingCount === 0 ? "noFollowing" : "noPosts"}
          className="mt-2"
        />
      ) : rows.length === 0 && !hasMore ? (
        <>
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
          {/* 고정 범위 글이 없어도 '다른 분야 글 보기'로 다른 아이들 글을 열 수 있다(앱 docs/prd/pet-space.md §5.7). */}
          {showOtherPets ? <div>{renderFeedRows([], otherRows)}</div> : null}
        </>
      ) : (
        <div>{renderFeedRows(rows, otherRows)}</div>
      )}

      {primaryPages ? (
        <RetryFooter
          loading={isLoadingMore}
          error={Boolean(listError)}
          onRetry={() => void mutateList()}
        />
      ) : null}
      <div ref={sentinelRef} aria-hidden="true" />
      {loadOther ? (
        <>
          <RetryFooter loading={otherLoading} error={Boolean(otherError)} onRetry={() => void mutateOther()} />
          <div ref={otherSentinelRef} aria-hidden="true" />
        </>
      ) : null}
    </>
  );
}
