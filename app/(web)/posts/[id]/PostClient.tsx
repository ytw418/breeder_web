"use client";
import useSWR, { useSWRConfig } from "swr";

import Layout from "@components/features/layout";
import Image from "next/image";
import Link from "next/link";

import { cn, makeImageUrl } from "@libs/client/utils";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { useParams, useRouter } from "next/navigation";

import { ChatResponseType } from "pages/api/chat";
import { PostDetailResponse } from "pages/api/posts/[id]";

const PostClient = ({ post, isLiked }: PostDetailResponse) => {
  const query = useParams();

  console.log("post :>> ", post);

  const [getChatRoomId, { loading }] =
    useMutation<ChatResponseType>(`/api/chat`);
  const { user, isLoading } = useUser();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data, mutate: boundMutate } = useSWR<PostDetailResponse>(
    query?.id ? `/api/posts/${query.id}` : null
  );
  const [toggleFav, { loading: favLoading }] = useMutation(
    query?.id ? `/api/posts/${query?.id}/fav` : ""
  );

  const onFavClick = () => {
    if (!favLoading) toggleFav({ data: {} });
    if (!data) return;
    boundMutate((prev) => prev && { ...prev, isLiked: !prev.isLiked }, false);
  };

  return (
    <Layout
      seoTitle={post?.title || "상세 정보"}
      title={post?.title || "상세 정보"}
      canGoBack
    >
      <div className="px-4">
        <div className="mb-8">
          {post?.image ? (
            <div className="relative h-96">
              <Image
                src={makeImageUrl(post.image, "public")}
                className="object-cover bg-slate-300"
                alt="post"
                layout="fill"
                priority={true}
              />
            </div>
          ) : (
            <div className="h-96 bg-slate-300" />
          )}
          <Link
            href={`/profiles/${post?.user?.id}`}
            className="flex items-center py-3 space-x-3 border-t border-b cursor-pointer"
          >
            {post?.user?.avatar ? (
              <Image
                src={makeImageUrl(post.user.avatar, "avatar")}
                className="w-12 h-12 rounded-full bg-slate-300"
                width={48}
                height={48}
                alt="avatar"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-300" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-700">
                {post?.user?.name}
              </p>
              <div className="text-xs font-medium text-gray-500">
                프로필 보기 &rarr;
              </div>
            </div>
          </Link>
          <div className="flex items-center justify-between space-x-2">
            <button
              onClick={onFavClick}
              className={cn(
                "flex items-center justify-center rounded-md p-3 hover:bg-gray-100 focus:outline-none",
                data?.isLiked
                  ? "text-red-500 hover:text-red-600"
                  : "text-gray-400  hover:text-gray-500 "
              )}
            >
              {data?.isLiked ? (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 "
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              )}
            </button>
          </div>
          <div className="mt-5">
            <h1 className="title-7 font-bold text-gray-900">
              {post?.title ?? "-"}
            </h1>
            <p className="my-6 body-3 text-gray-700">{post?.description}</p>
          </div>
          <div>
            {post?.comments.map((data) => (
              <div key={data.id}>
                <div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PostClient;
