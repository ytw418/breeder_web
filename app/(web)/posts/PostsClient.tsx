"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "@components/atoms/Image";
import {
  BreederProgramBadgeList,
  getBreederProgramFrameClassName,
  hasBreederProgramFrame,
} from "@components/features/breeder/BreederProgramDecorators";
import useSWR from "swr";

import Layout from "@components/features/MainLayout";
import FloatingButton from "@components/atoms/floating-button";
import useSWRInfinite from "swr/infinite";
import { useInfiniteScroll } from "hooks/useInfiniteScroll";

import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import { POST_CATEGORIES } from "@libs/constants";
import { PostsListResponse } from "pages/api/posts";
import { TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { NoticePostsResponse } from "pages/api/posts/notices";
import { RankingResponse } from "pages/api/ranking";
import { HotDiscussionItem } from "@libs/shared/ranking";

/** 카테고리 탭 목록 */
const TABS = [{ id: "전체", name: "전체" }, ...POST_CATEGORIES];
const SORT_TABS = [
  { id: "latest", name: "최신순" },
  { id: "popular", name: "인기순" },
  { id: "comments", name: "댓글순" },
];
type SortType = (typeof SORT_TABS)[number]["id"];

const CATEGORY_ACCENT: Record<string, string> = {
  전체: "bg-slate-500",
  자유: "bg-emerald-500",
  질문: "bg-blue-500",
  정보: "bg-amber-500",
  자랑: "bg-pink-500",
  후기: "bg-violet-500",
  사진: "bg-cyan-500",
  변이: "bg-rose-500",
};

const NOTICE_BANNERS = [
  {
    id: "notice-1",
    label: "공지",
    title: "게시글 작성 전 커뮤니티 운영 가이드를 확인해 주세요.",
    fallbackHref: "/posts/notices",
  },
  {
    id: "notice-2",
    label: "필독",
    title: "거래 유도/홍보성 글은 사전 안내 없이 삭제될 수 있습니다.",
    fallbackHref: "/posts/notices",
  },
];

type BackupCommunityContent = {
  id: string;
  category: string;
  title: string;
  description: string;
  cta: string;
  href: string;
};

const BACKUP_COMMUNITY_CONTENT: BackupCommunityContent[] = [
  {
    id: "community-fallback-1",
    category: "정보",
    title: "브리더 노하우 공유 시작",
    description: "사육, 변이, 거래 팁을 나누고 서로 성장할 수 있어요.",
    cta: "첫 게시글 작성하기",
    href: "/posts/upload",
  },
  {
    id: "community-fallback-2",
    category: "질문",
    title: "궁금한 점이 있다면 편하게 물어보세요",
    description: "좋은 답변을 받기 위한 질문 가이드도 함께 제공해요.",
    cta: "질문 글 쓰기",
    href: "/posts/upload",
  },
];

export default function PostsClient() {
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedSort, setSelectedSort] = useState<SortType>("latest");
  const [selectedSpecies, setSelectedSpecies] = useState("전체");
  const [activeHighlightTab, setActiveHighlightTab] = useState<"hot" | "breeder">("hot");

  const getKey = (
    pageIndex: number,
    previousPageData: PostsListResponse | null
  ) => {
    if (previousPageData && !previousPageData.posts.length) return null;
    const categoryParam =
      selectedCategory !== "전체" ? `&category=${selectedCategory}` : "";
    const sortParam = selectedSort !== "latest" ? `&sort=${selectedSort}` : "";
    const speciesParam = selectedSpecies !== "전체" ? `&species=${selectedSpecies}` : "";
    return `/api/posts?page=${pageIndex + 1}${categoryParam}${sortParam}${speciesParam}`;
  };

  const { data, setSize } = useSWRInfinite<PostsListResponse>(getKey);
  const { data: bredyData } = useSWR<RankingResponse>(
    "/api/ranking?tab=bredy"
  );
  const { data: noticeData } = useSWR<NoticePostsResponse>("/api/posts/notices");
  const { data: homeFeedData } = useSWR<{ hotDiscussions: HotDiscussionItem[] }>(
    "/api/home/feed?scope=public",
    { revalidateOnFocus: false }
  );
  const page = useInfiniteScroll();

  useEffect(() => {
    setSize(page);
  }, [setSize, page]);

  // Default to "breeder" tab if hotDiscussions is empty
  useEffect(() => {
    if (homeFeedData && (!homeFeedData.hotDiscussions || homeFeedData.hotDiscussions.length === 0)) {
      setActiveHighlightTab("breeder");
    }
  }, [homeFeedData]);

  // 카테고리 변경 시 데이터 리셋
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSize(1);
  };
  const handleSortChange = (sortType: SortType) => {
    if (selectedSort === sortType) return;
    setSelectedSort(sortType);
    setSize(1);
  };

  const handleSpeciesChange = (species: string) => {
    setSelectedSpecies(species);
    setSize(1);
  };

  const bredyRanking = bredyData?.bredyRanking?.slice(0, 5) ?? [];
  const noticePosts = noticeData?.posts ?? [];
  const displayNotices =
    noticePosts.length > 0
      ? noticePosts.slice(0, 2).map((post) => ({
          id: `notice-${post.id}`,
          label: "공지",
          title: post.title,
          href: toPostPath(post.id, post.title),
        }))
      : NOTICE_BANNERS.map((notice) => ({
          id: notice.id,
          label: notice.label,
          title: notice.title,
          href: notice.fallbackHref,
        }));
  const loadedPostCount =
    data?.reduce((count, pageData) => count + (pageData?.posts?.length ?? 0), 0) ?? 0;
  const sortedPosts = useMemo(
    () => data?.flatMap((pageData) => pageData?.posts ?? []) ?? [],
    [data]
  );
  const sortLabel =
    SORT_TABS.find((sortTab) => sortTab.id === selectedSort)?.name ?? "최신순";

  return (
    <Layout icon hasTabBar seoTitle="반려생활" showSearch>
      <div className="app-page flex flex-col h-full">
        {/* 1. 공지사항 */}
        <section className="px-4 py-3 space-y-2 app-reveal">
          <div className="flex items-center justify-between pb-1">
            <h2 className="app-section-title">공지사항</h2>
            <Link href="/posts/notices" className="app-section-link">
              공지사항 더보기
              <span aria-hidden="true">›</span>
            </Link>
          </div>
          {displayNotices.map((notice) => (
            <Link
              key={notice.id}
              href={notice.href}
              className="app-card-interactive block rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-50 px-3 py-2.5 dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-900/80"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex shrink-0 min-w-[42px] justify-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900">
                  {notice.label}
                </span>
                <p className="app-body-md min-w-0 flex-1 text-slate-900 dark:text-slate-100 line-clamp-1">
                  {notice.title}
                </p>
              </div>
            </Link>
          ))}
        </section>

        {/* 2. 글 카테고리 탭 (primary - scrollable) */}
        <div className="app-rail flex gap-1.5 px-4 py-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleCategoryChange(tab.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                selectedCategory === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              <span className={cn("mr-1 inline-block h-2 w-2 rounded-full", CATEGORY_ACCENT[tab.id] ?? "bg-slate-400")} />
              {tab.name}
            </button>
          ))}
        </div>

        {/* 3. 종 필터 + 정렬 드롭다운 (secondary - compact row) */}
        <div className="flex items-center gap-2 px-4 py-1.5">
          <select
            value={selectedSpecies}
            onChange={(e) => handleSpeciesChange(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600"
          >
            <option value="전체">전체 종</option>
            {TOP_LEVEL_CATEGORIES.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={selectedSort}
            onChange={(e) => handleSortChange(e.target.value as SortType)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600"
          >
            {SORT_TABS.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* 4. Tabbed section: HOT 토론 / TOP 브리디 */}
        <section className="app-section py-2">
          <div className="flex items-center gap-1 px-4">
            <button
              onClick={() => setActiveHighlightTab("hot")}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                activeHighlightTab === "hot"
                  ? "bg-rose-500 text-white"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              🔥 HOT 토론
            </button>
            <button
              onClick={() => setActiveHighlightTab("breeder")}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                activeHighlightTab === "breeder"
                  ? "bg-amber-500 text-white"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              🏆 TOP 브리디
            </button>
          </div>
          <div className="mt-2">
            {activeHighlightTab === "hot" ? (
              /* HOT 토론 content */
              homeFeedData?.hotDiscussions?.length ? (
                <div className="px-4 flex flex-col gap-2.5">
                  {homeFeedData.hotDiscussions.map((item: HotDiscussionItem, index: number) => (
                    <Link
                      key={item.id}
                      href={toPostPath(item.id, item.title)}
                      className="app-card app-card-interactive flex items-start gap-3 p-3.5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-sm font-black text-rose-500">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {item.category ? (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                              {item.category}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                            HOT
                          </span>
                        </div>
                        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</h3>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500">
                          <span>{item.user.name}</span>
                          <span>댓글 {item.commentsCount}</span>
                          <span>좋아요 {item.wonderCount}</span>
                        </div>
                      </div>
                      {item.image ? (
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
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
                <div className="app-body-sm text-slate-400 px-5 py-4">
                  실시간 HOT 토론이 없습니다.
                </div>
              )
            ) : (
              /* TOP 브리디 content */
              <div className="app-rail flex gap-2.5 px-4">
                {bredyData ? (
                  bredyRanking.length > 0 ? (
                    bredyRanking.map((bredy, index) => (
                      <Link
                        key={bredy.user.id}
                        href={`/profiles/${bredy.user.id}`}
                        className="snap-start shrink-0 w-72 app-card app-card-interactive px-2.5 py-2"
                      >
                        <div className="flex items-center justify-between">
                          {index < 3 ? (
                            <span className="text-xs leading-none">
                              {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                            </span>
                          ) : (
                            <span className="app-caption text-[11px] font-semibold text-slate-500">
                              {index + 1}위
                            </span>
                          )}
                          <span className="app-caption text-[11px]">점수</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {bredy.user.avatar ? (
                            <Image
                              src={makeImageUrl(bredy.user.avatar, "avatar")}
                              className="w-7 h-7 rounded-full object-cover"
                              width={36}
                              height={36}
                              alt=""
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-200" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold tracking-tight text-slate-900 truncate">
                              {bredy.user.name}
                            </p>
                            <p className="app-caption text-[11px]">
                              ❤️ {bredy.totalLikes}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-sm font-bold text-primary">
                          {bredy.score.toLocaleString()}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <div className="app-body-sm text-slate-400 px-1 py-2">
                      표시할 브리디 랭킹이 없습니다.
                    </div>
                  )
                ) : (
                  [...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="snap-start shrink-0 w-72 app-card px-2.5 py-2 animate-pulse"
                    >
                      <div className="h-4 bg-slate-200 rounded w-1/4" />
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200" />
                        <div className="space-y-1 flex-1">
                          <div className="h-3 bg-slate-200 rounded w-2/3" />
                          <div className="h-3 bg-slate-200 rounded w-1/3" />
                        </div>
                      </div>
                      <div className="mt-2 h-4 bg-slate-200 rounded w-1/2" />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        {/* 5. 게시글 목록 title + count */}
        <section id="all-posts" className="px-4 pt-6 pb-2">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="app-section-title">
                {selectedCategory === "전체" ? "전체 게시글" : `${selectedCategory} 게시글`}
              </h2>
              <p className="mt-1 app-caption">
                {sortLabel}로 노출됩니다.
              </p>
            </div>
            <span className="app-count-chip">{loadedPostCount}개</span>
          </div>
        </section>

        {/* 6. 게시글 목록 (infinite scroll) */}
        <div className="border-y border-slate-100 bg-white pb-4">
          {data ? (
            sortedPosts.map((post) => (
                <Link
                  key={post.id}
                  href={toPostPath(post.id, post.title)}
                  className="block w-full border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-2.5">
                    {/* 텍스트 영역 */}
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {post.category && (
                            <span className="app-pill-accent">
                              {post.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {post._count.Likes > 0 && (
                            <span className="app-pill-muted">
                              <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z" />
                              </svg>
                              {post._count.Likes}
                            </span>
                          )}
                          {post._count.comments > 0 && (
                            <span className="app-pill-muted">
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                />
                              </svg>
                              {post._count.comments}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 카테고리 뱃지 */}
                      <h3 className="app-title-md leading-snug line-clamp-1">
                        {post.title}
                      </h3>

                      {/* 본문 미리보기 */}
                      <p className="app-body-sm mt-1 line-clamp-2 leading-relaxed">
                        {post.description}
                      </p>

                      {/* 하단 메타 정보 */}
                      <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-400">
                        {/* 프로필 */}
                        <div className="flex items-center gap-1">
                          <div
                            className={cn(
                              hasBreederProgramFrame(post.user?.breederPrograms)
                                ? "rounded-full p-0.5"
                                : "",
                              hasBreederProgramFrame(post.user?.breederPrograms)
                                ? getBreederProgramFrameClassName(
                                    post.user?.breederPrograms
                                  )
                                : ""
                            )}
                          >
                            {post.user?.avatar ? (
                              <Image
                                src={makeImageUrl(post.user.avatar, "avatar")}
                                className={cn(
                                  "h-4 w-4 rounded-full object-cover",
                                  hasBreederProgramFrame(post.user?.breederPrograms)
                                    ? "ring-1 ring-white/70"
                                    : ""
                                )}
                                width={16}
                                height={16}
                                alt=""
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-slate-200" />
                            )}
                          </div>
                          <span className="truncate">{post.user?.name}</span>
                          <BreederProgramBadgeList
                            programs={post.user?.breederPrograms}
                            compact
                          />
                        </div>

                        <span className="text-slate-300">·</span>
                        <span>{getTimeAgoString(new Date(post.createdAt))}</span>
                      </div>
                    </div>

                    {/* 썸네일 이미지 */}
                    {post.image && (
                      <div className="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        <Image
                          src={makeImageUrl(post.image, "public")}
                          className="w-full h-full object-cover"
                          width={72}
                          height={72}
                          alt=""
                        />
                      </div>
                    )}
                  </div>
                </Link>
              ))
          ) : (
            // 로딩 스켈레톤
            <div className="divide-y divide-slate-100">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-16" />
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-full" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                  <div className="w-20 h-20 bg-slate-200 rounded-lg flex-shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* 결과 없을 때 */}
          {data && sortedPosts.length === 0 && (
            <div className="px-4 py-8">
              <div className="mb-4 text-center">
                <p className="app-title-md text-slate-600">
                  커뮤니티가 활발해질 준비 중이에요
                </p>
                <p className="app-body-sm mt-1 text-slate-500">
                  질문과 정보 글을 먼저 올리면 대화가 더 빨리 시작됩니다.
                </p>
              </div>
              <div className="space-y-2.5">
                {BACKUP_COMMUNITY_CONTENT.map((content) => (
                  <Link
                    key={content.id}
                    href={content.href}
                    className="app-card app-card-interactive block border-dashed px-3.5 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="app-pill-accent">{content.category}</span>
                        <p className="mt-2 app-title-md text-slate-700">
                          {content.title}
                        </p>
                        <p className="mt-1 app-body-sm text-slate-500">
                          {content.description}
                        </p>
                      </div>
                      <span className="mt-1 app-caption text-slate-400">›</span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-700">
                      {content.cta}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 7. 글쓰기 버튼 */}
        <FloatingButton href="/posts/upload">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </FloatingButton>
      </div>
    </Layout>
  );
}
