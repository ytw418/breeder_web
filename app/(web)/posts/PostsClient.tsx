"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "@components/atoms/Image";

import Layout from "@components/features/MainLayout";
import FloatingButton from "@components/atoms/floating-button";
import useSWRInfinite from "swr/infinite";
import { useInfiniteScroll } from "hooks/useInfiniteScroll";

import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { POST_CATEGORIES } from "@libs/constants";
import { PostsListResponse } from "pages/api/posts";

/** 카테고리 탭 목록 */
const TABS = [{ id: "전체", name: "전체" }, ...POST_CATEGORIES];

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
  }, [selectedCategory]);

  return (
    <Layout icon hasTabBar seoTitle="곤충생활">
      <div className="flex flex-col h-full">
        {/* 헤더 타이틀 */}
        <div className="px-4 pt-3 pb-1">
          <h1 className="text-xl font-bold text-gray-900">곤충생활</h1>
        </div>

        {/* 카테고리 탭 */}
        <div className="sticky top-14 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
          <div className="flex overflow-x-auto scrollbar-hide px-4 py-3 gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleCategoryChange(tab.id)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                  selectedCategory === tab.id
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* 게시글 목록 */}
        <div className="flex flex-col divide-y divide-gray-100">
          {data ? (
            data.map((result) =>
              result?.posts?.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="px-4 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex gap-3">
                    {/* 텍스트 영역 */}
                    <div className="flex-1 min-w-0">
                      {/* 카테고리 뱃지 */}
                      {post.category && (
                        <span className="inline-block text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded mb-1.5">
                          {post.category}
                        </span>
                      )}

                      {/* 제목 */}
                      <h3 className="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-1">
                        {post.title}
                      </h3>

                      {/* 본문 미리보기 */}
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {post.description}
                      </p>

                      {/* 하단 메타 정보 */}
                      <div className="flex items-center gap-2 mt-2.5 text-xs text-gray-400">
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
                            <div className="w-4 h-4 rounded-full bg-gray-200" />
                          )}
                          <span>{post.user?.name}</span>
                        </div>

                        <span className="text-gray-300">·</span>
                        <span>{getTimeAgoString(new Date(post.createdAt))}</span>

                        {/* 좋아요 */}
                        {post._count.Likes > 0 && (
                          <>
                            <span className="text-gray-300">·</span>
                            <div className="flex items-center gap-0.5">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                />
                              </svg>
                              <span>{post._count.Likes}</span>
                            </div>
                          </>
                        )}

                        {/* 댓글 */}
                        {post._count.comments > 0 && (
                          <>
                            <span className="text-gray-300">·</span>
                            <div className="flex items-center gap-0.5">
                              <svg
                                className="w-3.5 h-3.5"
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
                              <span>{post._count.comments}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 썸네일 이미지 */}
                    {post.image && (
                      <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={makeImageUrl(post.image, "product")}
                          className="w-full h-full object-cover"
                          width={80}
                          height={80}
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
            <div className="divide-y divide-gray-100">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-4 flex gap-3 animate-pulse">
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
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <p className="text-lg font-medium">등록된 게시글이 없습니다</p>
              <p className="text-sm mt-1">첫 번째 글을 작성해 보세요!</p>
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
