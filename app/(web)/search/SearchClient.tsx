"use client";

import { useState } from "react";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl, getTimeAgoString } from "@libs/client/utils";
import Link from "next/link";
import { SearchResponse } from "pages/api/search";

type SearchTab = "all" | "products" | "posts" | "users";

const SEARCH_TABS: { id: SearchTab; name: string }[] = [
  { id: "all", name: "전체" },
  { id: "products", name: "상품" },
  { id: "posts", name: "게시글" },
  { id: "users", name: "유저" },
];

const SearchClient = () => {
  const [keyword, setKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("all");

  const { data, isLoading } = useSWR<SearchResponse>(
    searchQuery
      ? `/api/search?q=${encodeURIComponent(searchQuery)}&type=${activeTab}`
      : null
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      setSearchQuery(keyword.trim());
    }
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
            className="w-full px-4 py-3 pl-10 rounded-xl bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
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
        </div>
      </form>

      {/* 탭 */}
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
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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

      {/* 검색 전 안내 */}
      {!searchQuery && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg font-medium">무엇을 찾고 계세요?</p>
          <p className="text-sm mt-1">
            곤충, 용품, 사육 정보를 검색해 보세요
          </p>
        </div>
      )}

      {/* 검색 결과 */}
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
                <div className="divide-y divide-gray-50">
                  {data.products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
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
                        <p className="text-sm font-medium text-gray-900 truncate">
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
                <div className="divide-y divide-gray-50">
                  {data.posts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/posts/${post.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {post.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-1">
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
                <div className="divide-y divide-gray-50">
                  {data.users.map((user) => (
                    <Link
                      key={user.id}
                      href={`/profiles/${user.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
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
