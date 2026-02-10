"use client";

import { useState } from "react";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl, getTimeAgoString } from "@libs/client/utils";
import Link from "next/link";
import { SearchResponse } from "pages/api/search";
import { CATEGORIES } from "@libs/constants";

type SearchTab = "all" | "products" | "posts" | "users";

const SEARCH_TABS: { id: SearchTab; name: string }[] = [
  { id: "all", name: "전체" },
  { id: "products", name: "상품" },
  { id: "posts", name: "게시글" },
  { id: "users", name: "유저" },
];

/** 인기 검색어 목록 */
const POPULAR_KEYWORDS = [
  "헤라클레스",
  "사슴벌레",
  "극태",
  "왕사",
  "장수풍뎅이",
  "넓적사슴벌레",
  "코카서스",
  "건조표본",
];

/** 추천 상품 응답 타입 */
interface RecommendProductsResponse {
  success: boolean;
  products: {
    id: number;
    name: string;
    price: number | null;
    photos: string[];
    category: string | null;
    status: string;
    _count: { favs: number };
  }[];
}

/** 추천 게시글 응답 타입 */
interface RecommendPostsResponse {
  success: boolean;
  posts: {
    id: number;
    title: string;
    description: string;
    image: string;
    category: string | null;
    createdAt: string;
    user: { id: number; name: string; avatar: string | null };
    _count: { Likes: number; comments: number };
  }[];
}

const SearchClient = () => {
  const [keyword, setKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("all");

  // 검색 결과
  const { data, isLoading } = useSWR<SearchResponse>(
    searchQuery
      ? `/api/search?q=${encodeURIComponent(searchQuery)}&type=${activeTab}`
      : null
  );

  // 검색 전 추천 콘텐츠 (검색어가 없을 때만 fetch)
  const { data: recommendProducts } = useSWR<RecommendProductsResponse>(
    !searchQuery ? "/api/products?page=1" : null
  );
  const { data: recommendPosts } = useSWR<RecommendPostsResponse>(
    !searchQuery ? "/api/posts?page=1" : null
  );

  /** 검색 실행 */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      setSearchQuery(keyword.trim());
    }
  };

  /** 인기 검색어 클릭 */
  const handleKeywordClick = (kw: string) => {
    setKeyword(kw);
    setSearchQuery(kw);
  };

  /** 카테고리 클릭 */
  const handleCategoryClick = (categoryName: string) => {
    setKeyword(categoryName);
    setSearchQuery(categoryName);
  };

  const hasResults =
    data &&
    (data.products.length > 0 ||
      data.posts.length > 0 ||
      data.users.length > 0);

  return (
    <Layout canGoBack title="검색" seoTitle="검색">
      {/* 검색 입력 */}
      <form onSubmit={handleSearch} className="px-4 pt-4 pb-2">
        <div className="relative">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="상품, 게시글, 유저를 검색해보세요"
            className="w-full px-4 py-3 pl-10 rounded-xl bg-gray-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
            autoFocus
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {/* 검색어 지우기 버튼 */}
          {keyword && (
            <button
              type="button"
              onClick={() => {
                setKeyword("");
                setSearchQuery("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-gray-300 hover:bg-gray-400 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* 탭 (검색 후) */}
      {searchQuery && (
        <div className="flex px-4 gap-2 pb-3 border-b border-gray-100">
          {SEARCH_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              )}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      )}

      {/* 결과 없음 */}
      {searchQuery && !isLoading && !hasResults && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg font-medium">검색 결과가 없습니다</p>
          <p className="text-sm mt-1">다른 키워드로 검색해 보세요</p>
        </div>
      )}

      {/* ============ 검색 전: 추천 콘텐츠 ============ */}
      {!searchQuery && !isLoading && (
        <div className="pb-20">
          {/* 인기 검색어 */}
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">
              인기 검색어
            </h3>
            <div className="flex flex-wrap gap-2">
              {POPULAR_KEYWORDS.map((kw) => (
                <button
                  key={kw}
                  onClick={() => handleKeywordClick(kw)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>

          {/* 카테고리 바로가기 */}
          <div className="px-4 pt-5 pb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">
              카테고리
            </h3>
            <div className="flex overflow-x-auto scrollbar-hide gap-3 pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.name)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-slate-300 font-medium whitespace-nowrap">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 추천 상품 (가로 스크롤 카드) */}
          {recommendProducts?.products &&
            recommendProducts.products.length > 0 && (
              <div className="pt-5">
                <div className="px-4 flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    추천 상품
                  </h3>
                  <Link
                    href="/"
                    className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600"
                  >
                    전체보기
                  </Link>
                </div>
                <div className="flex overflow-x-auto scrollbar-hide gap-3 px-4 pb-2">
                  {recommendProducts.products.slice(0, 10).map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="flex-shrink-0 w-36"
                    >
                      <div className="relative w-36 h-36 rounded-xl overflow-hidden bg-gray-100">
                        {product.photos[0] ? (
                          <Image
                            src={makeImageUrl(product.photos[0], "product")}
                            alt={product.name}
                            fill
                            sizes="144px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                        {product.status !== "판매중" && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {product.status}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-900 dark:text-slate-100 font-medium line-clamp-1">
                          {product.name}
                        </p>
                        <p className="text-sm font-bold text-gray-900 dark:text-slate-100 mt-0.5">
                          {product.price
                            ? `${product.price.toLocaleString()}원`
                            : "가격 미정"}
                        </p>
                        {product.category && (
                          <span className="text-xs text-primary mt-0.5 inline-block">
                            {product.category}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          {/* 인기 게시글 */}
          {recommendPosts?.posts && recommendPosts.posts.length > 0 && (
            <div className="pt-5">
              <div className="px-4 flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  인기 게시글
                </h3>
                <Link
                  href="/posts"
                  className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600"
                >
                  전체보기
                </Link>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-slate-800">
                {recommendPosts.posts.slice(0, 5).map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                        {post.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-1">
                        {post.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span>{post.user.name}</span>
                        <span className="flex items-center gap-0.5">
                          <svg
                            className="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          {post._count.Likes}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <svg
                            className="w-3 h-3"
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
                      </div>
                    </div>
                    {post.image && (
                      <Image
                        src={makeImageUrl(post.image, "public")}
                        alt={post.title}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-lg object-cover bg-gray-200 dark:bg-slate-700 flex-shrink-0"
                      />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 추천 콘텐츠 로딩 스켈레톤 */}
          {!recommendProducts && !recommendPosts && (
            <div className="px-4 pt-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="w-16 h-16 rounded-lg bg-gray-200" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ 검색 결과 ============ */}
      {data && hasResults && (
        <div className="pb-20">
          {/* 상품 결과 */}
          {data.products.length > 0 &&
            (activeTab === "all" || activeTab === "products") && (
              <div>
                {activeTab === "all" && (
                  <div className="px-4 py-3 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">상품</h3>
                    <button
                      onClick={() => setActiveTab("products")}
                      className="text-sm text-primary"
                    >
                      더보기
                    </button>
                  </div>
                )}
                <div className="divide-y divide-gray-50 dark:divide-slate-800">
                  {data.products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors"
                    >
                      {product.photos[0] ? (
                        <Image
                          src={makeImageUrl(product.photos[0], "product")}
                          alt={product.name}
                          width={64}
                          height={64}
                          className="w-16 h-16 rounded-lg object-cover bg-gray-200"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-200" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {product.category && (
                            <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              {product.category}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {product.status}
                          </span>
                        </div>
                        <p className="text-sm font-semibold mt-1">
                          {product.price
                            ? `${product.price.toLocaleString()}원`
                            : "가격 미정"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          {/* 게시글 결과 */}
          {data.posts.length > 0 &&
            (activeTab === "all" || activeTab === "posts") && (
              <div>
                {activeTab === "all" && (
                  <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
                    <h3 className="font-semibold text-gray-900">게시글</h3>
                    <button
                      onClick={() => setActiveTab("posts")}
                      className="text-sm text-primary"
                    >
                      더보기
                    </button>
                  </div>
                )}
                <div className="divide-y divide-gray-50 dark:divide-slate-800">
                  {data.posts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/posts/${post.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                          {post.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-1">
                          {post.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>{post.user.name}</span>
                          <span>좋아요 {post._count.Likes}</span>
                          <span>댓글 {post._count.comments}</span>
                        </div>
                      </div>
                      {post.image && (
                        <Image
                          src={makeImageUrl(post.image, "public")}
                          alt={post.title}
                          width={56}
                          height={56}
                          className="w-14 h-14 rounded-lg object-cover bg-gray-200"
                        />
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

          {/* 유저 결과 */}
          {data.users.length > 0 &&
            (activeTab === "all" || activeTab === "users") && (
              <div>
                {activeTab === "all" && (
                  <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
                    <h3 className="font-semibold text-gray-900">유저</h3>
                    <button
                      onClick={() => setActiveTab("users")}
                      className="text-sm text-primary"
                    >
                      더보기
                    </button>
                  </div>
                )}
                <div className="divide-y divide-gray-50 dark:divide-slate-800">
                  {data.users.map((user) => (
                    <Link
                      key={user.id}
                      href={`/profiles/${user.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors"
                    >
                      {user.avatar ? (
                        <Image
                          src={makeImageUrl(user.avatar, "avatar")}
                          alt={user.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full bg-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                      )}
                      <p className="text-sm font-medium text-gray-900">
                        {user.name}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}
    </Layout>
  );
};

export default SearchClient;
