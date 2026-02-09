import { Spinner } from "@components/atoms/Spinner";
import { getTimeAgoString } from "@libs/client/utils";
import Link from "next/link";
import { UserCommentListResponse } from "pages/api/users/[id]/comments";
import useSWR from "swr";

const MyCommentList = ({ userId }: { userId?: number }) => {
  const { data, isLoading } = useSWR<UserCommentListResponse>(
    userId ? `/api/users/${userId}/comments` : null
  );

  if (!userId || isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data?.comments?.length) {
    return (
      <div className="app-card flex h-36 flex-col items-center justify-center text-slate-500">
        <p className="app-title-md text-slate-600">작성한 댓글이 없습니다</p>
        <p className="app-caption mt-1">댓글을 작성하면 여기에 모아볼 수 있어요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {data.comments.map((item) => (
        <Link
          key={item.id}
          href={`/posts/${item.post.id}`}
          className="app-card app-card-interactive block px-3.5 py-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="app-caption mb-1.5">게시글 · {item.post.title}</p>
              <p className="app-body-sm line-clamp-2 leading-relaxed text-slate-700">
                {item.comment}
              </p>
              <p className="app-caption mt-2">
                {getTimeAgoString(new Date(item.createdAt))}
              </p>
            </div>
            <span className="app-pill-muted shrink-0">댓글</span>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default MyCommentList;
