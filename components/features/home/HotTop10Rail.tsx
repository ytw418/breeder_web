"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";

import Image from "@components/atoms/Image";
import { HorizontalRail } from "@components/ui/HorizontalRail";
import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath } from "hooks/useCategoryScope";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import { withoutBlocked } from "@libs/shared/blockFilter";
import { DEBATE_CATEGORY } from "@libs/shared/debateFormat";
import { postCategoryLabel } from "@libs/shared/postCategory";
import type { PostsListResponse } from "pages/api/posts";

type HotPost = PostsListResponse["posts"][number];

/** 인기글 TOP 10 카드 아래 한 줄: 토론이면 '토론', 아니면 종(type) → 카테고리. */
export function hotTop10Meta(post: Pick<HotPost, "category" | "type" | "regionSigungu">): string {
  if (post.category === DEBATE_CATEGORY) return DEBATE_CATEGORY;
  return post.type || postCategoryLabel(post) || "";
}

/**
 * 홈 맨 위 '인기글 TOP 10'(이번 주, 앱 docs/prd/home-v2.md S-1 2번 v2, 시안 C-threads.html ①).
 * 제목 18/700 + 바로 옆 '이번 주' 13 muted. 카드 128(사이 8): 사진 128 정사각 r8 + 왼쪽 위 순위 20/800,
 * 제목 14/600 2줄 + 종·카테고리 12 muted. 사진 없는 글은 같은 자리에 brand-surface + 제목 4줄, 아래엔 메타만.
 * 서버 hot=weekly(7일 댓글·좋아요·투표 점수, 공지 제외). 조회수는 보이지 않는다. 0개·오류면 섹션 없음.
 * 앱 src/components/features/home/HotTop10Rail.tsx 와 같다.
 */
export default function HotTop10Rail() {
  const scope = useCategoryScope();
  const { blockedIds } = useBlocks();
  const { data, error } = useSWR<{ success?: boolean; posts?: HotPost[] }>(
    withCategoryPath("/api/posts?hot=weekly&limit=10", scope.categoryPath),
    { revalidateOnFocus: false }
  );
  const posts = useMemo(
    () => withoutBlocked(data?.posts ?? [], blockedIds, (post) => post.user?.id).slice(0, 10),
    [data, blockedIds]
  );
  const loading = !data && !error;

  if (!loading && posts.length === 0) return null;
  return (
    <section data-home-section="hot_top10" className="pb-5 pt-4">
      <div className="flex items-baseline gap-1.5 px-4 pb-3">
        <h2 className="app-t-section">인기글 TOP 10</h2>
        <span className="text-[13px] leading-[18px] text-app-muted">이번 주</span>
      </div>
      {loading ? (
        <div className="flex gap-2 overflow-hidden px-4" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-32 shrink-0">
              <div className="h-32 w-32 animate-pulse rounded-lg bg-app-placeholder" />
              <div className="mt-2 h-3.5 w-24 animate-pulse rounded bg-app-placeholder" />
            </div>
          ))}
        </div>
      ) : (
        <HorizontalRail label="인기글 TOP 10" className="items-start gap-2 px-4" data-testid="hot-top10-rail">
          {posts.map((post, index) => {
            const image = post.images?.[0] || post.image || null;
            const meta = hotTop10Meta(post);
            return (
              <Link
                key={post.id}
                href={toPostPath(post.id, post.title)}
                onClick={() =>
                  trackEvent(ANALYTICS_EVENTS.homeHotTop10Clicked, { post_id: post.id, position: index + 1 })
                }
                className="block w-32 shrink-0 transition-transform active:scale-[0.98]"
              >
                <span
                  className={`relative block h-32 w-32 overflow-hidden rounded-lg ${
                    image ? "bg-app-placeholder" : "bg-app-brand-surface"
                  }`}
                >
                  {image ? (
                    <Image
                      src={makeImageUrl(image, "public")}
                      alt={post.title}
                      width={128}
                      height={128}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="line-clamp-4 break-keep px-3 pt-9 text-[14px] font-bold leading-5 text-app-text">
                      {post.title}
                    </span>
                  )}
                  <span
                    className={`absolute left-2 top-1 text-[20px] font-extrabold leading-7 tabular-nums ${
                      image ? "text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.45)]" : "text-app-text"
                    }`}
                  >
                    {index + 1}
                  </span>
                </span>
                {image ? (
                  <span className="mt-2 line-clamp-2 break-keep text-[14px] font-semibold leading-5 text-app-text">
                    {post.title}
                  </span>
                ) : null}
                {meta ? (
                  <span className={`${image ? "mt-1" : "mt-2"} block truncate text-[12px] leading-4 text-app-muted`}>
                    {meta}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </HorizontalRail>
      )}
    </section>
  );
}
