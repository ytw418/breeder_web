"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";

import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath } from "hooks/useCategoryScope";
import { withoutBlocked } from "@libs/shared/blockFilter";
import { toPostPath } from "@libs/post-route";
import type { PostsListResponse } from "pages/api/posts";

/** 이번 주 답이 많이 달린 질문(서버: 7일 안 질문 글, 보이는 댓글이 있는 글만, 댓글 수순). */
export const POPULAR_QUESTIONS_KEY = "/api/posts?category=%EC%A7%88%EB%AC%B8&sort=comments&days=7&limit=3";
const QUESTIONS_HREF = `/?category=${encodeURIComponent("질문")}&at=list`;

/**
 * 반려생활 '인기 질문'(앱 docs/prd/evergreen-debate.md S-2, 시안 evergreen-debate ①).
 * 행 44: '질문' pill 20 + 제목 14/600 한 줄 + '답 N' 12 muted. 0개면 섹션 없음.
 * 앱 src/components/features/post/PopularQuestionsSection.tsx 와 같다.
 */
export default function PopularQuestionsSection() {
  const { blockedIds } = useBlocks();
  const scope = useCategoryScope();
  const { data } = useSWR<PostsListResponse>(withCategoryPath(POPULAR_QUESTIONS_KEY, scope.categoryPath), {
    revalidateOnFocus: false,
  });
  const posts = useMemo(
    () => withoutBlocked(data?.posts ?? [], blockedIds, (post) => post.user?.id).slice(0, 3),
    [data, blockedIds]
  );
  if (!posts.length) return null;
  return (
    <section className="px-4 pt-4" data-home-section="popular_questions">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[16px] font-bold leading-[22px] tracking-[-0.3px] text-app-text">인기 질문</h2>
        <span className="truncate text-[13px] leading-[18px] text-app-muted">이번 주 답이 많이 달린</span>
        <Link href={QUESTIONS_HREF} className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[13px] text-app-muted">
          전체
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      </div>
      <ul className="mt-1">
        {posts.map((post, index) => (
          <li key={post.id} className={index < posts.length - 1 ? "border-b border-app-line" : undefined}>
            <Link href={toPostPath(post.id, post.title)} className="flex h-11 items-center gap-2">
              <span className="inline-flex h-5 shrink-0 items-center rounded-lg bg-app-brand-soft px-1.5 text-[11px] font-semibold text-app-brand-text">
                질문
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-app-text">{post.title}</span>
              <span className="shrink-0 text-[12px] text-app-muted tabular-nums">답 {post._count?.comments ?? 0}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
