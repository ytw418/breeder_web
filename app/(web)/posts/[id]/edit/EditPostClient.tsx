"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

import { QueryErrorState } from "@components/app/QueryErrorState";
import useUser from "hooks/useUser";
import { extractPostIdFromPath, toPostPath } from "@libs/post-route";
import type { PostDetailResponse } from "pages/api/posts/[id]";
import { PostComposer, PostComposerGate } from "../../_components/PostComposer";
import type { PostComposerInitial } from "../../_lib/postComposer";

/** 게시글 수정(앱 posts/[id]/edit) — 작성 화면과 같은 PostComposer 를 수정 모드로 띄운다. */
export default function EditPostClient() {
  const router = useRouter();
  const params = useParams();
  const postId = extractPostIdFromPath(params?.id);
  const validId = Number.isInteger(postId) && postId > 0;
  const { user } = useUser();

  const { data, error, isLoading, mutate } = useSWR<PostDetailResponse>(
    validId ? `/api/posts/${postId}` : null
  );
  const post = data?.post;
  const isOwner = Boolean(user?.id && post?.user?.id === user.id);

  const initial = useMemo<PostComposerInitial | null>(
    () =>
      post
        ? {
            postId: post.id,
            title: post.title ?? "",
            description: post.description ?? "",
            category: post.category ?? "",
            species: post.type ?? "",
            imageIds: post.images?.length ? post.images : post.image ? [post.image] : [],
          }
        : null,
    [post]
  );

  const closeScreen = () => {
    if (window.history.length > 1) router.back();
    else if (validId) router.replace(toPostPath(postId, post?.title));
    else router.replace("/posts");
  };

  if (validId && isLoading) {
    return (
      <PostComposerGate title="게시글 수정" onClose={closeScreen}>
        <div className="flex flex-1 items-center justify-center">
          <span
            role="status"
            aria-label="불러오는 중"
            className="h-6 w-6 animate-spin rounded-full border-2 border-app-brand border-t-transparent"
          />
        </div>
      </PostComposerGate>
    );
  }

  // 네트워크/5xx 조회 실패는 권한 없음과 구분해 "다시 시도"를 보인다.
  const status = (error as { status?: number } | undefined)?.status;
  if (error && !post && status !== 404 && status !== 403) {
    return (
      <PostComposerGate title="게시글 수정" onClose={closeScreen}>
        <div className="flex flex-1 flex-col justify-center">
          <QueryErrorState title="게시글 정보를 불러오지 못했어요" onRetry={() => void mutate()} />
        </div>
      </PostComposerGate>
    );
  }

  if (!post || !initial || !isOwner) {
    return (
      <PostComposerGate title="게시글 수정" onClose={closeScreen}>
        <div className="flex flex-1 flex-col items-center justify-center px-5">
          <p className="text-[18px] font-bold text-app-text">수정 권한이 없습니다</p>
          <p className="mt-2 text-center text-[15px] leading-[22px] text-app-muted">
            본인이 작성한 게시글만 수정할 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/posts")}
            className="mt-5 h-[52px] w-full rounded-md bg-app-brand text-[16px] font-semibold text-white"
          >
            게시글 목록 보기
          </button>
        </div>
      </PostComposerGate>
    );
  }

  return <PostComposer key={post.id} mode="edit" initial={initial} />;
}
