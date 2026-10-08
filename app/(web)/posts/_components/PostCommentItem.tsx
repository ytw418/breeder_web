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

/**
 * 게시글 댓글 한 줄(앱 src/components/features/post/PostCommentItem.tsx 와 같은 구성).
 * 루트: 아바타 36 · 이름 14 · 본문 15. 답글: 왼쪽 46 들여쓰기 · 아바타 28 · 이름 13 · 본문 14.
 * 본문 아래 '답글쓰기', 고친 댓글은 시간 옆 '수정됨', 지운 루트는 '삭제된 댓글입니다.' 한 줄만 남는다.
 */
export function PostCommentItem({
  item,
  isReply = false,
  onMore,
  onReply,
}: {
  item: PostCommentItemData;
  isReply?: boolean;
  onMore: () => void;
  onReply: () => void;
}) {
  if (item.deletedAt) {
    return (
      <div className={cn("py-3.5", isReply && "pl-[46px]")}>
        <p className="text-[14px] leading-[20px] text-app-muted">{DELETED_COMMENT_TEXT}</p>
      </div>
    );
  }

  const avatarSize = isReply ? 28 : 36;
  return (
    <div className={cn("flex py-3.5", isReply ? "gap-2 pl-[46px]" : "gap-2.5")}>
      <Link href={`/profiles/${item.user?.id}`} aria-label="댓글 작성자 프로필" className="shrink-0">
        <PostAvatar user={item.user} size={avatarSize} />
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
          <span className="shrink-0 text-[12px] text-app-muted">
            {timeAgo(item.createdAt)}
            {item.editedAt ? " · 수정됨" : ""}
          </span>
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
        <button
          type="button"
          onClick={onReply}
          className="-mb-1.5 mt-0.5 h-8 text-[13px] font-semibold text-app-muted"
        >
          답글쓰기
        </button>
      </div>
    </div>
  );
}
