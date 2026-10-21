"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { useMarkSeenOnView } from "@libs/client/unreadMarks";
import { markNoticeBandSeen } from "@libs/client/noticeBandSeen";

import Layout, { toLoginHref } from "@components/features/MainLayout";
import { HeaderIconButton } from "@components/app/HeaderIconButton";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import { ActionSheet, type ActionSheetAction } from "@components/app/ActionSheet";
import { ReportSheet } from "@components/app/moderation/ReportSheet";
import { BlockConfirmDialog } from "@components/app/moderation/BlockConfirmDialog";
import ImageLightbox from "@components/features/image/ImageLightbox";
import { BreederProgramBadge } from "@components/features/breeder/BreederProgramDecorators";
import useUser from "hooks/useUser";
import useBlocks from "hooks/useBlocks";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { copyText, absoluteUrl, shareOrCopy } from "@libs/client/share";
import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { extractPostIdFromPath, toPostPath } from "@libs/post-route";
import { postCategoryLabel } from "@libs/shared/postCategory";
import type { PostDetailResponse } from "pages/api/posts/[id]";
import { MY_ACTIVITY_KEY_PREFIXES, POST_KEY_PREFIXES, revalidateByPrefix } from "@libs/client/swrRevalidate";
import { getPostMenuActionKeys, isNoticePost, type PostMenuActionKey } from "../_lib/postComposer";
import AdSenseUnit from "@components/app/ads/AdSenseUnit";
import CoupangBanner from "@components/app/ads/CoupangBanner";
import { PostAvatar } from "../_components/PostAvatar";
import { PostBody } from "../_components/PostBody";
import { useProfilePin } from "@components/features/profile/ProfilePinSheet";
import HiddenContentNotice from "@components/app/moderation/HiddenContentNotice";
import useAdminModeration from "hooks/useAdminModeration";
import { commentAnchorId, PostCommentItem } from "../_components/PostCommentItem";
import { COMMENT_MAX_LENGTH, groupCommentThreads } from "@libs/shared/comment";
import { mentionPrefill } from "@libs/shared/comment-mention";
import FollowButton from "@components/features/profile/FollowButton";
import { DEBATE_CATEGORY } from "@libs/shared/debateFormat";
import DebateDetail from "@components/features/debate/DebateDetail";

type PostComment = NonNullable<PostDetailResponse["post"]>["comments"][number];
type ReportTarget = { type: "POST" | "COMMENT"; id: number };
type BlockTarget = { id: number; name: string };
/**
 * 입력바 모드: 답글 또는 내 댓글 수정.
 * 답글의 rootId 는 입력바 표시·삭제 처리용 묶음 루트, targetId 는 누른 댓글이다. 서버에는 targetId 를 보낸다
 * (서버가 루트에 붙이고, 답글에 단 답글이면 그 작성자를 replyToUser·답글 알림 대상으로 남긴다).
 */
type ComposerMode =
  | { kind: "reply"; rootId: number; targetId: number; name: string }
  | { kind: "edit"; comment: PostComment };

type CommentMutationResult = {
  success?: boolean;
  error?: string;
  message?: string;
  answer?: { id?: number };
} | null;
type CommentLikeResult = { success?: boolean; liked?: boolean; likeCount?: number; error?: string } | null;
/** 답변 채택은 질문 글에만 있다(서버 pages/api/posts/[id]/accept.ts 와 같은 기준). */
const QUESTION_CATEGORY = "질문";
/** 그 댓글로 이동했을 때 회색 배경을 보여 주는 시간 */
const COMMENT_HIGHLIGHT_MS = 1600;

const timeAgo = (value: string | Date) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : getTimeAgoString(date);
};

function MoreIcon() {
  return (
    // 분양글 상세 헤더의 ⋮ 와 같은 모양
    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function NoticeLink({
  label,
  notice,
  isLast,
}: {
  label: string;
  notice?: { id: number; title: string } | null;
  isLast?: boolean;
}) {
  const className = cn("flex items-center gap-2 py-3", !isLast && "border-b border-app-line");
  const inner = (
    <>
      <span className="shrink-0 text-[13px] font-semibold text-app-muted">{label}</span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[15px]",
          notice ? "text-app-text" : "text-app-muted"
        )}
      >
        {notice?.title ?? "없습니다."}
      </span>
    </>
  );
  return notice ? (
    <Link href={toPostPath(notice.id, notice.title)} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

/** 댓글 입력칸은 여러 줄로 늘어나다 이 높이(약 5줄)부터 안에서 스크롤한다(채팅 입력창과 같은 값). */
const COMMENT_MAX_HEIGHT = 112;

/** 터치가 주 입력인 기기(모바일). 이 기기의 키보드 Enter 는 줄바꿈으로 둔다. */
const isCoarsePointer = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: coarse)").matches);

/** 댓글을 받기 전 자리. 캐시된 HTML 에는 댓글을 넣지 않는다. */
const CommentsSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-4 py-4">
    {[0, 1].map((row) => (
      <div key={row} className="flex gap-2.5">
        <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-app-placeholder" />
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="h-3.5 w-24 animate-pulse rounded bg-app-placeholder" />
          <span className="h-3.5 w-3/4 animate-pulse rounded bg-app-placeholder" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * 알림·프로필 댓글 목록에서 ?commentId= 로 열면 그 댓글을 알린다.
 * 상세는 ISR 이라 서버에서 쿼리를 읽지 않는다. useSearchParams 는 Suspense 안에서만 써야 글 본문이 서버에서 그려진다.
 */
const FocusCommentFromQuery = ({ onFocus }: { onFocus: (commentId: number) => void }) => {
  const raw = useSearchParams()?.get("commentId");
  useEffect(() => {
    const commentId = Number(raw);
    if (Number.isInteger(commentId) && commentId > 0) onFocus(commentId);
  }, [raw, onFocus]);
  return null;
};

const PostClient = ({
  post: initialPost,
  prevNotice: initialPrevNotice,
  nextNotice: initialNextNotice,
  debate: initialDebate,
  footer,
}: PostDetailResponse & {
  /** 맨 아래 '더 둘러보기'(서버가 그린 비슷한 글·인기 글·바로가기). */
  footer?: React.ReactNode;
}) => {
  const params = useParams();
  const postId = extractPostIdFromPath(params?.id);
  const postApiId = Number.isNaN(postId) ? null : postId;
  const router = useRouter();
  const { user, isLoading: userLoading, canEditAnyContent } = useUser();
  const { mutate: globalMutate, cache: swrCache } = useSWRConfig();
  const revalidateMyPostActivity = () =>
    revalidateByPrefix({ cache: swrCache, mutate: globalMutate }, [...POST_KEY_PREFIXES, ...MY_ACTIVITY_KEY_PREFIXES]);
  const { isBlocked, unblock, isPending: blockPending } = useBlocks();

  // 관리자 ⋯ 조치(숨기기·숨김 해제·삭제). 관리자가 아니면 항목이 없다.
  const moderation = useAdminModeration();

  const { data, error, mutate } = useSWR<PostDetailResponse>(
    postApiId ? `/api/posts/${postApiId}` : null
  );

  const [comment, setComment] = useState("");
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [commentSheet, setCommentSheet] = useState<PostComment | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [commentDelete, setCommentDelete] = useState<PostComment | null>(null);
  const [commentDeleting, setCommentDeleting] = useState(false);
  // 스크롤할 댓글(알림·프로필에서 열었거나 방금 등록함). 한 번 스크롤하면 비워 다시 받아도 다시 움직이지 않는다.
  const [scrollTargetId, setScrollTargetId] = useState<number | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);
  const commentLikePending = useRef(new Set<number>());
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  // 404·403(삭제·숨김)이면 받아 둔 글도 내린다.
  const errorStatus = (error as { status?: number } | undefined)?.status;
  const isGone = Boolean(error && (errorStatus === 404 || errorStatus === 403));
  const post = isGone ? undefined : data?.post || initialPost;
  // 목록의 '안 본 글' 빨간 점을 지운다(이 브라우저 기록).
  useMarkSeenOnView("post", post);
  const prevNotice = data?.prevNotice ?? initialPrevNotice;
  const nextNotice = data?.nextNotice ?? initialNextNotice;
  const isLiked = Boolean(data?.isLiked);
  // 서버 초기값(initialPost)에는 내 좋아요 여부가 없다. 클라이언트 응답이 오기 전에 누르면 반대로 토글되니 막는다.
  // 로그아웃 상태는 누르면 로그인으로 보내므로 막지 않는다.
  const likeReady = !user || Boolean(data);
  // 댓글·좋아요 수 같은 실시간 영역은 서버 HTML(ISR 캐시)에 넣지 않고 이 브라우저가 받은 응답으로만 그린다.
  const live = Boolean(data?.post);
  const isNotice = isNoticePost(post);
  const showAds = Boolean(post) && !isNotice && !post?.isHidden;
  // 연 공지는 홈 공지 띠에서도 숨긴다(띠는 14일, 위 '안 본 글' 기록은 7일이라 따로 남긴다. 앱 posts/[id] 와 같다).
  const noticeId = isNotice ? post?.id : undefined;
  useEffect(() => {
    if (noticeId != null) markNoticeBandSeen(noticeId);
  }, [noticeId]);
  const detailPath = post ? toPostPath(post.id, post.title) : `/posts/${postApiId ?? ""}`;
  const authorId = post?.user?.id;
  const isOwnPost = Boolean(user?.id && authorId && user.id === authorId);
  // 운영자 이메일 계정은 남의 글도 본인 글처럼 수정·삭제한다(서버가 같은 기준으로 허용).
  const canManagePost = isOwnPost || canEditAnyContent;
  // 찬반 토론 글이면 라이브 댓글 상세(앱 docs/prd/live-talk.md §3.5). 요약은 클라이언트 응답(내 선택 포함)이 이긴다.
  const debate = post?.category === DEBATE_CATEGORY ? data?.debate ?? initialDebate ?? null : null;
  const headerTitle = isNotice ? "공지" : debate ? "찬반 토론" : post?.category || "게시글";
  const likeCount = post?._count?.Likes ?? 0;
  const commentCount = post?._count?.comments ?? 0;
  // 내 사진 글은 프로필 사진 그리드 맨 앞에 고정할 수 있다(사진형 프로필 PRD F-6).
  const { setPin: setProfilePin } = useProfilePin();
  const commentThreads = useMemo(() => groupCommentThreads(post?.comments ?? []), [post?.comments]);

  useEffect(() => {
    if (scrollTargetId == null) return;
    const element = document.getElementById(commentAnchorId(scrollTargetId));
    if (!element) {
      // 지웠거나 볼 수 없는 댓글이면 최신 응답을 받은 뒤 포기하고 글 맨 위에 둔다.
      if (data) setScrollTargetId(null);
      return;
    }
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightedCommentId(scrollTargetId);
    setScrollTargetId(null);
  }, [scrollTargetId, commentThreads, data]);

  useEffect(() => {
    if (highlightedCommentId == null) return;
    const timer = window.setTimeout(() => setHighlightedCommentId(null), COMMENT_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightedCommentId]);
  const photos = useMemo(
    () => (post ? (post.images?.length ? post.images : post.image ? [post.image] : []) : []),
    [post]
  );

  // 반려생활 '답 기다려요' 카드의 '답하기'(#comment)로 들어오면 댓글 입력칸에 커서를 둔다(community-vibe §5b).
  const hasPost = Boolean(post);
  useEffect(() => {
    if (!hasPost || typeof window === "undefined" || window.location.hash !== "#comment") return;
    const el = commentInputRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.focus();
  }, [hasPost]);

  // 댓글 입력칸 높이를 글 줄 수에 맞춘다(등록 후 비우면 한 줄로 돌아온다).
  useLayoutEffect(() => {
    const el = commentInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMMENT_MAX_HEIGHT)}px`;
  }, [comment]);
  const safeImageIndex = imageIndex < photos.length ? imageIndex : 0;
  const authorBlocked = Boolean(authorId && !isNotice && isBlocked(authorId));
  const loggedOut = !user && !userLoading;

  const goLogin = () => router.push(toLoginHref(detailPath));

  const openReport = (target: ReportTarget) => {
    if (!user) return goLogin();
    setReportTarget(target);
  };
  const openBlock = (target: BlockTarget) => {
    if (!user) return goLogin();
    setBlockTarget(target);
  };

  const handleLike = async () => {
    if (!post || likeLoading) return;
    if (!user) return goLogin();
    if (!likeReady) return;
    setLikeLoading(true);
    const previous = data;
    void mutate(
      (current) => {
        const base = current ?? { success: true, post };
        if (!base.post) return base;
        const wasLiked = Boolean(base.isLiked);
        const count = base.post._count?.Likes ?? 0;
        return {
          ...base,
          isLiked: !wasLiked,
          post: {
            ...base.post,
            _count: { ...base.post._count, Likes: Math.max(0, count + (wasLiked ? -1 : 1)) },
          },
        };
      },
      { revalidate: false }
    );
    try {
      const response = await authFetch(`/api/posts/${post.id}/wonder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("like failed");
      revalidateByPrefix({ cache: swrCache, mutate: globalMutate }, POST_KEY_PREFIXES);
      await mutate();
    } catch {
      void mutate(previous, { revalidate: false });
      toast.error("좋아요 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLikeLoading(false);
    }
  };

  /** 답글·수정 모드로 바꾸고 입력칸에 커서를 둔다(시트가 닫힌 뒤). */
  const startComposer = (mode: ComposerMode) => {
    if (!user) return goLogin();
    setComposerMode(mode);
    if (mode.kind === "edit") setComment(mode.comment.comment);
    window.setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  const closeComposer = () => {
    // 수정을 그만두면 원문을 채워 둔 입력칸도 비운다. 답글은 쓰던 내용을 남긴다.
    if (composerMode?.kind === "edit") setComment("");
    setComposerMode(null);
  };

  const handleCommentSubmit = async () => {
    if (!post || commentLoading) return;
    if (!user) return goLogin();
    const nextComment = comment.trim();
    if (!nextComment) return;
    const mode = composerMode;
    const failMessage = mode?.kind === "edit" ? "댓글 수정에 실패했습니다." : "댓글 등록에 실패했습니다.";
    setCommentLoading(true);
    try {
      const response =
        mode?.kind === "edit"
          ? await authFetch(`/api/posts/${post.id}/comments/${mode.comment.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ comment: nextComment }),
            })
          : await authFetch(`/api/posts/${post.id}/answers`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                comment: nextComment,
                ...(mode?.kind === "reply" ? { parentId: mode.targetId } : {}),
              }),
            });
      const result = (await response.json().catch(() => null)) as CommentMutationResult;
      if (response.ok && result?.success) {
        setComment("");
        setComposerMode(null);
        await mutate();
        // 새 댓글·답글로 스크롤한다(수정은 제자리).
        if (mode?.kind !== "edit" && result.answer?.id) setScrollTargetId(result.answer.id);
        // 게시글 목록 댓글 수와 마이페이지·내 프로필 댓글 목록·수(앱 invalidateMyActivity)
        revalidateMyPostActivity();
        toast.success(
          mode?.kind === "edit"
            ? "댓글이 수정되었습니다."
            : mode?.kind === "reply"
              ? "답글이 등록되었습니다."
              : "댓글이 등록되었습니다."
        );
        return;
      }
      toast.error(result?.error || result?.message || failMessage);
    } catch {
      toast.error(failMessage);
    } finally {
      setCommentLoading(false);
    }
  };

  /** 댓글 좋아요 토글(낙관적 반영, 실패하면 되돌린다). */
  const handleCommentLike = async (item: PostComment) => {
    if (!post) return;
    if (!user) return goLogin();
    // 서버 초기값에는 내 좋아요 여부가 없으니 클라이언트 응답이 온 뒤에만 누를 수 있다(글 좋아요와 같음).
    if (!likeReady || commentLikePending.current.has(item.id)) return;
    commentLikePending.current.add(item.id);
    const setLike = (liked: boolean, likeCount: number) =>
      mutate(
        (current) => {
          const base = current ?? { success: true, post };
          if (!base.post) return base;
          return {
            ...base,
            post: {
              ...base.post,
              comments: base.post.comments.map((comment) =>
                comment.id === item.id ? { ...comment, isLiked: liked, likeCount } : comment
              ),
            },
          };
        },
        { revalidate: false }
      );
    const wasLiked = Boolean(item.isLiked);
    const previousCount = item.likeCount ?? 0;
    void setLike(!wasLiked, Math.max(0, previousCount + (wasLiked ? -1 : 1)));
    try {
      const response = await authFetch(`/api/posts/${post.id}/comments/${item.id}/like`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as CommentLikeResult;
      if (!response.ok || !result?.success) throw new Error(result?.error || "like failed");
      void setLike(Boolean(result.liked), result.likeCount ?? 0);
    } catch {
      void setLike(wasLiked, previousCount);
      toast.error("좋아요 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      commentLikePending.current.delete(item.id);
    }
  };

  const deleteComment = async () => {
    if (!post || !commentDelete || commentDeleting) return;
    setCommentDeleting(true);
    try {
      const response = await authFetch(`/api/posts/${post.id}/comments/${commentDelete.id}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as CommentMutationResult;
      if (response.ok && result?.success) {
        // 지운 댓글을 고치거나 거기에 답글을 쓰던 중이면 입력바 모드를 푼다.
        if (composerMode?.kind === "edit" && composerMode.comment.id === commentDelete.id) {
          setComment("");
          setComposerMode(null);
        }
        if (
          composerMode?.kind === "reply" &&
          (composerMode.rootId === commentDelete.id || composerMode.targetId === commentDelete.id)
        ) {
          setComposerMode(null);
        }
        setCommentDelete(null);
        await mutate();
        revalidateMyPostActivity();
        toast.success("댓글이 삭제되었습니다.");
        return;
      }
      toast.error(result?.error || result?.message || "댓글 삭제에 실패했습니다.");
    } catch {
      toast.error("댓글 삭제에 실패했습니다.");
    } finally {
      setCommentDeleting(false);
    }
  };

  const deleteCurrentPost = async () => {
    if (!post || deleting) return;
    setDeleting(true);
    try {
      const response = await authFetch(`/api/posts/${post.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        message?: string;
      } | null;
      if (!response.ok || !result?.success) {
        toast.error(result?.error || result?.message || "게시글 삭제에 실패했습니다.");
        return;
      }
      setDeleteOpen(false);
      toast.success("게시글이 삭제되었습니다.");
      revalidateMyPostActivity();
      router.replace("/");
    } catch {
      toast.error("게시글 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  // 이 글 새 댓글 알림(댓글을 달면 자동 구독). 글쓴이는 구독 행이 없어도 받고 있으니 끄기를 보여 준다.
  const subscriptionMuted = data?.mySubscription?.muted;
  const receivingNewComments = isOwnPost ? subscriptionMuted !== true : subscriptionMuted === false;
  const setNewCommentAlerts = async (receive: boolean) => {
    if (!post) return;
    if (!user) return goLogin();
    const previous = data;
    void mutate((current) => (current ? { ...current, mySubscription: { muted: !receive } } : current), {
      revalidate: false,
    });
    try {
      const response = await authFetch(`/api/posts/${post.id}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: !receive }),
      });
      if (!response.ok) throw new Error("subscription failed");
      toast.success(receive ? "이 글에 새 댓글이 달리면 알려 드릴게요" : "이 글 알림을 껐어요");
    } catch {
      void mutate(previous, { revalidate: false });
      toast.error("알림 설정을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  // 질문 답변 채택(질문자만). 채택하면 댓글에 '질문자 채택' 띠, 목록 질문 pill 이 '해결'로 바뀐다.
  // 채택한 댓글이 지워졌거나 숨겨졌거나 차단해 목록에서 빠졌으면 채택이 없는 것으로 본다
  // (그래야 다른 답을 채택할 수 있다. 앱 src/app/posts/[id].tsx 와 같은 규칙).
  const acceptedCommentId = useMemo(() => {
    const id = post?.acceptedCommentId ?? null;
    if (id == null) return null;
    return post?.comments?.some((item) => item.id === id && !item.deletedAt && !item.isHidden) ? id : null;
  }, [post?.acceptedCommentId, post?.comments]);
  const setAcceptedAnswer = async (commentId: number | null) => {
    if (!post) return;
    try {
      const response = await authFetch(`/api/posts/${post.id}/accept`, {
        method: commentId ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        ...(commentId ? { body: JSON.stringify({ commentId }) } : {}),
      });
      const result = (await response.json().catch(() => null)) as CommentMutationResult;
      if (!response.ok || !result?.success) {
        toast.error(result?.error || result?.message || "채택하지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      await mutate();
      revalidateByPrefix({ cache: swrCache, mutate: globalMutate }, POST_KEY_PREFIXES);
      toast.success(commentId ? "답변을 채택했어요" : "채택을 취소했어요");
    } catch {
      toast.error("채택하지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  const sheetActions = useMemo<ActionSheetAction[]>(() => {
    if (!post) return [];
    const path = toPostPath(post.id, post.title);
    const isProfilePinned = Boolean((post as { profilePinnedAt?: string | Date | null }).profilePinnedAt);
    const byKey: Record<PostMenuActionKey, ActionSheetAction> = {
      "profile-pin": {
        key: isProfilePinned ? "profile-unpin" : "profile-pin",
        label: isProfilePinned ? "프로필 고정 해제" : "프로필에 고정",
        onSelect: () => void setProfilePin(post.id, !isProfilePinned),
      },
      edit: {
        key: "edit",
        label: "수정하기",
        // 토론은 토론 열기 화면에서 고친다(다른 사람이 처음 투표하기 전엔 전부, 그 뒤엔 설명만).
        onSelect: () =>
          router.push(post.category === DEBATE_CATEGORY ? `/posts/debate?edit=${post.id}` : `/posts/${post.id}/edit`),
      },
      delete: { key: "delete", label: "삭제하기", destructive: true, onSelect: () => setDeleteOpen(true) },
      share: {
        key: "share",
        label: "공유하기",
        onSelect: () => void shareOrCopy({ title: post.title, url: path }),
      },
      "copy-link": {
        key: "copy-link",
        label: "링크 복사",
        onSelect: async () => {
          const ok = await copyText(absoluteUrl(path));
          if (ok) toast.success("링크를 복사했어요");
          else toast.error("링크를 복사하지 못했어요");
        },
      },
      report: {
        key: "report",
        label: "신고하기",
        onSelect: () => openReport({ type: "POST", id: post.id }),
      },
      block: {
        key: "block",
        label: "작성자 차단",
        destructive: true,
        onSelect: () => post.user?.id && openBlock({ id: post.user.id, name: post.user.name }),
      },
    };
    // 관리자는 남의 글(공지 포함)에서 숨기기·삭제·수정을 맨 앞에 본다. 본인 글은 아래 수정·삭제로 충분하다(앱과 같음).
    const adminActions = isOwnPost
      ? []
      : [
          ...moderation.actionsFor({
            targetType: "POST",
            targetId: post.id,
            isHidden: Boolean(post.isHidden),
            refreshDetail: () => void mutate(),
            onDeleted: () => router.replace("/"),
          }),
          // 운영자 이메일 계정은 아래 본인 메뉴(수정·삭제)로 이미 고칠 수 있어 겹치지 않게 뺀다.
          ...(moderation.isAdmin && !canManagePost ? [{ ...byKey.edit, label: "수정하기 (관리자)" }] : []),
        ];
    // 로그인했으면 공지가 아닌 글에서 이 글 새 댓글 알림을 끄고 켠다(응답을 받은 뒤).
    const alertActions: ActionSheetAction[] =
      user && data && !isNotice
        ? [
            receivingNewComments
              ? { key: "alerts-off", label: "이 글 알림 끄기", onSelect: () => void setNewCommentAlerts(false) }
              : { key: "alerts-on", label: "이 글 알림 받기", onSelect: () => void setNewCommentAlerts(true) },
          ]
        : [];
    return [
      ...adminActions,
      ...alertActions,
      ...getPostMenuActionKeys({
        isOwn: canManagePost,
        isNotice,
        hasAuthor: Boolean(post.user?.id),
        authorBlocked,
        // 프로필 고정은 내 프로필에 내 글을 올리는 것이라 본인 글에만 둔다.
        canProfilePin: isOwnPost && photos.length > 0,
      }).map((key) => byKey[key]),
    ];
  }, [post, isOwnPost, canManagePost, isNotice, authorBlocked, user, photos.length, setProfilePin, moderation, mutate, router, data, receivingNewComments]);

  // 댓글 ⋮ 시트: 내 댓글은 수정·삭제, 남의 댓글은 (관리자 조치) 신고·작성자 차단.
  const commentSheetIsMine = Boolean(user?.id && commentSheet?.user?.id === user.id);
  // 운영자 이메일 계정은 남의 댓글도 수정·삭제한다(관리자 숨기기 조치는 그대로 맨 앞).
  const commentSheetCanManage = commentSheetIsMine || canEditAnyContent;
  const commentSheetActions: ActionSheetAction[] = !commentSheet
    ? []
    : [
        // 관리자는 남의 댓글에서 숨기기·숨김 해제·삭제를 맨 앞에 본다(앱과 같음).
        ...(commentSheetIsMine
          ? []
          : moderation.actionsFor({
              targetType: "COMMENT",
              targetId: commentSheet.id,
              isHidden: Boolean(commentSheet.isHidden),
              refreshDetail: () => {
                void mutate();
                revalidateMyPostActivity();
              },
            })),
        // 내 질문에 달린 남의 답변: 채택이 없으면 '이 답변 채택', 채택한 답변이면 '채택 취소'.
        ...(isOwnPost &&
        post?.category === QUESTION_CATEGORY &&
        !commentSheetIsMine &&
        !commentSheet.deletedAt &&
        !commentSheet.isHidden &&
        (acceptedCommentId == null || acceptedCommentId === commentSheet.id)
          ? [
              acceptedCommentId === commentSheet.id
                ? { key: "unaccept", label: "채택 취소", onSelect: () => void setAcceptedAnswer(null) }
                : { key: "accept", label: "이 답변 채택", onSelect: () => void setAcceptedAnswer(commentSheet.id) },
            ]
          : []),
        ...(commentSheetCanManage
          ? [
              {
                key: "edit",
                label: "수정하기",
                onSelect: () => startComposer({ kind: "edit", comment: commentSheet }),
              },
              {
                key: "delete",
                label: "삭제하기",
                destructive: true,
                onSelect: () => setCommentDelete(commentSheet),
              },
            ]
          : [
              {
                key: "report",
                label: "신고하기",
                onSelect: () => openReport({ type: "COMMENT", id: commentSheet.id }),
              },
              {
                key: "block",
                label: "작성자 차단",
                destructive: true,
                onSelect: () => openBlock({ id: commentSheet.user.id, name: commentSheet.user.name }),
              },
            ]),
      ];
  const commentDeleteHasReplies = Boolean(
    commentDelete &&
      commentThreads.some((thread) => thread.root.id === commentDelete.id && thread.replies.length > 0)
  );

  const canSubmitComment = comment.trim().length > 0 && !commentLoading;

  const renderBody = () => {
    if (!post) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
          <p className="text-[14px] text-app-muted">게시글을 불러올 수 없습니다.</p>
        </div>
      );
    }

    if (authorBlocked) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6">
          <p className="text-[16px] font-bold text-app-text">차단한 작성자의 게시글입니다.</p>
          <p className="mt-2 text-center text-[14px] leading-5 text-app-muted">
            이 작성자의 게시글은 반려생활 목록에서 숨겨집니다.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="h-11 rounded-md bg-app-surface px-4 text-[15px] font-semibold text-app-text"
            >
              목록으로
            </button>
            <button
              type="button"
              disabled={blockPending}
              onClick={() => authorId && void unblock(authorId)}
              className="h-11 rounded-md bg-app-brand px-4 text-[15px] font-semibold text-white disabled:opacity-60"
            >
              차단 해제
            </button>
          </div>
        </div>
      );
    }

    if (debate) {
      return (
        <DebateDetail
          post={post}
          hiddenNotice={post.isHidden ? <HiddenContentNotice targetType="POST" className="mx-4 mt-3" /> : null}
          initialDebate={debate}
          live={live}
          footer={footer}
          viewerId={user?.id ?? null}
          onLogin={goLogin}
          onReport={(commentId) => openReport({ type: "COMMENT", id: commentId })}
          onBlock={(target) => openBlock(target)}
        />
      );
    }

    return (
      <>
        {/* 답글·수정 모드 줄(36)이 생기면 그만큼 더 띄워 마지막 댓글이 입력바에 가리지 않게 한다. */}
        <div
          className={
            composerMode
              ? "pb-[calc(124px+env(safe-area-inset-bottom))]"
              : "pb-[calc(88px+env(safe-area-inset-bottom))]"
          }
        >
          {/* 작성자 행: 44 아바타 + 이름 16/600 + 브리더 pill + 메타 13 */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            {isNotice ? (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-app-surface text-[13px] font-bold text-app-muted">
                공지
              </span>
            ) : (
              <Link href={`/profiles/${post.user?.id}`} aria-label="작성자 프로필" className="shrink-0">
                <PostAvatar user={post.user} size={44} />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {isNotice ? (
                  <span className="truncate text-[16px] font-semibold text-app-text">운영팀</span>
                ) : (
                  <Link
                    href={`/profiles/${post.user?.id}`}
                    className="min-w-0 truncate text-[16px] font-semibold text-app-text"
                  >
                    {post.user?.name}
                  </Link>
                )}
                {!isNotice ? <BreederProgramBadge programs={post.user?.breederPrograms} /> : null}
              </div>
              {/* 상대 시간은 서버 HTML(ISR 캐시)과 첫 화면이 몇 분 다를 수 있다. */}
              <p className="mt-0.5 text-[13px] text-app-muted" suppressHydrationWarning>
                {postCategoryLabel(post) ? `${postCategoryLabel(post)} · ` : ""}
                {timeAgo(post.createdAt)}
              </p>
            </div>
            {/* 작성자 줄 팔로우(로그인·남의 글·공지 아님). 서버 HTML 에는 내 팔로우 여부가 없어 응답을 받은 뒤 그린다. */}
            {live && user && !isOwnPost && !isNotice && post.user?.id ? (
              <FollowButton
                size="sm"
                userId={post.user.id}
                isFollowing={Boolean(post.user.isFollowing)}
                returnPath={detailPath}
              />
            ) : null}
          </div>

          {post.isHidden ? <HiddenContentNotice targetType="POST" className="mx-4 mb-3" /> : null}

          {/* 본문 */}
          <div className="flex flex-col gap-2 px-4 pb-3">
            <h1 className="break-keep text-[18px] font-bold leading-[26px] text-app-text">
              {post.title}
            </h1>
            {/* 글과 사진(최대 10장)을 쓴 자리 그대로. 사진을 누르면 크게 보기 */}
            <PostBody
              description={post.description}
              images={photos}
              onOpenImage={(i) => {
                setImageIndex(i);
                setViewerOpen(true);
              }}
            />
          </div>

          {/* 카운트 + 좋아요 버튼 */}
          <div className="flex items-center justify-between px-4 pb-3.5">
            {live ? (
              <span className="text-[13px] text-app-muted">{`좋아요 ${likeCount} · 댓글 ${commentCount}`}</span>
            ) : (
              <span aria-hidden className="h-4 w-28 animate-pulse rounded bg-app-placeholder" />
            )}
            <button
              type="button"
              aria-label="좋아요"
              aria-pressed={isLiked}
              disabled={likeLoading || !likeReady}
              onClick={() => void handleLike()}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-2xl border bg-app-bg px-3 text-[13px] font-semibold",
                isLiked ? "border-app-brand text-app-brand" : "border-app-border text-app-muted"
              )}
            >
              {isLiked ? (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              )}
              좋아요
            </button>
          </div>

          {/* 본문 아래 AdSense. 운영 공지·숨김 글에는 광고를 두지 않는다(앱 InlineBannerAd 와 같은 자리). */}
          {showAds ? <AdSenseUnit placement="postInline" format="horizontal" className="px-4 pb-3.5" /> : null}

          {isNotice && (prevNotice || nextNotice) ? (
            <section className="border-t border-app-line px-4 py-3.5">
              <h3 className="text-[14px] font-semibold text-app-text">다른 공지 보기</h3>
              <div className="mt-2">
                <NoticeLink label="이전 공지" notice={prevNotice} />
                <NoticeLink label="다음 공지" notice={nextNotice} isLast />
              </div>
            </section>
          ) : null}

          {/* 댓글 */}
          <div className="h-2 bg-app-gap" />
          <div className="px-4 pb-1 pt-4">
            <h2 className="text-[16px] font-bold text-app-text">{live ? `댓글 ${commentCount}` : "댓글"}</h2>
          </div>
          <div className="px-4">
            {!live ? (
              error ? (
                <div className="flex flex-col items-center gap-2 py-9">
                  <p className="text-[14px] text-app-muted">댓글을 불러오지 못했어요.</p>
                  <button
                    type="button"
                    onClick={() => void mutate()}
                    className="text-[14px] font-semibold text-app-text underline underline-offset-[3px]"
                  >
                    다시 시도
                  </button>
                </div>
              ) : (
                <CommentsSkeleton />
              )
            ) : commentThreads.length ? (
              commentThreads.map(({ root, replies }, index) => (
                // 구분선은 묶음(루트 + 답글) 사이에만 둔다.
                <div
                  key={root.id}
                  className={cn(index < commentThreads.length - 1 && "border-b border-app-line")}
                >
                  {[root, ...replies].map((item) => (
                    <PostCommentItem
                      key={item.id}
                      item={item}
                      isReply={item !== root}
                      isPostAuthor={Boolean(authorId && item.user?.id === authorId)}
                      highlighted={highlightedCommentId === item.id}
                      accepted={acceptedCommentId === item.id}
                      onMore={() => setCommentSheet(item)}
                      onLike={() => void handleCommentLike(item)}
                      // 답글의 답글도 루트에 달고, 입력바에는 누른 댓글의 작성자를 보여 준다.
                      // 답글에 단 답글이면 입력칸을 '@이름 ' 으로 채운다(쓰던 글이 있으면 그대로 둔다).
                      onReply={() => {
                        startComposer({ kind: "reply", rootId: root.id, targetId: item.id, name: item.user?.name ?? "" });
                        if (user && item !== root && item.user?.name && (!comment.trim() || /^@\S+\s*$/.test(comment))) {
                          setComment(mentionPrefill(item.user.name));
                        }
                      }}
                    />
                  ))}
                </div>
              ))
            ) : (
              <p className="py-9 text-center text-[14px] text-app-muted">
                아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
              </p>
            )}
          </div>
          {/* 쿠팡 배너는 위 AdSense 와 붙지 않게 댓글 맨 아래에 둔다(앱과 같다). */}
          {showAds ? <CoupangBanner /> : null}
          {footer}
        </div>

        {/* 입력바: pill 44 surface + 32 주황 원형 전송 */}
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-30 border-t border-app-line bg-app-bg">
          <div className="mx-auto max-w-xl">
            {loggedOut ? (
              <button
                type="button"
                onClick={goLogin}
                aria-label="로그인하고 댓글 쓰기"
                className="flex w-full items-center justify-center px-4 pb-[max(calc(env(safe-area-inset-bottom)+14px),22px)] pt-3.5 text-[15px] text-app-muted"
              >
                로그인하고 댓글을 남겨보세요
              </button>
            ) : (
              <>
              {/* 답글·수정 모드: 입력바 위 한 줄. × 로 모드를 푼다. */}
              {composerMode ? (
                <div className="flex h-9 items-center gap-2 bg-app-gap pl-4 pr-1">
                  <p className="min-w-0 flex-1 truncate text-[13px] text-app-muted">
                    {composerMode.kind === "reply" ? (
                      <>
                        <span className="font-semibold text-app-text">{composerMode.name}</span>
                        님에게 답글 남기는 중
                      </>
                    ) : (
                      "댓글 수정 중"
                    )}
                  </p>
                  <button
                    type="button"
                    aria-label={composerMode.kind === "reply" ? "답글 취소" : "수정 취소"}
                    onClick={closeComposer}
                    className="grid h-9 w-11 shrink-0 place-items-center text-app-muted"
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" strokeWidth={1.5} strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ) : null}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCommentSubmit();
                }}
                className="flex items-center gap-2 px-3 pb-[max(calc(env(safe-area-inset-bottom)+8px),16px)] pt-2"
              >
                <div className="flex min-h-[44px] flex-1 items-end rounded-[22px] bg-app-surface pl-4 pr-1.5">
                  {/* 여러 줄 입력(모바일 키보드 Enter 는 줄바꿈). 데스크톱은 Enter 로 등록, Shift+Enter 로 줄바꿈. */}
                  <textarea
                    ref={commentInputRef}
                    rows={1}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing &&
                        !isCoarsePointer()
                      ) {
                        event.preventDefault();
                        void handleCommentSubmit();
                      }
                    }}
                    placeholder={composerMode?.kind === "reply" ? "답글을 입력해주세요" : "댓글을 입력해주세요"}
                    aria-label="댓글 입력"
                    maxLength={COMMENT_MAX_LENGTH}
                    disabled={commentLoading}
                    className="max-h-[112px] min-h-[44px] min-w-0 flex-1 resize-none border-0 bg-transparent p-0 py-[11px] text-[15px] leading-[22px] text-app-text outline-none placeholder:text-app-caption focus:ring-0"
                  />
                  <button
                    type="submit"
                    aria-label={composerMode?.kind === "edit" ? "댓글 수정 완료" : "댓글 등록"}
                    disabled={!canSubmitComment}
                    className={cn(
                      "mb-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-app-brand text-white",
                      canSubmitComment ? "opacity-100" : "opacity-40"
                    )}
                  >
                    {commentLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <path d="M5 12h13M12 6l6 6-6 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
              </>
            )}
          </div>
        </div>

        <ImageLightbox
          images={photos.map((id) => makeImageUrl(id, "public"))}
          isOpen={viewerOpen}
          currentIndex={safeImageIndex}
          onClose={() => setViewerOpen(false)}
          onIndexChange={setImageIndex}
          altPrefix="게시글 이미지"
        />
      </>
    );
  };

  return (
    // 분양글 상세와 같은 헤더: ← · 브리디 로고 | 가운데 제목 | ⋯ · 메뉴(2026-10-16 사용자 "분양글 헤더 스타일로").
    <Layout
      canGoBack
      homeAction
      title={post?.title || headerTitle}
      seoTitle={post?.title || "게시글"}
      headerRight={
        sheetActions.length ? (
          <HeaderIconButton label="더보기" onClick={() => setSheetOpen(true)}>
            <MoreIcon />
          </HeaderIconButton>
        ) : (
          <></>
        )
      }
    >
      {/* 같은 글에서 다른 댓글 알림으로 들어오면 그 댓글로 다시 스크롤한다. */}
      <Suspense fallback={null}>
        <FocusCommentFromQuery onFocus={setScrollTargetId} />
      </Suspense>

      {renderBody()}

      {/* 시트·다이얼로그는 차단 게이트에서도 열리도록 분기 밖에 둔다. */}
      <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} actions={sheetActions} />
      {moderation.confirmDialog}
      <ActionSheet
        open={commentSheet != null}
        onClose={() => setCommentSheet(null)}
        actions={commentSheetActions}
      />
      <ReportSheet
        open={reportTarget != null}
        targetType={reportTarget?.type ?? "POST"}
        targetId={reportTarget?.id ?? null}
        onClose={() => setReportTarget(null)}
      />
      <BlockConfirmDialog
        target={blockTarget}
        onClose={() => setBlockTarget(null)}
        // 글 작성자를 차단하면 목록으로 나간다. 댓글 작성자는 상세를 다시 받아 댓글만 사라진다.
        onBlocked={
          blockTarget && blockTarget.id === authorId
            ? () => router.replace("/")
            : () => void mutate()
        }
      />
      <ConfirmDialog
        open={deleteOpen}
        tone="danger"
        title="이 게시글을 삭제할까요?"
        description="삭제 후에는 복구할 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void deleteCurrentPost()}
      />
      <ConfirmDialog
        open={commentDelete != null}
        tone="danger"
        title="이 댓글을 삭제할까요?"
        description={
          commentDeleteHasReplies
            ? "답글은 그대로 남고 '삭제된 댓글입니다'로 표시됩니다."
            : "삭제 후에는 복구할 수 없습니다."
        }
        confirmText="삭제"
        cancelText="취소"
        loading={commentDeleting}
        onCancel={() => setCommentDelete(null)}
        onConfirm={() => void deleteComment()}
      />
    </Layout>
  );
};

export default PostClient;
