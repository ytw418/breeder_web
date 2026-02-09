import Image from "@components/atoms/Image";
import { Spinner } from "@components/atoms/Spinner";
import { getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import Link from "next/link";
import { UserPostListResponse } from "pages/api/users/[id]/posts";
import useSWR from "swr";

const MyCommunityPostList = ({ userId }: { userId?: number }) => {
  const { data, isLoading } = useSWR<UserPostListResponse>(
    userId ? `/api/users/${userId}/posts` : null
  );

  if (!userId || isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data?.posts?.length) {
    return (
      <div className="app-card flex h-36 flex-col items-center justify-center text-slate-500">
        <p className="app-title-md text-slate-600">등록한 게시물이 없습니다</p>
        <p className="app-caption mt-1">첫 게시글을 작성해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {data.posts.map((post) => (
        <Link
          key={post.id}
          href={`/posts/${post.id}`}
          className="app-card app-card-interactive block px-3.5 py-3"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-1.5">
                {post.category && (
                  <span className="app-pill-accent">{post.category}</span>
                )}
                <span className="app-caption">
                  {getTimeAgoString(new Date(post.createdAt))}
                </span>
              </div>
              <h3 className="app-title-md line-clamp-1 leading-snug">
                {post.title}
              </h3>
              <p className="app-body-sm mt-1 line-clamp-2 leading-relaxed">
                {post.description}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="app-pill-muted">댓글 {post._count.comments}</span>
                <span className="app-pill-muted bg-rose-50 text-rose-500">
                  좋아요 {post._count.Likes}
                </span>
              </div>
            </div>

            {Boolean(post.image) && (
              <div className="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                <Image
                  src={
                    post.image.includes("http")
                      ? post.image
                      : makeImageUrl(post.image, "public")
                  }
                  alt={post.title}
                  width={72}
                  height={72}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
};

export default MyCommunityPostList;
