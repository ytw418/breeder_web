"use client";
/**
 * 이 혈통 분양글 — PRD S-4b(앱 bloodline-management/card/[cardId]/listings.tsx).
 * 비보유자 상세의 "이 혈통 분양글 N개 ›"에서 들어온다. GET /api/products?bloodlineRootId={id}.
 * 헤더 "이 혈통 분양글" → ProductCard 행(상대시간 메타), 끝에 닿으면 다음 페이지. 빈 "아직 분양글이 없어요".
 */
import { useEffect, useMemo, useRef } from "react";
import useSWRInfinite from "swr/infinite";
import Layout from "@components/features/MainLayout";
import { ProductCard } from "@components/app/ProductCard";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import { BloodlineHeader } from "@components/features/bloodline/BloodlineScreenParts";
import { filterBloodlineListingsPage } from "@libs/client/bloodlineRecipients";
import type { ProductsResponse } from "@libs/shared/home";

const PAGE_SIZE = 20;

const parseCardId = (value: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

function EmptyText({ message }: { message: string }) {
  return <p className="px-4 py-20 text-center text-[14px] leading-5 text-app-muted">{message}</p>;
}

export default function ListingsClient({ cardId }: { cardId: string }) {
  const id = parseCardId(cardId);
  const getKey = (index: number, previous: ProductsResponse | null) => {
    if (!id) return null;
    if (previous) {
      const filtered = filterBloodlineListingsPage(id, index, previous);
      if (index >= filtered.pages) return null;
    }
    return `/api/products?bloodlineRootId=${id}&page=${index + 1}&size=${PAGE_SIZE}`;
  };
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<ProductsResponse>(getKey, {
    revalidateFirstPage: false,
  });

  const products = useMemo(() => {
    if (!id) return [];
    const seen = new Set<number>();
    return (data ?? [])
      .flatMap((page, index) => filterBloodlineListingsPage(id, index + 1, page).products)
      .filter((product) => {
        if (seen.has(product.id)) return false;
        seen.add(product.id);
        return true;
      });
  }, [data, id]);

  const lastPage = data?.[data.length - 1];
  const totalPages = id && lastPage ? filterBloodlineListingsPage(id, data!.length, lastPage).pages : 0;
  const hasMore = Boolean(data) && (data?.length ?? 0) < totalPages;
  const loadingMore = Boolean(data) && size > (data?.length ?? 0) && isValidating && !error;

  // 목록 끝에 닿으면 다음 페이지(앱 onEndReached).
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || loadingMore || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void setSize((current) => current + 1);
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, error, setSize]);

  return (
    <Layout headerVariant="none" seoTitle="이 혈통 분양글">
      <BloodlineHeader title="이 혈통 분양글" />
      {!id ? (
        <EmptyText message="혈통을 찾을 수 없어요" />
      ) : !data && !error ? (
        <div role="status" aria-label="불러오는 중">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 px-4 py-3">
              <span className="h-[100px] w-[100px] animate-pulse rounded-lg bg-app-placeholder" />
              <span className="flex flex-1 flex-col gap-2 pt-1">
                <span className="h-4 w-3/4 animate-pulse rounded bg-app-placeholder" />
                <span className="h-3.5 w-1/2 animate-pulse rounded bg-app-placeholder" />
              </span>
            </div>
          ))}
        </div>
      ) : error && !data ? (
        <QueryErrorState onRetry={() => void mutate()} />
      ) : products.length === 0 ? (
        <EmptyText message="아직 분양글이 없어요" />
      ) : (
        <div className="pb-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={{
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.photos?.[0],
                createdAt: product.createdAt,
                category: product.category,
                status: product.status,
                wishCount: product._count?.favs,
                sellerId: product.userId,
                seller: product.user ?? null,
              }}
            />
          ))}
          <RetryFooter loading={loadingMore} error={Boolean(error)} onRetry={() => void mutate()} />
          <div ref={sentinelRef} aria-hidden="true" />
        </div>
      )}
    </Layout>
  );
}
