"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "@components/atoms/Image";
import useSWR from "swr";

import Layout from "@components/features/MainLayout";
import FloatingButton from "@components/atoms/floating-button";
import useSWRInfinite from "swr/infinite";
import { useInfiniteScroll } from "hooks/useInfiniteScroll";

import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { POST_CATEGORIES } from "@libs/constants";
import { PostsListResponse } from "pages/api/posts";
import { NoticePostsResponse } from "pages/api/posts/notices";
import { RankingResponse } from "pages/api/ranking";

/** 카테고리 탭 목록 */
const TABS = [{ id: "전체", name: "전체" }, ...POST_CATEGORIES];
const CATEGORY_ACCENT: Record<string, string> = {
  전체: "bg-slate-500",
  사진: "bg-cyan-500",
  변이: "bg-violet-500",
  사육: "bg-emerald-500",
  질문: "bg-amber-500",
  자유: "bg-pink-500",
};

const NOTICE_BANNERS = [
  {
    id: "notice-1",
    label: "공지",
    title: "게시글 작성 전 커뮤니티 운영 가이드를 확인해 주세요.",
    fallbackHref: "/posts",
  },
  {
    id: "notice-2",
    label: "필독",
    title: "거래 유도/홍보성 글은 사전 안내 없이 삭제될 수 있습니다.",
    fallbackHref: "/posts",
  },
];

const getMedalClass = (rank: number) => {
  if (rank === 1) return "bg-yellow-400 text-white";
  if (rank === 2) return "bg-gray-400 text-white";
  if (rank === 3) return "bg-amber-700 text-white";
  return "bg-gray-200 text-gray-600";
};

const SectionHeader = ({
  title,
  href,
}: {
  title: string;
  href: string;
}) => (
  <div className="px-4 flex items-center justify-between">
    <h2 className="app-section-title">{title}</h2>
    <Link href={href} className="app-section-link">
      더보기
      <span aria-hidden="true">›</span>
    </Link>
  </div>
);

export default function PostsClient() {
  const [selectedCategory, setSelectedCategory] = useState("전체");

  const getKey = (
    pageIndex: number,
    previousPageData: PostsListResponse | null
  ) => {
    if (previousPageData && !previousPageData.posts.length) return null;
    const categoryParam =
      selectedCategory !== "전체" ? `&category=${selectedCategory}` : "";
    return `/api/posts?page=${pageIndex + 1}${categoryParam}`;
  };

  const { data, setSize, mutate } = useSWRInfinite<PostsListResponse>(getKey);
  const { data: hotRankingData } = useSWR<RankingResponse>(
    "/api/ranking?tab=coolInsect"
  );
  const { data: guinnessData } = useSWR<RankingResponse>(
    "/api/ranking?tab=guinness"
  );
  const { data: bredyData } = useSWR<RankingResponse>(
    "/api/ranking?tab=bredy"
  );
  const { data: noticeData } = useSWR<NoticePostsResponse>("/api/posts/notices");
  const page = useInfiniteScroll();

  useEffect(() => {
    setSize(page);
  }, [setSize, page]);

  // 카테고리 변경 시 데이터 리셋
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  useEffect(() => {
    mutate();
  }, [selectedCategory, mutate]);

  const hotPosts = hotRankingData?.postRanking?.slice(0, 5) ?? [];
  const guinnessRecords = guinnessData?.records?.slice(0, 3) ?? [];
  const bredyRanking = bredyData?.bredyRanking?.slice(0, 5) ?? [];
  const noticePosts = noticeData?.posts ?? [];
  const displayNotices =
    noticePosts.length > 0
      ? noticePosts.slice(0, 2).map((post) => ({
          id: `notice-${post.id}`,
          label: "공지",
          title: post.title,
          href: `/posts/${post.id}`,
        }))
      : NOTICE_BANNERS.map((notice) => ({
          id: notice.id,
          label: notice.label,
          title: notice.title,
          href: notice.fallbackHref,
        }));
  const loadedPostCount =
    data?.reduce((count, pageData) => count + (pageData?.posts?.length ?? 0), 0) ?? 0;

  return (
    <Layout icon hasTabBar seoTitle="애완동물 서비스" showSearch>
      <div className="app-page flex flex-col h-full">
        {/* 헤더 타이틀 */}
        <div className="px-4 pt-3 pb-1">
          <h1 className="app-title-lg">애완동물 서비스</h1>
        </div>

        {/* 공지/고정 게시글 */}
        <section className="px-4 py-3 space-y-2 app-reveal">
          {displayNotices.map((notice) => (
            <Link
              key={notice.id}
              href={notice.href}
              className="app-card-interactive block rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-500 text-white">
                  {notice.label}
                </span>
                <p className="app-body-md text-amber-900 line-clamp-1">
                  {notice.title}
                </p>
              </div>
            </Link>
          ))}
        </section>

        {/* HOT 게시글 */}
        <section className="app-section-muted app-reveal app-reveal-1">
          <SectionHeader title="HOT 게시글" href="/ranking" />
          <div className="app-rail mt-3 flex gap-3 px-4">
            {hotRankingData ? (
              hotPosts.length > 0 ? (
                hotPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="snap-start shrink-0 w-40 app-card app-card-interactive overflow-hidden"
                  >
                    <div className="relative aspect-square bg-gray-100">
                      {post.image ? (
                        <Image
                          src={makeImageUrl(post.image, "public")}
                          className="object-cover"
                          fill
                          sizes="160px"
                          alt={post.title}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100" />
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="app-title-md line-clamp-1">
                        {post.title}
                      </h3>
                      <p className="mt-1 app-caption">❤️ {post._count.Likes}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="app-body-sm text-slate-400 px-1 py-2">
                  표시할 HOT 게시글이 없습니다.
                </div>
              )
            ) : (
              [...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="snap-start shrink-0 w-40 app-card overflow-hidden animate-pulse"
                >
                  <div className="aspect-square bg-gray-200" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-4/5" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 브리디북 미리보기 */}
        <section className="app-section app-reveal app-reveal-2">
          <SectionHeader title="브리디북" href="/guinness" />
          <div className="app-rail mt-3 flex gap-3 px-4">
            {guinnessData ? (
              guinnessRecords.filter((record) => record.recordType === "size").length > 0 ? (
                guinnessRecords
                  .filter((record) => record.recordType === "size")
                  .map((record, index) => (
                  <Link
                    key={record.id}
                    href="/guinness"
                    className="snap-start shrink-0 w-56 app-card app-card-interactive p-4"
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={cn(
                          "w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center",
                          getMedalClass(index + 1)
                        )}
                      >
                        {index + 1}
                      </span>
                      <p className="app-caption">{record.species}</p>
                    </div>
                    <p className="mt-3 app-title-md">
                      체장 기록
                    </p>
                    <p className="mt-1 text-xl font-bold text-primary">
                      {record.value}
                      <span className="app-caption ml-1">mm</span>
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      {record.user.avatar ? (
                        <Image
                          src={makeImageUrl(record.user.avatar, "avatar")}
                          className="w-6 h-6 rounded-full object-cover"
                          width={24}
                          height={24}
                          alt=""
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200" />
                      )}
                      <span className="app-caption text-slate-500">{record.user.name}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="app-body-sm text-slate-400 px-1 py-2">
                  표시할 체장 기록이 없습니다.
                </div>
              )
            ) : (
              [...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="snap-start shrink-0 w-56 app-card p-4 animate-pulse"
                >
                  <div className="h-7 w-7 rounded-full bg-gray-200" />
                  <div className="mt-3 h-4 bg-gray-200 rounded w-2/5" />
                  <div className="mt-2 h-6 bg-gray-200 rounded w-1/2" />
                  <div className="mt-3 h-4 bg-gray-200 rounded w-1/3" />
                </div>
              ))
            )}
          </div>
        </section>

        {/* TOP 브리디 */}
        <section className="app-section-muted app-reveal app-reveal-3">
          <SectionHeader title="TOP 브리디" href="/ranking" />
          <div className="app-rail mt-3 flex gap-3 px-4">
            {bredyData ? (
              bredyRanking.length > 0 ? (
                bredyRanking.map((bredy, index) => (
                  <Link
                    key={bredy.user.id}
                    href={`/profiles/${bredy.user.id}`}
                    className="snap-start shrink-0 w-44 app-card app-card-interactive p-3"
                  >
                    <div className="flex items-center justify-between">
                      {index < 3 ? (
                        <span className="text-base leading-none">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                        </span>
                      ) : (
                        <span className="app-caption font-bold text-slate-500">
                          {index + 1}위
                        </span>
                      )}
                      <span className="app-caption">점수</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {bredy.user.avatar ? (
                        <Image
                          src={makeImageUrl(bredy.user.avatar, "avatar")}
                          className="w-9 h-9 rounded-full object-cover"
                          width={36}
                          height={36}
                          alt=""
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-200" />
                      )}
                      <div className="min-w-0">
                        <p className="app-title-md truncate">
                          {bredy.user.name}
                        </p>
                        <p className="app-caption">
                          ❤️ {bredy.totalLikes}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-lg font-bold text-primary">
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
                  className="snap-start shrink-0 w-44 app-card p-3 animate-pulse"
                >
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gray-200" />
                    <div className="space-y-1 flex-1">
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="mt-3 h-5 bg-gray-200 rounded w-1/2" />
                </div>
              ))
            )}
          </div>
        </section>

        {/* 카테고리 탭 */}
        <div className="app-sticky-rail app-reveal-fade">
          <div className="px-4 py-3">
            <div className="app-card p-2">
              <div className="app-rail flex gap-2 snap-none">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleCategoryChange(tab.id)}
                    className={cn(
                      "app-chip",
                      selectedCategory === tab.id
                        ? "app-chip-active"
                        : "app-chip-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        selectedCategory === tab.id
                          ? "bg-white/90"
                          : CATEGORY_ACCENT[tab.id] ?? "bg-slate-400"
                      )}
                    />
                    {tab.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section id="all-posts" className="px-4 pt-6 pb-2">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="app-section-title">
                {selectedCategory === "전체" ? "전체 게시글" : `${selectedCategory} 게시글`}
              </h2>
              <p className="mt-1 app-caption">
                최신 활동 순으로 노출됩니다.
              </p>
            </div>
            <span className="app-count-chip">{loadedPostCount}개</span>
          </div>
        </section>

        {/* 게시글 목록 */}
        <div className="border-y border-slate-100 bg-white pb-4">
          {data ? (
            data.map((result) =>
              result?.posts?.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
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
                          {post.user?.avatar ? (
                            <Image
                              src={makeImageUrl(post.user.avatar, "avatar")}
                              className="w-4 h-4 rounded-full object-cover"
                              width={16}
                              height={16}
                              alt=""
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-slate-200" />
                          )}
                          <span>{post.user?.name}</span>
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
            )
          ) : (
            // 로딩 스켈레톤
            <div className="divide-y divide-slate-100">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-16" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                  <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* 결과 없을 때 */}
          {data && data.length > 0 && data[0].posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <p className="app-title-md text-slate-500">등록된 게시글이 없습니다</p>
              <p className="app-body-sm mt-1">첫 번째 글을 작성해 보세요!</p>
            </div>
          )}
        </div>

        {/* 글쓰기 버튼 */}
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
