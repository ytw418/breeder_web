"use client";

import type React from "react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import { ActionSheet, type ActionSheetAction } from "@components/app/ActionSheet";
import { AuthorLink } from "@components/app/AuthorLink";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import { InitialAvatar } from "@components/ui/InitialAvatar";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import { authFetch } from "@libs/client/authFetch";
import { fetchLiveComments, sendDebateComment } from "@libs/client/liveTalkApi";
import { shareOrCopy } from "@libs/client/share";
import { toast } from "@libs/client/toast";
import { cn, getTimeAgoString } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import { COMMENT_MAX_LENGTH } from "@libs/shared/comment";
import { BLOCKED_WORD_MESSAGE } from "@libs/shared/contentFilter";
import {
  activityLabel,
  durationLabel,
  isLiveActive,
  liveDividerLabel,
  mySideResultLine,
  needsLiveDivider,
  participantsLabel,
  remainingLabel,
  resultHeadline,
  sideLabel,
  switchConfirmMessage,
  switchLine,
  type DebateSide,
  type DebateSummary,
} from "@libs/shared/debateFormat";
import type { LiveComment, LiveCommentsResult, LiveSwitch } from "@libs/shared/liveTalk";
import type { ProductsResponse } from "@libs/shared/home";
import { AuthorChip, DebateGauge, DebateResult, DebateVoteButtons, StanceChip, useDebateVote } from "./DebateParts";

export type DebateDetailPost = {
  id: number;
  title: string;
  description?: string | null;
  type?: string | null;
  createdAt: string | Date;
  user?: { id: number; name: string; avatar?: string | null } | null;
  _count?: { comments?: number } | null;
};

type FlowEntry =
  | { kind: "comment"; at: string; comment: LiveComment }
  | { kind: "switch"; at: string; item: LiveSwitch };

const NEAR_BOTTOM_PX = 160;
const FRESH_MS = 1200;
const COMPOSER_MAX_HEIGHT = 112;

/** 라이브 댓글 끝 표시. 그 아래에 '더 둘러보기'가 붙어 페이지 끝이 아니라 이 자리를 '맨 아래'로 본다. */
const LIVE_END_ID = "debate-live-end";
/** 하단 고정 입력바 높이(대략). 댓글 끝이 입력바 바로 위에 오게 스크롤한다. */
const COMPOSER_BAR_PX = 88;
const liveEndTop = () => document.getElementById(LIVE_END_ID)?.getBoundingClientRect().top ?? null;
const isNearBottom = () => {
  const top = liveEndTop();
  if (top === null) {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
  }
  return top <= window.innerHeight - COMPOSER_BAR_PX + NEAR_BOTTOM_PX;
};
const scrollToBottom = (smooth = true) => {
  const top = liveEndTop();
  window.scrollTo({
    top:
      top === null
        ? document.documentElement.scrollHeight
        : Math.max(0, window.scrollY + top - (window.innerHeight - COMPOSER_BAR_PX)),
    behavior: smooth ? "smooth" : "auto",
  });
};
const isCoarsePointer = () =>
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

const SEND_ERROR: Record<string, string> = {
  DEBATE_PICK_FIRST: "먼저 한쪽을 골라 주세요",
  DEBATE_CLOSED: "끝난 토론은 읽기만 할 수 있어요",
  RATE_LIMIT: "조금 천천히 보내 주세요",
  BLOCKED_WORD: BLOCKED_WORD_MESSAGE,
};

/**
 * 찬반 토론 상세 = 라이브 댓글(앱 docs/prd/live-talk.md §3.5·§3.6, 시안 ⑤·⑥).
 * 위 블록(종·남은 시간 → 질문 20/700 → 작성자 → 설명 → 결과 영역) → 8 갭 → 라이브 댓글 흐름(오래된 → 최신, 말풍선 없음) → 입력바.
 * 3초 폴링(useLiveFeed), 새 댓글은 brand-soft 로 1.2초 강조, 맨 아래면 따라 내려가고 위면 '새 댓글 N개 ↓'.
 * 끝난 토론은 결과 카드 · 각 쪽 가장 공감받은 댓글 · 분양 줄 · 결과 공유/비슷한 토론 열기, 입력·투표 없음.
 * 앱 src/components/features/debate/DebateDetail.tsx 와 같은 구성·문구.
 */
export default function DebateDetail({
  post,
  hiddenNotice,
  initialDebate,
  footer,
  live: summaryReady = true,
  viewerId,
  onLogin,
  onReport,
  onBlock,
}: {
  post: DebateDetailPost;
  /** 운영 숨김(신고 누적 자동 가림 포함)이면 작성자·관리자에게 위 블록 위에 안내. */
  hiddenNotice?: React.ReactNode;
  initialDebate: DebateSummary;
  /** 라이브 댓글 아래 '더 둘러보기'(서버가 그린 링크 묶음). */
  footer?: React.ReactNode;
  /**
   * 이 브라우저가 글 응답을 받았는지. 받기 전(ISR 캐시 HTML)에는 투표 결과·참여 수를 그리지 않는다
   * — 캐시된 값은 최대 60초 전이고 내 선택(mySide)도 없다.
   */
  live?: boolean;
  viewerId: number | null;
  onLogin: () => void;
  onReport: (commentId: number) => void;
  onBlock: (user: { id: number; name: string }) => void;
}) {
  const isAuthor = Boolean(viewerId && post.user?.id === viewerId);
  const { summary: voteSummary, setSummary, vote, pendingSide } = useDebateVote({
    postId: post.id,
    initial: initialDebate,
    source: "detail",
  });
  const summary = voteSummary ?? initialDebate;
  const open = summary.state === "open";
  const [switches, setSwitches] = useState<LiveSwitch[]>([]);
  const [best, setBest] = useState<LiveCommentsResult["best"]>(null);
  const firstMaxId = useRef(0);

  const feed = useLiveFeed<LiveComment, LiveCommentsResult>({
    enabled: true,
    poll: open,
    fetchPage: (cursor) => fetchLiveComments(post.id, cursor),
    selectItems: (res) => res.comments,
    selectHasMoreBefore: (res) => res.hasMoreBefore,
    onResponse: (res, mode) => {
      if (res.debate) setSummary(res.debate);
      if (res.best) setBest(res.best);
      if (mode === "reset") {
        setSwitches(res.switches);
        firstMaxId.current = res.comments.reduce((max, item) => Math.max(max, item.id), 0);
      } else if (res.switches.length) {
        // 한 사람 한 줄: 다시 바꾸면 줄이 새 시각으로 옮겨간다.
        setSwitches((prev) => {
          const byUser = new Map(prev.map((item) => [item.userId, item]));
          for (const item of res.switches) byUser.set(item.userId, item);
          return Array.from(byUser.values());
        });
      }
    },
  });

  const commentTotal = feed.hasMoreBefore
    ? (post._count?.comments ?? 0) + feed.items.filter((item) => item.id > firstMaxId.current).length
    : feed.items.filter((item) => !item.deleted).length;

  // 흐름: 댓글 + 마음 바꾼 줄을 시각순으로. 받은 댓글 범위보다 오래된 바꾸기 줄은 위 페이지를 받을 때 보인다.
  const flow = useMemo<FlowEntry[]>(() => {
    const oldest = feed.items[0]?.createdAt;
    const entries: FlowEntry[] = [
      ...feed.items.map((comment) => ({ kind: "comment" as const, at: comment.createdAt, comment })),
      ...switches
        .filter((item) => !feed.hasMoreBefore || !oldest || item.at >= oldest)
        .map((item) => ({ kind: "switch" as const, at: item.at, item })),
    ];
    return entries.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  }, [feed.items, feed.hasMoreBefore, switches]);

  // 새 댓글: 강조 + 맨 아래면 따라 내려가고, 위에 있으면 '새 댓글 N개 ↓'.
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [unseen, setUnseen] = useState(0);
  const mineSent = useRef(false);
  useEffect(() => {
    if (!feed.freshIds.length) return;
    setFresh(new Set(feed.freshIds));
    const timer = window.setTimeout(() => setFresh(new Set()), FRESH_MS);
    if (mineSent.current || isNearBottom()) {
      mineSent.current = false;
      window.requestAnimationFrame(() => scrollToBottom());
    } else {
      setUnseen((count) => count + feed.freshIds.length);
    }
    return () => window.clearTimeout(timer);
  }, [feed.freshIds]);
  useEffect(() => {
    if (!unseen) return;
    const onScroll = () => {
      if (isNearBottom()) setUnseen(0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [unseen]);

  // 홈 카드 '라이브 댓글 ›'(#live)로 들어오면 흐름 머리로 내린다.
  const liveHeadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feed.loaded && window.location.hash === "#live") liveHeadRef.current?.scrollIntoView({ block: "start" });
  }, [feed.loaded]);

  // ── 선택 바꾸기 ──
  const [switchOpen, setSwitchOpen] = useState(false);
  const otherSide: DebateSide = summary.mySide === "A" ? "B" : "A";

  // ── 입력바 ──
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<LiveComment | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [text]);
  const canWrite = open && (Boolean(summary.mySide) || isAuthor);
  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    if (!viewerId) return onLogin();
    setSending(true);
    const res = await sendDebateComment(post.id, body, replyTo?.id ?? null);
    setSending(false);
    if (!res.ok) {
      toast.error(SEND_ERROR[res.data.errorCode ?? ""] ?? res.data.error ?? "댓글을 보내지 못했어요");
      if (res.data.errorCode === "DEBATE_CLOSED") void feed.reset();
      return;
    }
    setText("");
    setReplyTo(null);
    mineSent.current = true;
    void feed.pollNow();
  };

  // ── 댓글 공감·메뉴 ──
  const likePending = useRef(new Set<number>());
  const toggleLike = async (item: LiveComment) => {
    if (!viewerId) return onLogin();
    if (likePending.current.has(item.id)) return;
    likePending.current.add(item.id);
    const flip = (c: LiveComment) => ({ ...c, isLiked: !c.isLiked, likeCount: Math.max(0, c.likeCount + (c.isLiked ? -1 : 1)) });
    feed.patch(item.id, flip);
    try {
      const res = await authFetch(`/api/posts/${post.id}/comments/${item.id}/like`, { method: "POST" });
      if (!res.ok) throw new Error("like failed");
    } catch {
      feed.patch(item.id, flip);
      toast.error("공감하지 못했어요. 다시 눌러 주세요");
    } finally {
      likePending.current.delete(item.id);
    }
  };
  const [menuFor, setMenuFor] = useState<LiveComment | null>(null);
  const [deleteFor, setDeleteFor] = useState<LiveComment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteComment = async () => {
    if (!deleteFor) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/posts/${post.id}/comments/${deleteFor.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      feed.patch(deleteFor.id, (c) => ({ ...c, deleted: true, comment: "" }));
      setDeleteFor(null);
    } catch {
      toast.error("댓글을 삭제하지 못했어요");
    } finally {
      setDeleting(false);
    }
  };
  const menuActions: ActionSheetAction[] = !menuFor
    ? []
    : menuFor.user.id === viewerId
      ? [{ key: "delete", label: "삭제하기", destructive: true, onSelect: () => setDeleteFor(menuFor) }]
      : [
          ...(open && canWrite ? [{ key: "reply", label: "답글 달기", onSelect: () => startReply(menuFor) }] : []),
          { key: "report", label: "신고하기", onSelect: () => onReport(menuFor.id) },
          {
            key: "block",
            label: "작성자 차단",
            destructive: true,
            onSelect: () => onBlock({ id: menuFor.user.id, name: menuFor.user.name }),
          },
        ];
  const startReply = (item: LiveComment) => {
    if (!viewerId) return onLogin();
    setReplyTo(item);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  // 실시간 점: 최근 10분 안 댓글·투표. 머리 오른쪽 문구는 마지막 댓글 시각.
  const live = open && isLiveActive(summary.lastActivityAt);
  const visibleComments = feed.items.filter((item) => !item.deleted);
  const lastCommentAt = visibleComments[visibleComments.length - 1]?.createdAt ?? null;
  const myLabel = summary.mySide ? sideLabel(summary, summary.mySide) : null;

  return (
    <>
      <div className={open ? "pb-[calc(88px+env(safe-area-inset-bottom))]" : "pb-[calc(24px+env(safe-area-inset-bottom))]"}>
        {hiddenNotice}
        {/* 위 블록 */}
        <section className="px-4 pb-5 pt-4">
          <div className="flex items-center gap-1.5">
            {post.type ? (
              <span className="inline-flex h-[22px] items-center rounded-full bg-app-surface px-2 text-[12px] font-medium leading-[22px] text-app-sub">
                {post.type}
              </span>
            ) : null}
            <span className="ml-auto text-[13px] text-app-muted">{remainingLabel(summary.endsAt)}</span>
          </div>
          <h1 className="mt-2.5 break-keep text-[20px] font-bold leading-7 tracking-[-0.4px] text-app-text">{post.title}</h1>
          <div className="mt-1.5 flex min-h-6 items-center gap-1.5 text-[13px] text-app-muted">
            {post.user ? (
              <AuthorLink user={post.user} avatarSize={20} className="gap-1.5" nameClassName="text-[13px] font-semibold text-app-text" />
            ) : null}
            <span className="shrink-0">· {getTimeAgoString(new Date(post.createdAt))}</span>
            {!open ? <span className="shrink-0">· {durationLabel(debateHours(post.createdAt, summary.endsAt))} 토론</span> : null}
          </div>
          {post.description?.trim() ? (
            <p className="mt-3 whitespace-pre-line break-keep text-[15px] leading-[22px] text-app-text">{post.description}</p>
          ) : null}

          {!summaryReady ? (
            // 투표 버튼 + 안내 줄과 같은 높이로 자리를 잡아 응답이 와도 아래 내용이 밀리지 않게 한다.
            <div aria-hidden className="mt-4">
              <div className="flex gap-2">
                <span className="h-14 flex-1 animate-pulse rounded-xl bg-app-placeholder" />
                <span className="h-14 flex-1 animate-pulse rounded-xl bg-app-placeholder" />
              </div>
              <div className="mt-2 h-4" />
            </div>
          ) : open ? (
            summary.mySide ? (
              <div className="mt-4">
                <OpenResult summary={summary} />
                <div className="mt-2.5 flex items-center justify-between text-[13px] leading-[18px] text-app-muted">
                  <span>
                    {participantsLabel(summary.participants)}
                    {summary.switchCount > 0 ? ` · 마음 바꾼 사람 ${summary.switchCount}명` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSwitchOpen(true)}
                    className="font-semibold text-app-text underline underline-offset-[3px]"
                  >
                    선택 바꾸기
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <DebateVoteButtons summary={summary} size="detail" pendingSide={pendingSide} onVote={vote} />
                <p className="mt-2 text-center text-[12px] leading-4 text-app-muted">
                  고르면 결과가 보여요 · {participantsLabel(summary.participants)}
                </p>
              </div>
            )
          ) : (
            <ClosedResult summary={summary} commentTotal={commentTotal} />
          )}
        </section>

        {!open ? <ClosedExtras post={post} summary={summary} best={best} /> : null}

        <div className="h-2 bg-app-gap" />

        {/* 라이브 댓글 머리 */}
        <div ref={liveHeadRef} id="live" className="flex scroll-mt-14 items-center gap-2 px-4 pb-1.5 pt-3.5">
          {open ? (
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", live ? "bg-app-brand shadow-[0_0_0_3px_var(--app-brand-track)]" : "bg-app-caption")}
              aria-hidden="true"
            />
          ) : null}
          <h2 className="text-[16px] font-bold leading-[22px] text-app-text">
            {open ? "라이브 댓글" : "댓글"} {commentTotal > 0 ? commentTotal.toLocaleString() : ""}
          </h2>
          <span className="ml-auto text-[13px] text-app-muted">
            {open
              ? lastCommentAt
                ? activityLabel(lastCommentAt) === "방금"
                  ? "방금 댓글"
                  : `마지막 댓글 ${getTimeAgoString(new Date(lastCommentAt))}`
                : ""
              : "끝난 토론은 읽기만 할 수 있어요"}
          </span>
        </div>

        {/* 흐름 */}
        <div className="px-4">
          {feed.hasMoreBefore ? (
            <button type="button" onClick={() => void feed.loadOlder()} className="w-full py-2 text-[13px] font-semibold text-app-sub">
              이전 댓글 보기
            </button>
          ) : null}
          {!feed.loaded ? (
            <p className="py-9 text-center text-[14px] text-app-muted">댓글을 불러오는 중이에요</p>
          ) : flow.length === 0 ? (
            <p className="py-9 text-center text-[14px] text-app-muted">
              {!open ? "댓글이 없어요" : myLabel ? `${myLabel} 쪽 첫 의견을 남겨 보세요` : "한쪽을 고르고 첫 의견을 남겨 보세요"}
            </p>
          ) : (
            flow.map((entry, index) => {
              const prevAt = index > 0 ? flow[index - 1].at : null;
              const divider = needsLiveDivider(prevAt, entry.at) ? liveDividerLabel(entry.at) : null;
              return (
                <Fragment key={entry.kind === "comment" ? `c${entry.comment.id}` : `s${entry.item.userId}`}>
                  {divider ? <p className="mb-0.5 mt-2.5 text-center text-[12px] text-app-muted">{divider}</p> : null}
                  {entry.kind === "switch" ? (
                    <p className="my-2 text-center text-[12px] text-app-sub">
                      ↔ {switchLine(entry.item.userName, sideLabel(summary, entry.item.to))}
                    </p>
                  ) : (
                    <LiveCommentRow
                      item={entry.comment}
                      summary={summary}
                      fresh={fresh.has(entry.comment.id)}
                      canReply={canWrite}
                      onLike={() => void toggleLike(entry.comment)}
                      onReply={() => startReply(entry.comment)}
                      onMenu={() => (viewerId ? setMenuFor(entry.comment) : onLogin())}
                    />
                  )}
                </Fragment>
              );
            })
          )}
        </div>
        <div id={LIVE_END_ID} />
        {footer}
      </div>

      {/* '새 댓글 N개 ↓' */}
      {unseen > 0 ? (
        <button
          type="button"
          onClick={() => {
            setUnseen(0);
            scrollToBottom();
          }}
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-30 flex h-8 -translate-x-1/2 items-center gap-1 rounded-full bg-app-inverse px-3.5 text-[13px] font-semibold text-app-inverse-text"
        >
          새 댓글 {unseen}개 ↓
        </button>
      ) : null}

      {/* 입력바(진행 중만) */}
      {open ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-app-line bg-app-bg">
          {replyTo ? (
            <div className="flex h-9 items-center gap-2 bg-app-gap pl-4 pr-1">
              <p className="min-w-0 flex-1 truncate text-[13px] text-app-muted">
                <span className="font-semibold text-app-text">{replyTo.user.name}</span>님에게 답글 남기는 중
              </p>
              <button
                type="button"
                aria-label="답글 취소"
                onClick={() => setReplyTo(null)}
                className="grid h-9 w-11 shrink-0 place-items-center text-app-muted"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : null}
          {canWrite ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
              className="flex items-end gap-2 px-3 pb-[max(calc(env(safe-area-inset-bottom)+8px),16px)] pt-2"
            >
              {summary.mySide ? (
                <button
                  type="button"
                  onClick={() => setSwitchOpen(true)}
                  aria-label={`내 선택 ${myLabel}, 선택 바꾸기`}
                  className={cn(
                    "mb-1.5 flex h-8 max-w-[96px] shrink-0 items-center rounded-lg px-2.5 text-[13px] font-bold",
                    summary.mySide === "A" ? "bg-app-brand-soft text-app-brand-text" : "bg-app-stance-b-soft text-app-text"
                  )}
                >
                  <span className="truncate">{myLabel}</span>
                </button>
              ) : (
                <AuthorChip className="mb-[13px] h-[18px]" />
              )}
              <div className="flex min-h-[44px] flex-1 items-end rounded-[22px] bg-app-surface pl-4 pr-1.5">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !isCoarsePointer()) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={myLabel ? `${myLabel} 쪽 의견을 남겨 보세요` : "의견을 남겨 보세요"}
                  aria-label="라이브 댓글 입력"
                  maxLength={COMMENT_MAX_LENGTH}
                  disabled={sending}
                  className="max-h-[112px] min-h-[44px] min-w-0 flex-1 resize-none border-0 bg-transparent p-0 py-[11px] text-[15px] leading-[22px] text-app-text outline-none placeholder:text-app-caption focus:ring-0"
                />
                <button
                  type="submit"
                  aria-label="댓글 보내기"
                  disabled={!text.trim() || sending}
                  className={cn(
                    "mb-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
                    text.trim() ? "bg-app-brand text-white" : "bg-app-placeholder text-app-caption"
                  )}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M5 12h13M12 6l6 6-6 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </form>
          ) : (
            // 내 선택을 받기 전에는 같은 높이로 비워 둔다(이미 고른 사람에게 '먼저 고르라'가 잠깐 보이지 않게).
            <div
              aria-hidden={!summaryReady}
              className={cn(
                "flex items-center gap-2 px-4 pb-[max(calc(env(safe-area-inset-bottom)+10px),16px)] pt-2.5",
                !summaryReady && "invisible"
              )}
            >
              <p className="min-w-0 flex-1 truncate text-[14px] text-app-muted">먼저 한쪽을 골라 주세요</p>
              <DebateVoteButtons summary={summary} size="mini" pendingSide={pendingSide} onVote={vote} />
            </div>
          )}
        </div>
      ) : null}

      <ActionSheet open={menuFor != null} onClose={() => setMenuFor(null)} actions={menuActions} />
      <ConfirmDialog
        open={deleteFor != null}
        tone="danger"
        title="이 댓글을 삭제할까요?"
        description="삭제 후에는 복구할 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        loading={deleting}
        onCancel={() => setDeleteFor(null)}
        onConfirm={() => void deleteComment()}
      />
      <ConfirmDialog
        open={switchOpen}
        title={switchConfirmMessage(sideLabel(summary, otherSide)).split("?")[0] + "?"}
        description={switchConfirmMessage(sideLabel(summary, otherSide)).split("?")[1]?.trim()}
        confirmText="바꾸기"
        cancelText="취소"
        onCancel={() => setSwitchOpen(false)}
        onConfirm={() => {
          setSwitchOpen(false);
          void vote(otherSide);
        }}
      />
    </>
  );
}

/** 토론 기간(시간). 만든 시각 → 끝 시각. */
function debateHours(createdAt: string | Date, endsAt: string) {
  const hours = Math.round((new Date(endsAt).getTime() - new Date(createdAt).getTime()) / 3600_000);
  return [24, 72, 168].reduce((best, h) => (Math.abs(h - hours) < Math.abs(best - hours) ? h : best), 72);
}

/** 진행 중 고른 뒤: A % 20/700 + 이름 15/700 brandText + '내 선택' 칩 / B 이름 + % → 막대 10. 3표 미만이면 안내. */
function OpenResult({ summary }: { summary: DebateSummary }) {
  if (!summary.result) return <DebateResult summary={summary} size="detail" />;
  const mine = (side: DebateSide) =>
    summary.mySide === side ? (
      <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-app-brand px-1.5 text-[11px] font-semibold text-white">
        내 선택
      </span>
    ) : null;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1 text-[15px] font-bold leading-5 text-app-brand-text">
          <b className="text-[20px] tracking-[-0.4px] tabular-nums">{summary.result.a}%</b>
          <span className="truncate">{summary.optionA}</span>
          {mine("A")}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[15px] font-bold leading-5 text-app-text">
          {mine("B")}
          <span className="truncate">{summary.optionB}</span>
          <b className="text-[20px] tracking-[-0.4px] tabular-nums">{summary.result.b}%</b>
        </span>
      </div>
      <DebateGauge result={summary.result} thick />
    </div>
  );
}

const TrophyIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-app-brand" aria-hidden="true">
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4" />
  </svg>
);

/** 끝난 토론 결과 카드(decided) 또는 결론 없음(undecided). */
function ClosedResult({ summary, commentTotal }: { summary: DebateSummary; commentTotal: number }) {
  const stats = [
    participantsLabel(summary.participants),
    summary.switchCount > 0 ? `마음 바꾼 사람 ${summary.switchCount}명` : null,
    `댓글 ${commentTotal}`,
  ]
    .filter(Boolean)
    .join(" · ");
  if (summary.state === "undecided" || !summary.result) {
    return (
      <div className="mt-4 rounded-2xl bg-app-gap p-4">
        <p className="text-[17px] font-bold leading-6 text-app-text">{resultHeadline(summary)}</p>
        <p className="mt-1 text-[13px] leading-[18px] text-app-muted">{stats}</p>
      </div>
    );
  }
  const winner: DebateSide = summary.winner === "B" ? "B" : "A";
  const loser: DebateSide = winner === "A" ? "B" : "A";
  const pct = (side: DebateSide) => (side === "A" ? summary.result!.a : summary.result!.b);
  const mine = mySideResultLine(summary);
  return (
    <div className="mt-4 rounded-2xl bg-app-gap p-4">
      <p className="flex items-center gap-2 text-[17px] font-bold leading-6 text-app-text">
        <TrophyIcon />
        {resultHeadline(summary)}
      </p>
      <div className="mb-2 mt-3.5 flex items-baseline justify-between gap-3">
        <span className={cn("min-w-0 truncate text-[15px] font-bold", winner === "A" ? "text-app-brand-text" : "text-app-text")}>
          <b className="mr-1 text-[28px] tracking-[-0.6px] tabular-nums">{pct(winner)}%</b>
          {sideLabel(summary, winner)}
        </span>
        <span className="min-w-0 truncate text-[15px] font-semibold text-app-muted">
          {sideLabel(summary, loser)} {pct(loser)}%
        </span>
      </div>
      <DebateGauge result={summary.result} thick />
      <p className="mt-2.5 text-[13px] leading-[18px] text-app-muted">{stats}</p>
      {mine ? <p className="mt-1 text-[13px] leading-[18px] text-app-text">{mine}</p> : null}
    </div>
  );
}

/** 끝난 토론: 각 쪽 베스트 댓글 · 분양 줄 · 결과 공유/비슷한 토론 열기. */
function ClosedExtras({
  post,
  summary,
  best,
}: {
  post: DebateDetailPost;
  summary: DebateSummary;
  best: LiveCommentsResult["best"];
}) {
  const species = post.type?.trim() || null;
  const { data: products } = useSWR<ProductsResponse>(
    species ? `/api/products?category=${encodeURIComponent(species)}&status=${encodeURIComponent("판매중")}&page=1` : null,
    { revalidateOnFocus: false }
  );
  const saleCount = products?.total ?? null;
  const bests = (["A", "B"] as const)
    .map((side) => ({ side, item: best?.[side] ?? null }))
    .filter((entry): entry is { side: DebateSide; item: LiveComment } => Boolean(entry.item && entry.item.likeCount > 0));
  const similarHref = `/posts/debate${species ? `?species=${encodeURIComponent(species)}` : ""}`;
  return (
    <>
      {summary.state === "decided"
        ? bests.map(({ side, item }) => (
            <div key={side} className="mx-4 mt-3 rounded-xl border border-app-line px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-app-muted">
                <StanceChip side={side} label={sideLabel(summary, side)} />
                가장 공감받은 댓글
              </p>
              <p className="mt-1.5 whitespace-pre-line break-keep text-[15px] leading-[22px] text-app-text">{item.comment}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-app-muted">
                <InitialAvatar name={item.user.name} avatar={item.user.avatar} size={16} />
                <b className="font-semibold text-app-text">{item.user.name}</b>· 공감 {item.likeCount}
              </p>
            </div>
          ))
        : null}
      {species && saleCount != null ? (
        <Link
          href={`/products${saleCount > 0 ? "" : "/upload"}?category=${encodeURIComponent(species)}`}
          className="mx-4 mt-3 flex h-[52px] items-center gap-2.5 border-y border-app-line text-[15px] font-semibold text-app-text"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-app-surface">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l1.5-5h15L21 9M3 9h18v11H3V9Zm6 4h6" />
            </svg>
          </span>
          <span className="min-w-0 flex-1 truncate">
            {saleCount > 0 ? `${species} 분양글 ${saleCount}개 보기` : `${species} 첫 분양글 올리기`}
          </span>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="shrink-0 text-app-muted" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      ) : null}
      <div className="flex gap-2 p-4">
        <button
          type="button"
          onClick={() =>
            void shareOrCopy({ title: post.title, url: toPostPath(post.id, post.title) })
          }
          className="flex h-12 flex-1 items-center justify-center rounded-lg bg-app-surface text-[15px] font-semibold text-app-text"
        >
          결과 공유
        </button>
        <Link
          href={similarHref}
          className="flex h-12 flex-1 items-center justify-center rounded-lg bg-app-brand text-[15px] font-semibold text-white"
        >
          비슷한 토론 열기
        </Link>
      </div>
    </>
  );
}

/** 라이브 댓글 한 줄: 아바타 28 · 닉네임 13/600 · 쪽 칩 · (글쓴이) · 시간 / (인용 줄) / 내용 15 / 공감·답글 12. */
function LiveCommentRow({
  item,
  summary,
  fresh,
  canReply,
  onLike,
  onReply,
  onMenu,
}: {
  item: LiveComment;
  summary: DebateSummary;
  fresh: boolean;
  canReply: boolean;
  onLike: () => void;
  onReply: () => void;
  onMenu: () => void;
}) {
  if (item.deleted) {
    return <p className="py-2 text-[13px] text-app-caption">삭제된 댓글이에요</p>;
  }
  return (
    <div
      className={cn(
        "-mx-4 flex gap-2.5 px-4 py-2 transition-colors duration-700",
        fresh ? "bg-app-brand-soft" : "bg-transparent"
      )}
      data-testid="live-comment"
    >
      <Link href={`/profiles/${item.user.id}`} className="shrink-0" aria-label={`${item.user.name} 프로필`}>
        <InitialAvatar name={item.user.name} avatar={item.user.avatar} size={28} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] leading-[18px]">
          <Link href={`/profiles/${item.user.id}`} className="truncate font-semibold text-app-text">
            {item.user.name}
          </Link>
          {item.stance ? <StanceChip side={item.stance} label={sideLabel(summary, item.stance)} /> : null}
          {item.isAuthor ? <AuthorChip /> : null}
          <span className="shrink-0 text-[12px] text-app-muted">{getTimeAgoString(new Date(item.createdAt))}</span>
          <button
            type="button"
            onClick={onMenu}
            aria-label="댓글 메뉴"
            className="-my-2 ml-auto grid h-8 w-8 shrink-0 place-items-center text-app-caption"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx={12} cy={5.5} r={1.4} />
              <circle cx={12} cy={12} r={1.4} />
              <circle cx={12} cy={18.5} r={1.4} />
            </svg>
          </button>
        </div>
        {item.parent ? (
          <p className="mt-0.5 truncate text-[12px] text-app-muted">
            ↳ {item.parent.userName}: {item.parent.comment}
          </p>
        ) : null}
        <p className="mt-0.5 whitespace-pre-line break-words text-[15px] leading-[21px] text-app-text">{item.comment}</p>
        <div className="mt-1 flex gap-3 text-[12px] text-app-muted">
          <button type="button" onClick={onLike} className={item.isLiked ? "font-semibold text-app-brand" : undefined}>
            공감{item.likeCount > 0 ? ` ${item.likeCount}` : ""}
          </button>
          {canReply ? (
            <button type="button" onClick={onReply}>
              답글
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
