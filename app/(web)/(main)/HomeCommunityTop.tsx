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
import { noticeBandTitle, pickBandNotice } from "@libs/shared/noticeBand";
import { markNoticeBandSeen, useNoticeBandSeen } from "@libs/client/noticeBandSeen";
import { useSeenMarks } from "@libs/client/unreadMarks";
import type { HotRealtimeMeta, UnansweredSummary } from "@libs/shared/communityVibe";
import type { HomeDebateResult } from "@libs/shared/liveTalk";
import HomeDebateCard, { HomeDebateCardSkeleton } from "@components/features/debate/HomeDebateCard";
import { DEBATE_CATEGORY } from "@libs/shared/debateFormat";

type RealtimePostsResponse = {
  success?: boolean;
  posts?: (PostsListResponse["posts"][number] & Partial<HotRealtimeMeta>)[];
};
type UnansweredResponse = { success?: boolean; posts?: PostsListResponse["posts"] } & Partial<UnansweredSummary>;
/** HOT 토론은 상위 3개만 보여 준다(앱 d8f0211). */
const HOT_DISCUSSION_COUNT = 3;
const HOT_FETCH_COUNT = 8;

/**
 * 홈 위쪽 커뮤니티(docs/prd/home-ia.md S-1 2·3·4번, 2026-10-15 홈 구성 A안 — 앱 (tabs)/index.tsx·HomeRealtimeSection 과 같다).
 * 공지 한 줄 → '실시간 TOP 토론' 사진 레일 → '답 기다려요' 카드.
 * 옛 반려생활 세그먼트(실시간 TOP 토론 · 답 기다려요 · 동네 · 랭킹)는 없앴다. 동네·랭킹은 홈의 '우리 동네 브리더'·'이번 주 TOP 브리더'가 맡는다.
 * noticeOnly 면 공지 한 줄만 그린다(반려생활 탭 v3 — 실시간 토론·답 기다려요 자리는 상시 토론·인기 질문이 맡는다).
 */
export default function HomeCommunityTop({ noticeOnly = false }: { noticeOnly?: boolean } = {}) {
  const { blockedIds } = useBlocks();
  // 관심 카테고리 고정 범위(앱 category-pin). 실시간 토론도 같은 범위를 쓴다.
  const scope = useCategoryScope();
  // 공지 띠: 14일 안 공지만(band=1). 띠에서 열었거나 상세를 연 공지는 숨긴다(libs/shared/noticeBand).
  const { data: noticeData, error: noticeError } = useSWR<NoticePostsResponse>("/api/posts/notices?band=1");
  const bandSeen = useNoticeBandSeen();
  const seenMarks = useSeenMarks();
  // 실시간 TOP 토론: 최근 24시간 활동 점수순(서버 hot=realtime). 구 서버면 home/feed 의 HOT 토론으로 대신한다.
  const {
    data: realtimeData,
    error: realtimeError,
    mutate: mutateRealtime,
  } = useSWR<RealtimePostsResponse>(
    // 레일엔 토론 글을 넣지 않으니(맨 위 카드·모아보기가 맡는다) 넉넉히 받아 3장을 채운다(앱과 같다).
    noticeOnly ? null : withCategoryPath(`/api/posts?hot=realtime&limit=${HOT_FETCH_COUNT}`, scope.categoryPath),
    { revalidateOnFocus: false }
  );
  const realtimeUnsupported = Boolean(
    realtimeError || (realtimeData && !realtimeData.posts?.some((post) => post.lastActivityAt))
  );
  const { data: homeFeedData } = useSWR<{ hotDiscussions: HotDiscussionItem[] }>(
    realtimeUnsupported && !noticeOnly ? withCategoryPath("/api/home/feed?scope=public", scope.categoryPath) : null,
    { revalidateOnFocus: false }
  );
  // 맨 위 토론 카드: 진행 중 토론 중 내가 안 고른 것의 활동 점수 1위(live-talk §3.2). 없으면 레일만.
  const {
    data: homeDebateData,
    error: homeDebateError,
    mutate: mutateHomeDebate,
  } = useSWR<HomeDebateResult>(
    noticeOnly ? null : withCategoryPath("/api/debates/home", scope.categoryPath),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const homeDebate =
    homeDebateData?.post && !blockedIds.has(homeDebateData.post.userId) ? homeDebateData.post : null;
  // 답 기다려요: 가장 오래 답 없는 질문 1개 + 개수(관심 카테고리 범위). 없으면 '물어보기' 카드.
  const { data: unansweredData, error: unansweredError } = useSWR<UnansweredResponse>(
    noticeOnly ? null : withCategoryPath("/api/posts?unanswered=1&limit=1", scope.categoryPath),
    { revalidateOnFocus: false }
  );

  // 공개 캐시 응답(HOT 토론)은 서버가 차단을 거르지 않아 여기서 거른다.
  const hotItems = useMemo<RealtimeHotItem[] | undefined>(() => {
    if (!realtimeUnsupported) {
      if (!realtimeData) return undefined;
      return withoutBlocked(realtimeData.posts ?? [], blockedIds, (post) => post.user?.id)
        // 2026-10-15 사용자 "자리를 너무 차지한다": 글자만 있는 토론 카드는 레일에서 뺀다.
        .filter((post) => post.category !== DEBATE_CATEGORY)
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

  const unansweredCount = unansweredData?.unansweredCount;
  // 답 없는 질문이 0개면 같은 자리에 '물어보기' 카드. 종 이름은 고정한 대분류가 하나일 때만(앱과 같다).
  const showAskCard = !awaitingQuestion && unansweredCount === 0;
  const askSpecies =
    scope.pins.length === 1
      ? scope.pins[0].label.split(" > ").pop() ?? null
      : scope.topLevelNames?.size === 1
        ? Array.from(scope.topLevelNames)[0]
        : null;

  // 복원 전(서버 렌더·첫 렌더)엔 띠를 그리지 않는다. 읽은 공지는 숨기고, 없으면 띠를 두지 않는다.
  const noticePost = useMemo(() => {
    if (!noticeData?.posts || !bandSeen.hydrated || !seenMarks.hydrated) return null;
    return pickBandNotice(
      noticeData.posts,
      {
        seenUpToId: bandSeen.seenUpToId,
        isSeen: (id) => Object.prototype.hasOwnProperty.call(seenMarks.seen.post, String(id)),
      },
      seenMarks.now
    );
  }, [noticeData, bandSeen, seenMarks]);

  // 아직 판단하지 못한 자리는 스켈레톤으로 잡아 데이터가 들어올 때 아래가 밀리지 않게 한다(앱 홈과 같다).
  const noticePending = !noticeError && (!noticeData || !bandSeen.hydrated || !seenMarks.hydrated);
  const homeDebatePending = !homeDebateData && !homeDebateError;
  const unansweredPending = !unansweredData && !unansweredError;

  return (
    <>
      {/* 공지 한 줄(높이 40): 14일 안 안 읽은 공지가 있을 때만 */}
      {noticePost ? (
        <div className="px-4 pt-1">
          <Link
            href={toPostPath(noticePost.id, noticePost.title)}
            onClick={() => markNoticeBandSeen(noticePost.id)}
            aria-label="공지 보기"
            className="flex h-10 items-center gap-2 rounded-lg bg-app-gap px-3"
          >
            <span className="shrink-0 text-[12px] font-bold text-app-text">공지</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-app-sub">
              {noticeBandTitle(noticePost.title, noticePost.createdAt)}
            </span>
            <svg className="h-3.5 w-3.5 shrink-0 text-app-caption" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        </div>
      ) : noticePending ? (
        <div className="px-4 pt-1" aria-hidden="true">
          <div className="h-10 animate-pulse rounded-lg bg-app-placeholder" />
        </div>
      ) : null}

      {/* 실시간 TOP 토론 + 답 기다려요 — 반려생활 탭 v3(앱 docs/prd/evergreen-debate.md S-1)은 공지만 쓴다 */}
      {noticeOnly ? null : <section className="pb-2 pt-5" data-home-section="realtime_discussion">
        {/* 오른쪽: 토론 열기(만들기) · 모아보기(진행 중·끝난 토론) — 2026-10-15 사용자 요청 */}
        <div className="flex items-end justify-between gap-3 px-4">
          <h2 className="app-t-section">실시간 TOP 토론</h2>
          <div className="flex shrink-0 items-center gap-3 text-[13px] leading-[18px]">
            <Link href="/posts/debate" className="inline-flex items-center gap-0.5 font-semibold text-app-brand-text">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              토론 열기
            </Link>
            <Link href="/debates" className="inline-flex items-center gap-0.5 text-app-muted">
              모아보기
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
        {homeDebate ? (
          <div className="mt-3">
            <HomeDebateCard post={homeDebate} onClosed={() => void mutateHomeDebate()} />
          </div>
        ) : homeDebatePending ? (
          <div className="mt-3">
            <HomeDebateCardSkeleton />
          </div>
        ) : null}
        <div className={homeDebate ? "mt-4" : "mt-3"}>
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
              rankOffset={homeDebate ? 1 : 0}
              onOpen={(item, index) =>
                trackEvent(ANALYTICS_EVENTS.postsHotDiscussionClicked, {
                  post_id: item.id,
                  post_title: item.title,
                  rank_index: index + 1,
                  comments_count: item.comments,
                })
              }
            />
          ) : homeDebate ? null : (
            <div className="mx-4 rounded-xl bg-app-gap px-4 py-4">
              <p className="text-[15px] font-semibold text-app-text">지금 첫 토론을 열어 보세요</p>
              <p className="mt-0.5 text-[13px] text-app-muted">
                댓글이 달리면 여기 맨 위에 실시간으로 올라와요
              </p>
              <Link
                href="/posts/debate"
                className="mt-3 inline-flex h-9 items-center rounded-lg bg-app-inverse px-3.5 text-[14px] font-semibold text-app-inverse-text"
              >
                토론 열기
              </Link>
            </div>
          )}
          {awaitingQuestion ? (
            <>
              <AwaitingAnswerCard question={awaitingQuestion} className="mx-4 mt-4" />
              {/* 답 기다리는 질문 모아 보기(오른쪽 정렬 13 muted) */}
              <div className="mt-2 flex justify-end px-4">
                <Link href="/posts/unanswered" className="text-[13px] leading-[18px] text-app-muted tabular-nums">
                  답 기다리는 질문 {unansweredCount ?? 1}개 ›
                </Link>
              </div>
            </>
          ) : showAskCard ? (
            <AwaitingAnswerCard variant="empty" speciesName={askSpecies} className="mx-4 mt-4" />
          ) : unansweredPending ? (
            // 카드 한 줄 제목 기준 높이(앱과 같은 78)
            <div aria-hidden="true" className="mx-4 mt-4 h-[78px] animate-pulse rounded-xl bg-app-placeholder" />
          ) : null}
        </div>
      </section>}
    </>
  );
}
