"use client";

import { useState } from "react";
import useSWR from "swr";

import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import Link from "next/link";

import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { PostDetailResponse } from "pages/api/posts/[id]";
import { toast } from "react-toastify";

interface CommentForm {
  comment: string;
}

const PostClient = ({ post: initialPost }: PostDetailResponse) => {
  const query = useParams();
  const router = useRouter();
  const { user } = useUser();

  // 실시간 데이터 페칭
  const { data, mutate: boundMutate } = useSWR<PostDetailResponse>(
    query?.id ? `/api/posts/${query.id}` : null
  );

  // 좋아요 토글 API
  const [toggleLike, { loading: likeLoading }] = useMutation(
    query?.id ? `/api/posts/${query?.id}/wonder` : ""
  );

  // 댓글 작성 API
  const [postComment, { loading: commentLoading }] = useMutation(
    query?.id ? `/api/posts/${query?.id}/answers` : ""
  );

  const { register, handleSubmit, reset } = useForm<CommentForm>();

  // 현재 표시할 데이터 (SWR 데이터 우선, 없으면 서버 전달 데이터)
  const post = data?.post || initialPost;
  const isLiked = data?.isLiked ?? false;

  /** 좋아요 토글 */
  const handleLike = () => {
    if (!user) {
      return router.push("/auth/login");
    }
    if (likeLoading) return;
    toggleLike({ data: {} });
    boundMutate(
      (prev) => prev && { ...prev, isLiked: !prev.isLiked },
      false
    );
  };

  /** 댓글 작성 */
  const onCommentValid = ({ comment }: CommentForm) => {
    if (!user) {
      return router.push("/auth/login");
    }
    if (commentLoading) return;

    postComment({
      data: { comment },
      onCompleted(result) {
        if (result.success) {
          reset();
          boundMutate();
          toast.success("댓글이 등록되었습니다.");
        }
      },
    });
  };

  if (!post) return null;

  return (
    <Layout
      seoTitle={post?.title || "게시글"}
      title="곤충생활"
      canGoBack
    >
      <div className="pb-20">
        {/* 게시글 본문 */}
        <div className="px-4">
          {/* 작성자 정보 */}
          <div className="flex items-center gap-3 py-4 border-b border-gray-100">
            <Link href={`/profiles/${post.user?.id}`}>
              {post.user?.avatar ? (
                <Image
                  src={makeImageUrl(post.user.avatar, "avatar")}
                  className="w-10 h-10 rounded-full object-cover"
                  width={40}
                  height={40}
                  alt="avatar"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200" />
              )}
            </Link>
            <div className="flex-1">
              <Link
                href={`/profiles/${post.user?.id}`}
                className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors"
              >
                {post.user?.name}
              </Link>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                {post.category && (
                  <>
                    <span className="text-primary font-medium">{post.category}</span>
                    <span>·</span>
                  </>
                )}
                <span>{getTimeAgoString(new Date(post.createdAt))}</span>
              </div>
            </div>
          </div>

          {/* 제목 + 본문 */}
          <div className="py-4 space-y-3">
            <h1 className="text-lg font-bold text-gray-900 leading-snug">
              {post.title}
            </h1>
            <p className="text-[15px] text-gray-700 whitespace-pre-line leading-relaxed">
              {post.description}
            </p>
          </div>

          {/* 이미지 */}
          {post.image && (
            <div className="relative rounded-xl overflow-hidden bg-gray-100 mb-4">
              <Image
                src={makeImageUrl(post.image, "public")}
                className="w-full object-cover"
                alt="게시글 이미지"
                width={600}
                height={400}
              />
            </div>
          )}

          {/* 좋아요 / 댓글 수 + 좋아요 버튼 */}
          <div className="flex items-center justify-between py-3 border-t border-b border-gray-100">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>좋아요 {post._count?.Likes || 0}</span>
              <span>댓글 {post._count?.comments || 0}</span>
            </div>
            <button
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                isLiked
                  ? "text-red-500 bg-red-50"
                  : "text-gray-500 hover:bg-gray-50"
              )}
            >
              {isLiked ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              )}
              좋아요
            </button>
          </div>
        </div>

        {/* 댓글 목록 */}
        <div className="px-4 mt-2">
          {post.comments && post.comments.length > 0 ? (
            <div className="space-y-0 divide-y divide-gray-50">
              {post.comments.map((comment) => (
                <div key={comment.id} className="py-3">
                  <div className="flex gap-2.5">
                    <Link href={`/profiles/${comment.user?.id}`} className="flex-shrink-0">
                      {comment.user?.avatar ? (
                        <Image
                          src={makeImageUrl(comment.user.avatar, "avatar")}
                          className="w-8 h-8 rounded-full object-cover"
                          width={32}
                          height={32}
                          alt=""
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/profiles/${comment.user?.id}`}
                          className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors"
                        >
                          {comment.user?.name}
                        </Link>
                        <span className="text-xs text-gray-400">
                          {getTimeAgoString(new Date(comment.createdAt))}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">
                        {comment.comment}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-gray-400">
              아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
            </div>
          )}
        </div>
      </div>

      {/* 댓글 입력 (하단 고정) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="max-w-xl mx-auto">
          <form
            onSubmit={handleSubmit(onCommentValid)}
            className="flex items-center gap-2 px-4 py-3"
          >
            <input
              {...register("comment", { required: true })}
              type="text"
              placeholder="댓글을 입력해주세요"
              className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={commentLoading}
              className={cn(
                "flex-shrink-0 p-2.5 rounded-full transition-colors",
                "text-primary hover:bg-primary/10 disabled:opacity-50"
              )}
            >
              {commentLoading ? (
                <div className="w-5 h-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default PostClient;
