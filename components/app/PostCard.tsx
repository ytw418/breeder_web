"use client";

import Link from "next/link";
import Image from "@components/atoms/Image";
import { BreederProgramBadge } from "@components/features/breeder/BreederProgramDecorators";
import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import { postCategoryLabel } from "@libs/shared/postCategory";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";

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
};

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

/** 시간·좋아요·댓글 덩어리. 0인 반응 수는 숨긴다. */
export function getPostCardStats(post: Pick<PostCardData, "createdAt" | "_count">) {
  const date = toDate(post.createdAt);
  const likes = post._count?.Likes ?? 0;
  const comments = post._count?.comments ?? 0;
  return [
    Number.isNaN(date.getTime()) ? null : getTimeAgoString(date),
    likes > 0 ? `좋아요 ${likes}` : null,
    comments > 0 ? `댓글 ${comments}` : null,
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
 * 당근 '동네생활' 톤 게시글 플랫 행(앱 PostCard).
 * 제목 16/500(2줄) · 본문 14 app-sub 1줄 · 메타 13 app-muted "카테고리 · 닉네임"('동네' 글은 "강남구 · 닉네임") [브리더 pill] "· 3분 전 · 좋아요 3 · 댓글 2"
 * · 오른쪽 56px 썸네일(r8). 하단 1px app-line.
 */
export function PostCard({ post, className }: { post: PostCardData; className?: string }) {
  const thumbnail = post.images?.[0] ?? post.image ?? null;
  const excerpt = toExcerpt(post.content ?? post.description);
  const author = [postCategoryLabel(post), post.user?.name].filter(Boolean).join(" · ");
  const stats = getPostCardStats(post);

  return (
    <Link
      href={toPostPath(post.id, post.title)}
      className={cn(
        "flex items-start gap-3 border-b border-app-line bg-app-bg px-4 py-3.5",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-keep text-[16px] font-medium leading-[22px] text-app-text">
          {post.title}
        </p>
        {excerpt ? (
          <p className="mt-1 truncate text-[14px] leading-5 text-app-sub">{excerpt}</p>
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
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-app-placeholder">
          <Image
            src={makeImageUrl(thumbnail, "public")}
            alt={post.title}
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
    </Link>
  );
}

export default PostCard;
