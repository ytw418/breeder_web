import Link from "next/link";

import { cn, getTimeAgoString } from "@libs/client/utils";
import { DELETED_COMMENT_TEXT } from "@libs/shared/comment";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import { PostAvatar } from "./PostAvatar";

export interface PostCommentItemData {
  id: number;
  comment: string;
  createdAt: string | Date;
  editedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  isHidden?: boolean;
  likeCount?: number;
  isLiked?: boolean;
  user: {
    id: number;
    name: string;
    avatar: string | null;
    breederPrograms?: BreederProgramSummary[] | null;
  };
}

const timeAgo = (value: string | Date) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : getTimeAgoString(date);
};

/** 이름 옆 작은 회색 pill('작성자'·'비공개'). 앱 HiddenPill 과 같은 모양 */
function NeutralPill({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-full bg-app-surface px-1.5 py-px text-[11px] font-semibold text-app-muted">
      {children}
    </span>
  );
}

/** 게시글 댓글 DOM id. 알림·프로필에서 ?commentId= 로 열면 이 위치로 스크롤한다. */
export const commentAnchorId = (commentId: number) => `comment-${commentId}`;

/**
 * 게시글 댓글 한 줄(앱 src/components/features/post/PostCommentItem.tsx 와 같은 구성).
 * 루트: 아바타 36 · 이름 14 · 본문 15. 답글: 왼쪽 46 들여쓰기 · 아바타 28 · 이름 13 · 본문 14.
 * 이름 옆 '작성자'(글쓴이 댓글)·'비공개'(운영자 숨김), 시간 옆 '수정됨',
 * 본문 아래 좋아요·답글쓰기. 지운 루트는 '삭제된 댓글입니다.' 한 줄만 남는다.
 * highlighted 면 잠깐 회색 배경으로 눈에 띄게 한다(그 댓글로 이동했을 때).
 */
export function PostCommentItem({
  item,
  isReply = false,
  isPostAuthor = false,
  highlighted = false,
  onMore,
  onReply,
  onLike,
}: {
  item: PostCommentItemData;
  isReply?: boolean;
  isPostAuthor?: boolean;
  highlighted?: boolean;
  onMore: () => void;
  onReply: () => void;
  onLike: () => void;
}) {
  // 좌우 여백(16)까지 배경이 차도록 음수 여백 + 같은 만큼 안쪽 여백을 둔다.
  const rowClass = cn(
    "-mx-4 px-4 transition-colors duration-500",
    highlighted ? "bg-app-surface" : "bg-transparent"
  );

  if (item.deletedAt) {
    return (
      <div id={commentAnchorId(item.id)} className={cn(rowClass, "py-3.5")}>
        <p className={cn("text-[14px] leading-[20px] text-app-muted", isReply && "pl-[46px]")}>
          {DELETED_COMMENT_TEXT}
        </p>
      </div>
    );
  }

  const likeCount = item.likeCount ?? 0;
  return (
    <div id={commentAnchorId(item.id)} className={rowClass}>
      <div className={cn("flex pb-2 pt-3.5", isReply ? "gap-2 pl-[46px]" : "gap-2.5")}>
        <Link href={`/profiles/${item.user?.id}`} aria-label="댓글 작성자 프로필" className="shrink-0">
          <PostAvatar user={item.user} size={isReply ? 28 : 36} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/profiles/${item.user?.id}`}
              className={cn(
                "min-w-0 truncate font-semibold text-app-text",
                isReply ? "text-[13px]" : "text-[14px]"
              )}
            >
              {item.user?.name}
            </Link>
            {isPostAuthor ? <NeutralPill>작성자</NeutralPill> : null}
            <span className="shrink-0 text-[12px] text-app-muted">
              {timeAgo(item.createdAt)}
              {item.editedAt ? " · 수정됨" : ""}
            </span>
            {item.isHidden ? <NeutralPill>비공개</NeutralPill> : null}
            <button
              type="button"
              aria-label="댓글 더보기"
              onClick={onMore}
              className="-m-3 ml-auto grid h-11 w-11 shrink-0 place-items-center text-app-caption"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx={12} cy={5} r={1.6} />
                <circle cx={12} cy={12} r={1.6} />
                <circle cx={12} cy={19} r={1.6} />
              </svg>
            </button>
          </div>
          <p
            className={cn(
              "mt-1 whitespace-pre-line break-words text-app-text",
              isReply ? "text-[14px] leading-[20px]" : "text-[15px] leading-[22px]"
            )}
          >
            {item.comment}
          </p>
          <div className="mt-0.5 flex items-center gap-3">
            <button
              type="button"
              aria-label={item.isLiked ? "댓글 좋아요 취소" : "댓글 좋아요"}
              aria-pressed={Boolean(item.isLiked)}
              onClick={onLike}
              className={cn(
                "flex h-8 items-center gap-1 text-[13px] font-semibold",
                item.isLiked ? "text-app-brand" : "text-app-muted"
              )}
            >
              {item.isLiked ? (
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              )}
              {likeCount > 0 ? `좋아요 ${likeCount}` : "좋아요"}
            </button>
            <button
              type="button"
              onClick={onReply}
              className="h-8 text-[13px] font-semibold text-app-muted"
            >
              답글쓰기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
