"use client";
/**
 * 내 사진 글 프로필 고정/해제(앱 ProfilePinSheet·useProfilePinMutation, PRD F-6).
 * 게시글 상세 ⋯ 메뉴와 프로필 사진 칸 ⋯ 가 같이 쓴다. 성공하면 사진 목록·앨범·그 글 상세를 다시 받는다.
 */
import { useState } from "react";
import { useSWRConfig } from "swr";
import { ActionSheet } from "@components/app/ActionSheet";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";

type PinnablePost = { id: number; profilePinnedAt?: string | Date | null };

export function useProfilePin() {
  const { mutate } = useSWRConfig();
  const [pending, setPending] = useState(false);
  const setPin = async (postId: number, pinned: boolean) => {
    if (pending) return;
    setPending(true);
    try {
      const res = await authFetch(`/api/posts/${postId}/profile-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      });
      const result = (await res.json().catch(() => null)) as {
        success?: boolean;
        pinned?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !result?.success) throw new Error(result?.error || "프로필 고정을 바꾸지 못했어요.");
      toast.success(result.pinned ? "프로필에 고정했어요." : "프로필 고정을 풀었어요.");
      // 사진 목록(무한 목록 키)·앨범·그 글 상세.
      void mutate(
        (key) =>
          typeof key === "string" &&
          (/\/api\/users\/\d+\/posts\?media=photo/.test(key) ||
            key.startsWith("/api/albums/") ||
            key === `/api/posts/${postId}`)
      );
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "프로필 고정을 바꾸지 못했어요.");
    } finally {
      setPending(false);
    }
  };
  return { setPin, pending };
}

/** 사진 칸 ⋯ 를 눌렀을 때 뜨는 시트: '프로필에 고정' 또는 '프로필 고정 해제' 하나. */
export default function ProfilePinSheet({ post, onClose }: { post: PinnablePost | null; onClose: () => void }) {
  const { setPin } = useProfilePin();
  const pinned = Boolean(post?.profilePinnedAt);
  return (
    <ActionSheet
      open={Boolean(post)}
      onClose={onClose}
      actions={
        post
          ? [
              {
                key: pinned ? "profile-unpin" : "profile-pin",
                label: pinned ? "프로필 고정 해제" : "프로필에 고정",
                onSelect: () => void setPin(post.id, !pinned),
              },
            ]
          : []
      }
    />
  );
}
