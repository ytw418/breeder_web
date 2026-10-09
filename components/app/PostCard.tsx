"use client";

import Link from "next/link";
import Image from "@components/atoms/Image";
import { BreederProgramBadge } from "@components/features/breeder/BreederProgramDecorators";
import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import { postCategoryLabel } from "@libs/shared/postCategory";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import { toPostPlainText } from "@libs/shared/post-body";
import { useIsUnread } from "@libs/client/unreadMarks";

export type PostCardData = {
  id: number;
  title: string;
  /** 본문 요약(1줄). 없으면 줄을 그리지 않는다. */
  content?: string | null;
  /** content 대신 서버가 주는 요약 필드(앱 PostWithUser.description). */
  description?: string | null;
  category?: string | null;
  /** '동네' 글이면 작성자 시/군/구(메타에 카테고리 대신 보인다). */
  regionSigungu?: string | null;
  image?: string | null;
  images?: string[] | null;
  createdAt: string | Date;
  user?: {
    id?: number;
    name: string;
    breederPrograms?: BreederProgramSummary[] | null;
  } | null;
  _count?: { Likes?: number; comments?: number } | null;
  /** 목록 API 의 최신 댓글 한 줄. 없으면(구 서버 포함) 줄을 그리지 않는다. */
  latestComment?: { id: number; comment: string; user?: { name: string } | null } | null;
};

/** 질문 카테고리. 제목 앞 '질문' 표시와 '아직 답변이 없어요' 줄을 단다. */
const QUESTION_CATEGORY = "질문";

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

/** 시간·좋아요(·댓글) 덩어리. 0인 반응 수는 숨긴다. 목록 카드는 댓글 수를 제목 옆 [N]으로 보여 빼고 부른다. */
export function getPostCardStats(
  post: Pick<PostCardData, "createdAt" | "_count">,
  { includeComments = true }: { includeComments?: boolean } = {}
) {
  const date = toDate(post.createdAt);
  const likes = post._count?.Likes ?? 0;
  const comments = post._count?.comments ?? 0;
  return [
    Number.isNaN(date.getTime()) ? null : getTimeAgoString(date),
    likes > 0 ? `좋아요 ${likes}` : null,
    includeComments && comments > 0 ? `댓글 ${comments}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 본문 요약 한 줄: 마크다운 이미지·링크 기호와 줄바꿈을 걷어 낸다. */
const toExcerpt = (value?: string | null) =>
  (value ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * 반려생활 게시글 행(앱 PostCard, 시안 design/mockups/feed-engagement/A-karrot.html ①).
 * [안 본 글 빨간 점][질문 pill] 제목 16/500(2줄) + 댓글 수 [N](brand) · 본문 14 app-sub 2줄
 * · 최신 댓글 한 줄(말풍선 + 닉네임 600 + 내용) 또는 질문에 답이 없으면 '아직 답변이 없어요 · 첫 답변을 남겨 주세요'
 * · 메타 13 app-muted "카테고리 · 닉네임" [브리더 pill] "· 3분 전 · 좋아요 3"(질문 글은 카테고리를 pill 로 옮겨 뺀다)
 * · 오른쪽 72px 썸네일(r8, 사진 2장 이상이면 장수). 하단 1px app-line.
 */
export function PostCard({ post, className }: { post: PostCardData; className?: string }) {
  const images = post.images?.length ? post.images : post.image ? [post.image] : [];
  const thumbnail = images[0] ?? null;
  const excerpt = toExcerpt(post.content ?? toPostPlainText(post.description ?? ""));
  const isQuestion = post.category === QUESTION_CATEGORY;
  const author = [isQuestion ? null : postCategoryLabel(post), post.user?.name]
    .filter(Boolean)
    .join(" · ");
  const stats = getPostCardStats(post, { includeComments: false });
  const comments = post._count?.comments ?? 0;
  const latest = post.latestComment;
  const unread = useIsUnread("post", {
    id: post.id,
    createdAt: post.createdAt,
    authorId: post.user?.id ?? null,
  });

  return (
    <Link
      href={toPostPath(post.id, post.title)}
      className={cn(
        "flex items-start gap-3 border-b border-app-line bg-app-bg px-4 py-3.5",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          {unread ? (
            <span
              aria-label="안 본 글"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-danger"
            />
          ) : null}
          {isQuestion ? (
            <span className="mt-0.5 h-[18px] shrink-0 rounded px-1.5 text-[11px] font-semibold leading-[18px] text-app-sub bg-app-surface">
              질문
            </span>
          ) : null}
          <p className="line-clamp-2 min-w-0 break-keep text-[16px] font-medium leading-[22px] text-app-text">
            {post.title}
            {comments > 0 ? (
              <span className="ml-1 font-bold text-app-brand">[{comments}]</span>
            ) : null}
          </p>
        </div>
        {excerpt ? (
          <p className="mt-1 line-clamp-2 text-[14px] leading-5 text-app-sub">{excerpt}</p>
        ) : null}
        {latest ? (
          <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[13px] leading-[18px] text-app-sub">
            <CommentBubbleIcon />
            {latest.user?.name ? (
              <span className="shrink-0 font-semibold text-app-text">{latest.user.name}</span>
            ) : null}
            <span className="truncate">{latest.comment}</span>
          </p>
        ) : isQuestion && comments === 0 ? (
          <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[13px] leading-[18px] text-app-muted">
            <QuestionCircleIcon />
            <span className="truncate">아직 답변이 없어요 · 첫 답변을 남겨 주세요</span>
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
          {author ? <span className="truncate text-[13px] text-app-muted">{author}</span> : null}
          <BreederProgramBadge programs={post.user?.breederPrograms} />
          {stats ? (
            <span className="truncate text-[13px] text-app-muted">
              {author ? `· ${stats}` : stats}
            </span>
          ) : null}
        </div>
      </div>
      {thumbnail ? (
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-app-placeholder">
          <Image
            src={makeImageUrl(thumbnail, "public")}
            alt={post.title}
            width={72}
            height={72}
            className="h-full w-full object-cover"
          />
          {images.length > 1 ? (
            <span className="absolute bottom-1 right-1 h-[18px] min-w-[18px] rounded-full bg-app-overlay px-[5px] text-center text-[11px] font-semibold leading-[18px] text-white">
              {images.length}
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

function CommentBubbleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className="shrink-0 text-app-muted">
      <path
        d="M4.5 18.5l1.2-3.3A7.5 7.5 0 1 1 9 18.6l-4.5-.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuestionCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9.8 9.6a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.7v.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.6" r=".9" fill="currentColor" />
    </svg>
  );
}

export default PostCard;
