"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";

import Layout from "@components/features/MainLayout";
import { PostCard } from "@components/app/PostCard";
import { QueryErrorState } from "@components/app/QueryErrorState";
import useBlocks from "hooks/useBlocks";
import { cn } from "@libs/client/utils";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { PostsListResponse } from "pages/api/posts";
import useCategoryScope from "hooks/useCategoryScope";
import { orderEvergreenFields } from "@libs/shared/debateFormat";
import { EVERGREEN_KEY, EvergreenRow, type EvergreenResponse } from "@components/features/debate/EvergreenDebateSection";

type Tab = "evergreen" | "open" | "ended";
const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "evergreen", label: "상시", href: "/debates" },
  { id: "open", label: "진행 중", href: "/debates?tab=open" },
  { id: "ended", label: "끝난 토론", href: "/debates?tab=ended" },
];

/**
 * 토론 모아보기(2026-10-15 사용자 "역대 토론 모아보기" — 홈 '실시간 TOP 토론' 오른쪽 '모아보기 ›'). 앱 src/app/debates.tsx 와 같다.
 * 위 '토론 열기' 카드 → 상시 / 진행 중 / 끝난 토론 탭(밑줄) → 토론 카드 목록(전체 게시글의 토론 카드와 같은 모양, 바로 고를 수 있다).
 * '상시'(맨 앞·기본, 앱 docs/prd/evergreen-debate.md S-6)는 분야 칩 + 상시 토론 줄(반려생활 탭과 같은 줄).
 */
export default function DebatesClient() {
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params?.get("tab");
  const tab: Tab = tabParam === "ended" ? "ended" : tabParam === "open" ? "open" : "evergreen";
  const { blockedIds } = useBlocks();

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<PostsListResponse>(
    (index, previous) =>
      tab === "evergreen" || (previous && index >= (previous.pages ?? 0))
        ? null
        : `/api/posts?category=${encodeURIComponent("토론")}&debateStatus=${tab}&page=${index + 1}`,
    { revalidateFirstPage: false }
  );
  const posts = useMemo(
    () => withoutBlocked(data?.flatMap((page) => page.posts ?? []) ?? [], blockedIds, (post) => post.user?.id),
    [data, blockedIds]
  );
  const totalPages = data?.[0]?.pages ?? 0;
  const hasMore = size < totalPages;
  const loading = !data && !error;

  // 상시 탭
  const scope = useCategoryScope();
  const { data: evergreenData, error: evergreenError, mutate: reloadEvergreen } = useSWR<EvergreenResponse>(
    tab === "evergreen" ? EVERGREEN_KEY : null,
    { revalidateOnFocus: false }
  );
  const evergreenPosts = useMemo(
    () =>
      withoutBlocked(evergreenData?.posts ?? [], blockedIds, (post) => post.user?.id).filter((post) => post.debate?.evergreen),
    [evergreenData, blockedIds]
  );
  const fieldChips = useMemo(
    () => [
      { key: "", label: "전체" },
      ...orderEvergreenFields(Array.from(new Set(evergreenPosts.map((post) => post.debate!.evergreen!.field))), scope.pins),
    ],
    [evergreenPosts, scope.pins]
  );
  const [field, setField] = useState("");
  const evergreenRows = field ? evergreenPosts.filter((post) => post.debate!.evergreen!.field === field) : evergreenPosts;

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || error) return;
    const observer = new IntersectionObserver(
      (entries, self) => {
        if (!entries[0]?.isIntersecting || isValidating) return;
        self.disconnect();
        void setSize(size + 1);
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, error, isValidating, size, setSize]);

  return (
    <Layout canGoBack title="토론 모아보기" seoTitle="토론 모아보기">
      <div className="pb-[calc(24px+env(safe-area-inset-bottom))]">
        {/* 토론 열기 */}
        <Link
          href="/posts/debate"
          className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-app-brand-soft px-3.5 py-3"
          data-testid="debates-open-card"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold leading-5 text-app-brand-text">궁금한 걸 찬반으로 물어보세요</span>
            <span className="mt-0.5 block text-[12px] leading-4 text-app-brand-text-soft">
              골라야 결과가 보이고, 끝나면 이긴 쪽을 알려 드려요
            </span>
          </span>
          <span className="flex h-9 shrink-0 items-center rounded-lg bg-app-brand px-3.5 text-[14px] font-semibold text-white">
            토론 열기
          </span>
        </Link>

        {/* 탭(밑줄) */}
        <div role="tablist" aria-label="토론 상태" className="mt-3 flex border-b border-app-line px-4">
          {TABS.map((item) => {
            const on = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => router.replace(item.href, { scroll: false })}
                className={cn(
                  "-mb-px mr-5 h-11 border-b-2 text-[15px]",
                  on ? "border-app-text font-semibold text-app-text" : "border-transparent text-app-muted"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "evergreen" ? (
          evergreenError && !evergreenData ? (
            <QueryErrorState title="토론을 불러오지 못했어요" onRetry={() => void reloadEvergreen()} className="py-10" />
          ) : !evergreenData ? (
            <div className="space-y-3 px-4 py-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-app-placeholder" />
              ))}
            </div>
          ) : evergreenPosts.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-[15px] font-semibold text-app-text">아직 상시 토론이 없어요</p>
              <p className="mt-1 text-[13px] text-app-muted">분야마다 늘 열려 있는 토론이 곧 올라와요</p>
            </div>
          ) : (
            <div className="px-4 pt-3">
              <div className="app-rail -mx-4 flex gap-1 px-4">
                {fieldChips.map((chip) => (
                  <button
                    key={chip.key || "all-fields"}
                    type="button"
                    onClick={() => setField(chip.key)}
                    className={cn(
                      "h-7 shrink-0 rounded-lg px-3 text-[13px]",
                      chip.key === field ? "bg-app-inverse font-semibold text-app-inverse-text" : "bg-app-surface font-medium text-app-sub"
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              {evergreenRows.map((post, index) => (
                <EvergreenRow key={post.id} post={post} last={index === evergreenRows.length - 1} />
              ))}
            </div>
          )
        ) : error && !data ? (
          <QueryErrorState title="토론을 불러오지 못했어요" onRetry={() => void mutate()} className="py-10" />
        ) : loading ? (
          <div className="space-y-3 px-4 py-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 border-b border-app-line pb-4">
                <div className="h-3.5 w-1/3 animate-pulse rounded bg-app-placeholder" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-app-placeholder" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-app-placeholder" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-app-text">
              {tab === "open" ? "진행 중인 토론이 없어요" : "아직 끝난 토론이 없어요"}
            </p>
            <p className="mt-1 text-[13px] text-app-muted">
              {tab === "open" ? "첫 토론을 열어 보세요" : "토론이 끝나면 결과와 함께 여기 모여요"}
            </p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            <div ref={sentinelRef} aria-hidden="true" className="h-4" />
          </>
        )}
      </div>
    </Layout>
  );
}
