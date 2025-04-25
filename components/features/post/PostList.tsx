"use client";

import React from "react";
import { Post } from "@prisma/client";
import useSWRInfinite from "swr/infinite";
import PostItem from "@components/features/post/PostItem";
import { useInfiniteScroll } from "@libs/client/useInfiniteScroll";
import FloatingButton from "@components/atoms/floating-button";
import SkeletonItem from "@components/atoms/SkeletonItem";
import MainLayout from "@components/features/layout";
import { useSearchParams } from "next/navigation";
import { Button } from "@components/ui/button";
import Link from "next/link";
import { Input } from "@components/ui/input";
import { Search } from "lucide-react";

interface PostWithUser extends Post {
  author: {
    id: number;
    name: string;
    avatar: string | null;
  };
  _count: {
    comments: number;
    likes: number;
  };
}

interface PostListResponse {
  success: boolean;
  posts: PostWithUser[];
  nextCursor: number | null;
}

interface PostListProps {
  category: string;
}

const PostList = ({ category }: PostListProps) => {
  const page = useInfiniteScroll();
  const searchParams = useSearchParams();
  const currentCategory = searchParams?.get("category") || "all";
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeSearchTerm, setActiveSearchTerm] = React.useState("");

  const handleSearch = () => {
    setActiveSearchTerm(searchTerm);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const getKey = (pageIndex: number, previousPageData: PostListResponse) => {
    if (previousPageData && !previousPageData.nextCursor) return null;
    const searchQuery = activeSearchTerm ? `&search=${activeSearchTerm}` : "";
    if (pageIndex === 0) return `/api/posts?limit=10&category=${currentCategory}${searchQuery}`;
    return `/api/posts?cursor=${previousPageData.nextCursor}&limit=10&category=${currentCategory}${searchQuery}`;
  };

  const { data, size, setSize, isLoading, mutate } = useSWRInfinite<PostListResponse>(
    getKey,
    {
      revalidateOnFocus: false,
    }
  );

  React.useEffect(() => {
    mutate();
  }, [activeSearchTerm, mutate]);

  const postsData = data ? data.flatMap((page) => page.posts) : [];
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.posts.length === 0;
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.nextCursor === null);

  React.useEffect(() => {
    setSize(page);
  }, [setSize, page]);

  return (
    <MainLayout title="곤충생활" hasTabBar={true} icon>
      <div className="flex flex-col h-full">
        {/* 검색 필드 */}
        <div className="px-4 py-2">
          <div className="relative">
            <button
              onClick={handleSearch}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
            <Input
              type="text"
              placeholder="검색어를 입력하세요"
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex space-x-2 p-4 overflow-x-auto">
          <Link href="/posts?category=all">
            <Button
              variant={currentCategory === "all" ? "default" : "outline"}
              size="sm"
            >
              전체
            </Button>
          </Link>
          <Link href="/posts?category=question">
            <Button
              variant={currentCategory === "question" ? "default" : "outline"}
              size="sm"
            >
              질문
            </Button>
          </Link>
          <Link href="/posts?category=share">
            <Button
              variant={currentCategory === "share" ? "default" : "outline"}
              size="sm"
            >
              공유
            </Button>
          </Link>
          <Link href="/posts?category=notice">
            <Button
              variant={currentCategory === "notice" ? "default" : "outline"}
              size="sm"
            >
              공지
            </Button>
          </Link>
        </div>

        {/* 포스트 목록 */}
        <div className="flex flex-col space-y-4 px-4 pb-20">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <SkeletonItem key={i} />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="text-gray-500 text-center">
                <p className="text-lg font-medium">게시물이 없습니다</p>
                <p className="text-sm mt-2">첫 번째 게시물을 작성해보세요!</p>
              </div>
            </div>
          ) : (
            postsData.map((post) => (
              <PostItem key={post.id} post={post} />
            ))
          )}
        </div>

        {/* 글쓰기 플로팅 버튼 */}
        <FloatingButton href="/posts/upload">
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
      </div>
    </MainLayout>
  );
};

export default PostList; 