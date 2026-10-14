"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";

import { QueryErrorState } from "@components/app/QueryErrorState";
import useBlocks from "hooks/useBlocks";
import useCategoryScope, { withCategoryPath } from "hooks/useCategoryScope";
import { toPostPath } from "@libs/post-route";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { withoutBlocked } from "@libs/shared/blockFilter";
import type { PostsListResponse } from "pages/api/posts";
import type { NoticePostsResponse } from "pages/api/posts/notices";
import type { HotDiscussionItem } from "@libs/shared/ranking";
import RealtimeHotRail, {
  RealtimeHotRailSkeleton,
  type RealtimeHotItem,
} from "@components/features/post/RealtimeHotRail";
import AwaitingAnswerCard from "@components/features/post/AwaitingAnswerCard";
import type { HotRealtimeMeta, UnansweredSummary } from "@libs/shared/communityVibe";

type RealtimePostsResponse = {
  success?: boolean;
  posts?: (PostsListResponse["posts"][number] & Partial<HotRealtimeMeta>)[];
};
type UnansweredResponse = { success?: boolean; posts?: PostsListResponse["posts"] } & Partial<UnansweredSummary>;
/** HOT 토론은 상위 3개만 보여 준다(앱 d8f0211). */
const HOT_DISCUSSION_COUNT = 3;
const NOTICE_FALLBACK_TITLE = "게시글 작성 전 커뮤니티 운영 가이드를 확인해 주세요.";

/**
 * 홈 위쪽 커뮤니티(docs/prd/home-ia.md S-1 2·3·4번, 2026-10-15 홈 구성 A안 — 앱 (tabs)/index.tsx·HomeRealtimeSection 과 같다).
 * 공지 한 줄 → '실시간 TOP 토론' 사진 레일 → '답 기다려요' 카드.
 * 옛 반려생활 세그먼트(실시간 TOP 토론 · 답 기다려요 · 동네 · 랭킹)는 없앴다. 동네·랭킹은 홈의 '우리 동네 브리더'·'이번 주 TOP 브리더'가 맡는다.
 */
export default function HomeCommunityTop() {
  const { blockedIds } = useBlocks();
  // 관심 카테고리 고정 범위(앱 category-pin). 실시간 토론도 같은 범위를 쓴다.
  const scope = useCategoryScope();
  const { data: noticeData } = useSWR<NoticePostsResponse>("/api/posts/notices");
  // 실시간 TOP 토론: 최근 24시간 활동 점수순(서버 hot=realtime). 구 서버면 home/feed 의 HOT 토론으로 대신한다.
  const {
    data: realtimeData,
    error: realtimeError,
    mutate: mutateRealtime,
  } = useSWR<RealtimePostsResponse>(
    withCategoryPath(`/api/posts?hot=realtime&limit=${HOT_DISCUSSION_COUNT}`, scope.categoryPath),
    { revalidateOnFocus: false }
  );
  const realtimeUnsupported = Boolean(
    realtimeError || (realtimeData && !realtimeData.posts?.some((post) => post.lastActivityAt))
  );
  const { data: homeFeedData } = useSWR<{ hotDiscussions: HotDiscussionItem[] }>(
    realtimeUnsupported ? withCategoryPath("/api/home/feed?scope=public", scope.categoryPath) : null,
    { revalidateOnFocus: false }
  );
  // 답 기다려요: 가장 오래 답 없는 질문 1개.
  const { data: unansweredData } = useSWR<UnansweredResponse>("/api/posts?unanswered=1&limit=1", {
    revalidateOnFocus: false,
  });

  // 공개 캐시 응답(HOT 토론)은 서버가 차단을 거르지 않아 여기서 거른다.
  const hotItems = useMemo<RealtimeHotItem[] | undefined>(() => {
    if (!realtimeUnsupported) {
      if (!realtimeData) return undefined;
      return withoutBlocked(realtimeData.posts ?? [], blockedIds, (post) => post.user?.id)
        .slice(0, HOT_DISCUSSION_COUNT)
        .map((post) => ({
          id: post.id,
          title: post.title,
          image: post.images?.[0] ?? post.image ?? null,
          authorName: post.user?.name ?? "",
          comments: post._count?.comments ?? 0,
          lastActivityAt: post.lastActivityAt ?? String(post.createdAt),
          lastActivityKind: post.lastActivityKind ?? "post",
        }));
    }
    if (!homeFeedData) return undefined;
    return withoutBlocked(homeFeedData.hotDiscussions ?? [], blockedIds, (item) => item.user?.id)
      .slice(0, HOT_DISCUSSION_COUNT)
      .map((item) => ({
        id: item.id,
        title: item.title,
        image: item.image || null,
        authorName: item.user?.name ?? "",
        comments: item.commentsCount,
        lastActivityAt: item.createdAt,
        lastActivityKind: "post" as const,
      }));
  }, [realtimeUnsupported, realtimeData, homeFeedData, blockedIds]);
  const awaitingQuestion = useMemo(
    () => withoutBlocked(unansweredData?.posts ?? [], blockedIds, (post) => post.user?.id)[0] ?? null,
    [unansweredData, blockedIds]
  );

  const noticePost = noticeData?.posts?.[0] ?? null;
  const noticeHref = noticePost ? toPostPath(noticePost.id, noticePost.title) : "/posts/notices";
  const noticeTitle = noticePost?.title ?? NOTICE_FALLBACK_TITLE;

  return (
    <>
      {/* 공지 한 줄(높이 40) */}
      <div className="px-4 pt-1">
        <Link
          href={noticeHref}
          aria-label="공지 보기"
          className="flex h-10 items-center gap-2 rounded-lg bg-app-gap px-3"
        >
          <span className="shrink-0 text-[12px] font-bold text-app-text">공지</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-app-sub">{noticeTitle}</span>
          <svg className="h-3.5 w-3.5 shrink-0 text-app-caption" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      </div>

      {/* 실시간 TOP 토론 + 답 기다려요 */}
      <section className="pb-2 pt-5" data-home-section="realtime_discussion">
        <h2 className="app-t-section px-4">실시간 TOP 토론</h2>
        <div className="mt-3">
          {realtimeError && homeFeedData === undefined && !hotItems ? (
            <QueryErrorState
              title="실시간 토론을 불러오지 못했어요"
              onRetry={() => void mutateRealtime()}
              className="py-6"
            />
          ) : !hotItems ? (
            <RealtimeHotRailSkeleton />
          ) : hotItems.length > 0 ? (
            <RealtimeHotRail
              items={hotItems}
              onOpen={(item, index) =>
                trackEvent(ANALYTICS_EVENTS.postsHotDiscussionClicked, {
                  post_id: item.id,
                  post_title: item.title,
                  rank_index: index + 1,
                  comments_count: item.comments,
                })
              }
            />
          ) : (
            <div className="mx-4 rounded-xl bg-app-gap px-4 py-4">
              <p className="text-[15px] font-semibold text-app-text">지금 첫 토론을 열어 보세요</p>
              <p className="mt-0.5 text-[13px] text-app-muted">
                댓글이 달리면 여기 맨 위에 실시간으로 올라와요
              </p>
              <Link
                href="/posts/upload"
                className="mt-3 inline-flex h-9 items-center rounded-lg bg-app-inverse px-3.5 text-[14px] font-semibold text-app-inverse-text"
              >
                글쓰기
              </Link>
            </div>
          )}
          {awaitingQuestion ? <AwaitingAnswerCard question={awaitingQuestion} className="mx-4 mt-4" /> : null}
        </div>
      </section>
    </>
  );
}
