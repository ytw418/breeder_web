"use client";
import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import useSWR, { useSWRConfig } from "swr";

import Image from "next/image";
import Layout from "@components/features/layout";
import Link from "next/link";
import { cls } from "@libs/client/utils";
import { makeImageUrl } from "@libs/client/utils";
import useMutation from "@libs/client/useMutation";
import { useParams, useRouter } from "next/navigation";
import useUser from "@libs/client/useUser";

import { ChatResponseType } from "pages/api/chat";
import { PostDetailResponse } from "pages/api/posts/[id]";
import { useForm } from "react-hook-form";
import { Button } from "@components/ui/button";
import { Textarea } from "@components/ui/textarea";
import { toast } from "sonner";

interface CommentForm {
  comment: string;
}

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
  const { register, handleSubmit, reset } = useForm<CommentForm>();
  const [addComment, { loading: addCommentLoading }] = useMutation(
    query?.id ? `/api/posts/${query.id}/comments` : ""
  );

  const onFavClick = () => {
    if (!favLoading) toggleFav({ data: {} });
    if (!data) return;
    boundMutate((prev) => prev && { ...prev, isLiked: !prev.isLiked }, false);
  };

  const onValid = async (formData: CommentForm) => {
    if (addCommentLoading || !query?.id) return;
    
    addComment({
      data: formData,
      onCompleted: (result) => {
        if (result.success) {
          toast.success("댓글이 등록되었습니다.");
          reset();
          mutate(`/api/posts/${query.id}`);
        } else {
          toast.error("댓글 등록에 실패했습니다.");
        }
      },
    });
  };

  return (
    <Layout
      seoTitle={post?.title || "상세 정보"}
      title={post?.title || "상세 정보"}
      canGoBack
      hasTabBar
    >
      <div className="flex flex-col space-y-4 p-4">
        {/* 작성자 정보 */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
            {post?.user?.avatar && (
              <img
                src={post.user.avatar}
                alt={post.user.name}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <span className="font-medium">{post?.user?.name}</span>
        </div>

        {/* 게시물 내용 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{post?.title}</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{post?.description}</p>
          
          {/* 이미지 */}
          {post?.image && (
            <div className="relative aspect-square rounded-lg overflow-hidden">
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* 좋아요/댓글 수 */}
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>댓글 {post?._count?.comments}</span>
            <span>좋아요 {post?._count?.Likes}</span>
          </div>
        </div>

        {/* 댓글 목록 */}
        <div className="space-y-4">
          <h4 className="font-medium">댓글</h4>
          {post?.comments?.map((comment) => (
            <div key={comment.id} className="flex items-start space-x-2">
              <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                {comment.user?.avatar && (
                  <img
                    src={comment.user.avatar}
                    alt={comment.user.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{comment.user?.name}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{comment.comment}</p>
              </div>
            </div>
          ))}

          {/* 댓글 입력 폼 */}
          {user && (
            <form onSubmit={handleSubmit(onValid)} className="space-y-2">
              <Textarea
                {...register("comment", { required: "댓글을 입력해주세요" })}
                placeholder="댓글을 입력해주세요"
                className="min-h-[100px]"
              />
              <Button type="submit" disabled={addCommentLoading} className="w-full">
                {addCommentLoading ? "등록 중..." : "댓글 등록"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PostClient;
