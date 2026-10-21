"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import useSWRInfinite from "swr/infinite";

import Layout from "@components/features/MainLayout";
import { PostCard } from "@components/app/PostCard";
import { ASK_QUESTION_HREF, WAITING_BONUS_LINE } from "@components/features/post/AwaitingAnswerCard";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath } from "hooks/useCategoryScope";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { UnansweredPostsResponse } from "pages/api/posts";

const PAGE_SIZE = 20;

function SkeletonItem() {
  return (
    <div className="border-b border-app-line px-4 py-3.5">
      <div className="h-3 w-[30%] rounded bg-app-surface" />
      <div className="mt-2 h-4 w-[70%] rounded bg-app-surface" />
      <div className="mt-2 h-3.5 w-[90%] rounded bg-app-surface" />
    </div>
  );
}

/**
 * 답 기다리는 질문 모아 보기(홈 '답 기다려요' 카드 아래 '답 기다리는 질문 N개 ›', 2026-10-21 감사 #1).
 * 7일 안 질문 중 질문자가 아닌 사람의 댓글이 없는 것, 오래 기다린 순. 관심 카테고리 고정 범위를 따른다.
 * 빈 상태(2026-10-21 디자인 리뷰): '모든 질문에 답이 달렸어요' 18/700 + 안내 + '질문하기' 48 주황, 점수 2배 줄은 숨긴다.
 * 앱: src/app/posts/unanswered.tsx
 */
export default function UnansweredClient() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scope = useCategoryScope();
  const { blockedIds } = useBlocks();

  const getKey = (pageIndex: number, previous: UnansweredPostsResponse | null) => {
    if (previous && (previous.posts.length === 0 || pageIndex >= previous.pages)) return null;
    return withCategoryPath(
      `/api/posts?unanswered=1&limit=${PAGE_SIZE}&page=${pageIndex + 1}`,
      scope.categoryPath
    );
  };
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<UnansweredPostsResponse>(getKey, {
    revalidateFirstPage: false,
  });
  const loadedPages = data?.length ?? 0;
  const hasMore =
    Boolean(data?.[loadedPages - 1]?.posts.length) && loadedPages < (data?.[0]?.pages ?? 0);

  // 바닥 감시 칸이 보이면 다음 페이지 하나만 받는다(공지 목록과 같다).
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || error) return;
    const observer = new IntersectionObserver(
      (entries, self) => {
        if (!entries[0]?.isIntersecting || isValidating) return;
        self.disconnect();
        void setSize(loadedPages + 1);
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, error, isValidating, loadedPages, setSize]);

  // 페이지 사이에 답이 달리면 같은 글이 다음 페이지에 또 올 수 있어 id 로 거른다. 공개 캐시라 차단도 여기서 거른다.
  const posts = useMemo(() => {
    const seen = new Set<number>();
    const rows = (data ?? [])
      .flatMap((pageData) => pageData?.posts ?? [])
      .filter((post) => {
        if (seen.has(post.id)) return false;
        seen.add(post.id);
        return true;
      });
    return withoutBlocked(rows, blockedIds, (post) => post.user?.id);
  }, [data, blockedIds]);

  return (
    <Layout canGoBack title="답 기다리는 질문" seoTitle="답 기다리는 질문">
      <div className="min-h-full bg-app-bg pb-4">
        {/* 빈 상태에선 점수 2배 줄을 숨긴다(답할 질문이 없는데 보상만 보이지 않게). */}
        {data?.length && posts.length === 0 ? null : (
          <p className="truncate px-4 py-3 text-[13px] text-app-muted">{WAITING_BONUS_LINE}</p>
        )}
        {!data && !error ? (
          [...Array(5)].map((_, index) => <SkeletonItem key={index} />)
        ) : error && !data?.length ? (
          <QueryErrorState
            title="질문을 불러오지 못했어요"
            onRetry={() => void mutate()}
            className="py-14"
          />
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center px-4 pb-14 pt-[72px] text-center">
            <p className="app-t-section">모든 질문에 답이 달렸어요</p>
            <p className="app-t-body mt-1.5 break-keep text-app-muted">궁금한 게 있으면 먼저 물어보세요</p>
            <Link
              href={ASK_QUESTION_HREF}
              className="mt-5 flex h-12 items-center rounded-lg bg-app-brand px-7 text-[15px] font-semibold text-white"
            >
              질문하기
            </Link>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
        {data?.length ? (
          <RetryFooter
            loading={Boolean(size > data.length && isValidating && !error)}
            error={Boolean(error)}
            onRetry={() => void mutate()}
          />
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>
    </Layout>
  );
}
