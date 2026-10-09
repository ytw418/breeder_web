"use client";
/**
 * 팔로우 버튼(앱 FollowButton·useFollowMutation·UnfollowConfirmSheet).
 * 팔로우 전은 brand 채움 + 흰 글자, 팔로잉은 surface 배경 + text 글자(시안).
 * - lg: 프로필 블록(높이 36 · r8, 남은 폭을 나눠 가진다)
 * - sm: 팔로워·팔로잉 행(74×32)
 * '팔로잉'을 누르면 '팔로우 취소' 하나만 있는 시트를 거친다(PRD F-11). 팔로우는 바로 된다.
 * 누르는 즉시 캐시(프로필 숫자·목록 행)를 바꾸고, 실패하면 그 사람 몫만 되돌린다. 서버는 토글이라 응답이 최종 상태다.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { updateInfiniteWhere } from "@libs/client/swrRevalidate";
import { ActionSheet } from "@components/app/ActionSheet";
import { toLoginHref } from "@components/features/MainLayout";
import { authFetch } from "@libs/client/authFetch";
import {
  isFollowListKey,
  isProfileKey,
  withFollowListRow,
  withMyFollowingDelta,
  withTargetFollowState,
  type FollowListPageLike,
  type ProfileLike,
} from "@libs/client/followState";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import useUser from "hooks/useUser";

function useFollowMutation(targetUserId: number, returnPath: string) {
  const router = useRouter();
  const { user: me } = useUser();
  const { mutate, cache } = useSWRConfig();
  const [pending, setPending] = useState(false);

  const apply = (isFollowing: boolean, delta: number) => {
    void mutate(
      (key) => isProfileKey(key, targetUserId),
      (data?: ProfileLike) => withTargetFollowState(data, isFollowing, delta),
      { revalidate: false }
    );
    if (me?.id && delta !== 0) {
      void mutate(
        (key) => isProfileKey(key, me.id),
        (data?: ProfileLike) => withMyFollowingDelta(data, delta),
        { revalidate: false }
      );
    }
    // 팔로워·팔로잉 목록은 무한 목록 키라 전역 필터로는 닿지 않는다. 캐시에서 키를 찾아 바꾼다.
    updateInfiniteWhere<FollowListPageLike>({ cache, mutate }, isFollowListKey, (pages) =>
      withFollowListRow(pages, targetUserId, isFollowing)
    );
  };

  /** 지금 상태(isFollowing)를 받아 반대로 바꾼다. 처리 중이면 무시한다. */
  const toggle = async (isFollowing: boolean) => {
    if (!me) {
      router.push(toLoginHref(returnPath));
      return;
    }
    if (pending) return;
    const next = !isFollowing;
    setPending(true);
    apply(next, next ? 1 : -1);
    try {
      const res = await authFetch(`/api/users/${targetUserId}/follow`, { method: "POST" });
      const result = (await res.json().catch(() => null)) as {
        success?: boolean;
        isFollowing?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !result?.success) throw new Error(result?.error || "팔로우 처리에 실패했습니다.");
      // 화면 값이 낡았어도 서버 결과로 맞춘다(숫자는 프로필을 다시 받아 맞춘다).
      if (typeof result.isFollowing === "boolean") apply(result.isFollowing, 0);
    } catch (error) {
      apply(isFollowing, next ? -1 : 1);
      toast.error(error instanceof Error && error.message ? error.message : "팔로우 처리에 실패했습니다.");
    } finally {
      setPending(false);
      void mutate((key) => isProfileKey(key, targetUserId) || (me?.id ? isProfileKey(key, me.id) : false));
    }
  };

  return { toggle, pending };
}

export default function FollowButton({
  userId,
  isFollowing,
  returnPath,
  size,
}: {
  userId: number;
  isFollowing: boolean;
  /** 비로그인으로 누르면 로그인 뒤 돌아올 경로. */
  returnPath: string;
  size: "lg" | "sm";
}) {
  const { toggle, pending } = useFollowMutation(userId, returnPath);
  const [confirming, setConfirming] = useState(false);
  const lg = size === "lg";
  return (
    <>
      <button
        type="button"
        aria-label={isFollowing ? "팔로잉, 누르면 팔로우 취소" : "팔로우"}
        aria-pressed={isFollowing}
        aria-busy={pending}
        disabled={pending}
        onClick={(event) => {
          // 목록 행(링크) 안에 있어도 행 이동이 같이 일어나지 않게 한다.
          event.preventDefault();
          event.stopPropagation();
          if (isFollowing) setConfirming(true);
          else void toggle(false);
        }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center font-semibold transition-opacity",
          lg ? "h-9 flex-1 rounded-lg text-[14px]" : "h-8 w-[74px] rounded-md text-[13px]",
          isFollowing ? "bg-app-surface text-app-text" : "bg-app-brand text-white",
          pending && "opacity-70"
        )}
      >
        {isFollowing ? "팔로잉" : "팔로우"}
      </button>
      {confirming ? (
        <ActionSheet
          open
          onClose={() => setConfirming(false)}
          actions={[
            {
              key: "unfollow",
              label: "팔로우 취소",
              destructive: true,
              onSelect: () => {
                setConfirming(false);
                void toggle(true);
              },
            },
          ]}
        />
      ) : null}
    </>
  );
}
