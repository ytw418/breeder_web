"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import useSWR from "swr";

import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { cn, makeImageUrl } from "@libs/client/utils";
import { SearchResponse } from "pages/api/search";
import { TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { getProductPath } from "@libs/product-route";
import { toPostPath } from "@libs/post-route";
import { formatProductPrice } from "@libs/productRules";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { toPostPlainText } from "@libs/shared/post-body";
import { productStatusLabel } from "@libs/shared/productTerms";

type SearchTab = "all" | "products" | "posts" | "users";

const SEARCH_TABS: { id: SearchTab; name: string }[] = [
  { id: "all", name: "전체" },
  { id: "products", name: "분양" },
  { id: "posts", name: "게시글" },
  { id: "users", name: "유저" },
];

/** 인기 검색어 목록(앱과 같다) */
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
    createdAt: string;
    _count: { favs: number };
  }[];
}

/** 추천 게시글 응답 타입 */
interface RecommendPostsResponse {
  success: boolean;
  posts: SearchResponse["posts"];
}

/** 검색 결과 플랫 행(앱 search ResultRow): 제목 16/600 · 설명 14 muted · 메타 13 muted, 오른쪽 56 썸네일 r8. */
function ResultRow({
  href,
  title,
  description,
  meta,
  imageId,
  imageVariant = "public",
}: {
  href: string;
  title: string;
  description?: string | null;
  meta?: string;
  imageId?: string | null;
  imageVariant?: "public" | "product";
}) {
  return (
    <Link href={href} className="flex items-center border-b border-app-line bg-app-bg px-4 py-3">
      <div className="min-w-0 flex-1 pr-3">
        <p className="truncate text-[16px] font-semibold text-app-text">{title}</p>
        {description ? <p className="mt-0.5 truncate text-[14px] text-app-muted">{description}</p> : null}
        {meta ? <p className="mt-1 truncate text-[13px] text-app-muted">{meta}</p> : null}
      </div>
      {imageId ? (
        <Image
          src={makeImageUrl(imageId, imageVariant)}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-lg bg-app-surface object-cover"
        />
      ) : null}
    </Link>
  );
}

/** 텍스트 칩(앱 TextChip): h32 r16 px14 14px. filled 면 테두리 없는 회색, selected 면 반전 채움. */
function TextChip({
  label,
  onClick,
  filled,
  selected,
}: {
  label: string;
  onClick: () => void;
  filled?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl px-3.5 text-[14px]",
        selected
          ? "border border-app-text bg-app-text font-bold text-app-bg"
          : filled
            ? "bg-app-surface font-medium text-app-text"
            : "border border-app-border bg-app-bg font-medium text-app-text"
      )}
    >
      {label}
    </button>
  );
}

function SectionHeader({ title, onMore, moreHref }: { title: string; onMore?: () => void; moreHref?: string }) {
  const moreClass = "text-[13px] font-semibold text-app-muted";
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-5">
      <h2 className="text-[16px] font-bold text-app-text">{title}</h2>
      {moreHref ? (
        <Link href={moreHref} className={moreClass}>
          더보기 ›
        </Link>
      ) : onMore ? (
        <button type="button" onClick={onMore} className={moreClass}>
          더보기 ›
        </button>
      ) : null}
    </div>
  );
}

function RecommendSkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center border-b border-app-line px-4 py-3">
          <div className="flex-1 pr-3">
            <span className="block h-4 w-[70%] animate-pulse rounded bg-app-surface" />
            <span className="mt-2 block h-3.5 w-[45%] animate-pulse rounded bg-app-surface" />
          </div>
          <span className="h-14 w-14 animate-pulse rounded-lg bg-app-surface" />
        </div>
      ))}
    </div>
  );
}

const SearchClient = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("all");

  // 검색 결과
  const { data, isLoading, error, mutate } = useSWR<SearchResponse>(
    searchQuery ? `/api/search?q=${encodeURIComponent(searchQuery)}&type=${activeTab}` : null
  );

  // 검색 전 추천 콘텐츠(검색어가 없을 때만)
  const recommendProductsQuery = useSWR<RecommendProductsResponse>(
    !searchQuery ? "/api/products?page=1" : null
  );
  const recommendPostsQuery = useSWR<RecommendPostsResponse>(
    !searchQuery ? "/api/posts?page=1" : null
  );

  const runSearch = (q: string) => {
    setKeyword(q);
    setSearchQuery(q);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = keyword.trim();
    if (!q) {
      setSearchQuery("");
      return;
    }
    trackEvent(ANALYTICS_EVENTS.searchSubmitted, { query: q, activeTab });
    setSearchQuery(q);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setKeyword("");
    setSearchQuery("");
    inputRef.current?.focus();
  };

  const selectTab = (nextTab: SearchTab) => {
    if (activeTab === nextTab) return;
    trackEvent(ANALYTICS_EVENTS.searchTabChanged, { from: activeTab, to: nextTab, query: searchQuery });
    setActiveTab(nextTab);
  };

  const hasResults =
    data && (data.products.length > 0 || data.posts.length > 0 || data.users.length > 0);
  const totalResults = data ? data.products.length + data.posts.length + data.users.length : 0;

  const renderResults = () => {
    if (!data || !hasResults) return null;
    return (
      <div className="pb-20">
        {data.products.length > 0 && (activeTab === "all" || activeTab === "products") ? (
          <section>
            {activeTab === "all" ? <SectionHeader title="분양" onMore={() => selectTab("products")} /> : null}
            {data.products.map((product) => (
              <ResultRow
                key={product.id}
                href={getProductPath(product.id, product.name)}
                title={product.name}
                description={formatProductPrice(product.price)}
                meta={[product.category, productStatusLabel(product.status)].filter(Boolean).join(" · ")}
                imageId={product.photos?.[0]}
                imageVariant="product"
              />
            ))}
          </section>
        ) : null}

        {data.posts.length > 0 && (activeTab === "all" || activeTab === "posts") ? (
          <section>
            {activeTab === "all" ? <SectionHeader title="게시글" onMore={() => selectTab("posts")} /> : null}
            {data.posts.map((post) => (
              <ResultRow
                key={post.id}
                href={toPostPath(post.id, post.title)}
                title={post.title}
                description={toPostPlainText(post.description)}
                meta={`${post.user.name} · 좋아요 ${post._count.Likes} · 댓글 ${post._count.comments}`}
                imageId={post.image}
              />
            ))}
          </section>
        ) : null}

        {data.users.length > 0 && (activeTab === "all" || activeTab === "users") ? (
          <section>
            {activeTab === "all" ? <SectionHeader title="유저" onMore={() => selectTab("users")} /> : null}
            {data.users.map((user) => (
              <Link
                key={user.id}
                href={`/profiles/${user.id}`}
                className="flex items-center gap-3 border-b border-app-line bg-app-bg px-4 py-3"
              >
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-app-surface">
                  {user.avatar ? (
                    <Image
                      src={makeImageUrl(user.avatar, "avatar")}
                      alt=""
                      width={44}
                      height={44}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-app-text">
                  {user.name}
                </span>
              </Link>
            ))}
          </section>
        ) : null}
      </div>
    );
  };

  const renderRecommend = () => {
    const products = recommendProductsQuery.data?.products;
    const posts = recommendPostsQuery.data?.posts;
    // 추천 상품·게시글이 모두 조회 실패하면 스켈레톤 대신 오류 상태를 보인다.
    const isRecommendError =
      !products && !posts && Boolean(recommendProductsQuery.error) && Boolean(recommendPostsQuery.error);
    const isLoadingRecommend = !products && !posts && !isRecommendError;

    return (
      <div className="pb-20">
        {/* 인기 검색어 */}
        <div className="px-4 pt-3">
          <h2 className="text-[16px] font-bold text-app-text">인기 검색어</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {POPULAR_KEYWORDS.map((kw) => (
              <TextChip
                key={kw}
                label={kw}
                filled
                onClick={() => {
                  trackEvent(ANALYTICS_EVENTS.searchKeywordQuickSelected, { keyword: kw });
                  runSearch(kw);
                }}
              />
            ))}
          </div>
          <p className="mt-3 text-[13px] text-app-muted">대분류로 검색하면 하위 분류까지 함께 찾아줘요.</p>
        </div>

        {/* 카테고리 — 텍스트 칩 1줄 가로 스크롤 */}
        <SectionHeader title="카테고리" />
        <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
          {TOP_LEVEL_CATEGORIES.map((cat) => (
            <TextChip
              key={cat.id}
              label={cat.name}
              onClick={() => {
                trackEvent(ANALYTICS_EVENTS.searchCategoryQuickSelected, { category: cat.name });
                runSearch(cat.name);
              }}
            />
          ))}
        </div>

        {/* 추천 상품(가로 스크롤) */}
        {products && products.length > 0 ? (
          <section>
            <SectionHeader title="추천 분양" moreHref="/products" />
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
              {products.slice(0, 10).map((p) => (
                <Link key={p.id} href={getProductPath(p.id, p.name)} className="w-36 shrink-0">
                  <div className="relative h-36 w-36 overflow-hidden rounded-xl bg-app-surface">
                    {p.photos?.[0] ? (
                      <Image
                        src={makeImageUrl(p.photos[0], "product")}
                        alt={p.name}
                        fill
                        sizes="144px"
                        className="object-cover"
                      />
                    ) : null}
                    {p.status && p.status !== "판매중" ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-app-overlay">
                        <span className="text-[13px] font-bold text-white">{productStatusLabel(p.status)}</span>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-[14px] text-app-text">{p.name}</p>
                  <p className="mt-0.5 text-[16px] font-bold text-app-text">{formatProductPrice(p.price)}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* 최근 게시글 */}
        {posts && posts.length > 0 ? (
          <section>
            <SectionHeader title="최근 게시글" moreHref="/posts" />
            {posts.slice(0, 5).map((post) => (
              <ResultRow
                key={post.id}
                href={toPostPath(post.id, post.title)}
                title={post.title}
                description={toPostPlainText(post.description)}
                meta={`${post.user?.name ?? "익명"} · 좋아요 ${post._count?.Likes ?? 0} · 댓글 ${post._count?.comments ?? 0}`}
                imageId={post.image}
              />
            ))}
          </section>
        ) : null}

        {isLoadingRecommend ? <RecommendSkeleton /> : null}
        {isRecommendError ? (
          <QueryErrorState
            title="추천 콘텐츠를 불러오지 못했어요"
            onRetry={() => {
              void recommendProductsQuery.mutate();
              void recommendPostsQuery.mutate();
            }}
          />
        ) : null}
      </div>
    );
  };

  let body: ReactNode;
  if (!searchQuery) body = renderRecommend();
  else if (isLoading)
    body = (
      <div className="flex justify-center py-20">
        <span
          role="status"
          aria-label="검색 중"
          className="h-6 w-6 animate-spin rounded-full border-2 border-app-border border-t-app-brand"
        />
      </div>
    );
  else if (error && !data)
    body = (
      <QueryErrorState
        title="검색 결과를 불러오지 못했어요"
        onRetry={() => void mutate()}
        className="py-[72px]"
      />
    );
  else if (!hasResults)
    body = (
      <div className="px-4 py-[72px] text-center">
        <p className="text-[16px] font-semibold text-app-text">검색 결과가 없습니다</p>
        <p className="mt-1.5 text-[14px] text-app-muted">다른 키워드로 검색해 보세요</p>
      </div>
    );
  else body = renderResults();

  return (
    <Layout canGoBack title="검색" seoTitle="검색" headerRight={<></>}>
      {/* 검색 pill */}
      <form onSubmit={handleSubmit} className="px-4 pb-2 pt-3" role="search">
        <div className="flex h-11 items-center rounded-[22px] bg-app-surface px-3.5">
          <svg className="h-5 w-5 shrink-0 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="분양, 게시글, 유저를 검색해보세요"
            aria-label="검색어"
            className="ml-2 h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-app-text placeholder:text-app-caption focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
            autoFocus
          />
          {keyword ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label="검색어 지우기"
              className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-app-caption"
            >
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </form>

      {/* 탭(검색 후) */}
      {searchQuery ? (
        <div className="flex gap-2 border-b border-app-line px-4 pb-3">
          {SEARCH_TABS.map((tab) => (
            <TextChip
              key={tab.id}
              label={tab.name}
              selected={activeTab === tab.id}
              onClick={() => selectTab(tab.id)}
            />
          ))}
        </div>
      ) : null}

      {/* 검색 결과 건수 */}
      {searchQuery && !isLoading && data ? (
        <p className="px-4 py-2.5 text-[13px] text-app-muted">
          <span className="font-semibold text-app-text">&quot;{searchQuery}&quot;</span>
          {` 검색 결과 ${totalResults}건`}
        </p>
      ) : null}

      {body}
    </Layout>
  );
};

export default SearchClient;
