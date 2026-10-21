"use client";
/**
 * 팔로우 버튼(앱 FollowButton·useFollowMutation·UnfollowConfirmSheet).
 * 팔로우 전은 brand 채움 + 흰 글자, 팔로잉은 surface 배경 + text 글자(시안).
 * - lg: 프로필 블록(높이 36 · r8, 남은 폭을 나눠 가진다)
 * - sm: 팔로워·팔로잉 행(74×32)
 * - card: 홈 '우리 동네 브리더' 카드(높이 32 · r8, 카드 폭을 채운다)
 * sm 은 게시글·분양글·경매 상세 작성자 줄과 랭킹 행에도 쓴다(2026-10-21).
 * '팔로잉'을 누르면 '팔로우 취소' 하나만 있는 시트를 거친다(PRD F-11). 팔로우는 바로 된다.
 * 누르는 즉시 캐시(프로필 숫자·목록 행)를 바꾸고, 실패하면 그 사람 몫만 되돌린다. 바꿀 상태를 보내고, 응답이 최종 상태다.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { revalidateWhere, updateInfiniteWhere } from "@libs/client/swrRevalidate";
import { ActionSheet } from "@components/app/ActionSheet";
import { toLoginHref } from "@components/features/MainLayout";
import { authFetch } from "@libs/client/authFetch";
import { setPendingAction, usePendingAction } from "@libs/client/pendingAction";
import {
  isAuctionDetailKey,
  isFollowListKey,
  isFollowingFeedKey,
  isNearbyKey,
  isPostDetailKey,
  isProductDetailKey,
  isProfileKey,
  isRankingKey,
  withDetailAuthorFollow,
  withFollowListRow,
  withNearbyFollowRow,
  withMyFollowingDelta,
  withTargetFollowState,
  type FollowListPageLike,
  type NearbyLike,
  type ProfileLike,
} from "@libs/client/followState";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import useUser from "hooks/useUser";
import type { SuggestedUsersResponse } from "pages/api/users/suggested";

/** 팔로우 추천(시작하기·팔로잉 빈 상태) SWR 키. */
const isSuggestedKey = (key: unknown) => typeof key === "string" && key.startsWith("/api/users/suggested");

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
    // 홈 동네 카드·브리더 랭킹 행. 순서가 바뀌어 카드가 튀지 않게 다시 받지는 않는다.
    void mutate(
      (key) => isNearbyKey(key) || isRankingKey(key),
      (data?: NearbyLike) => withNearbyFollowRow(data, targetUserId, isFollowing),
      { revalidate: false }
    );
    // 팔로우 추천 행. 서버는 팔로우 중인 사람을 빼고 주므로 다시 받지 않고 버튼만 바꾼다.
    void mutate(
      isSuggestedKey,
      (data?: SuggestedUsersResponse) =>
        data
          ? { ...data, users: data.users.map((row) => (row.id === targetUserId ? { ...row, isFollowing } : row)) }
          : data,
      { revalidate: false }
    );
    // 게시글·분양글·경매 상세의 작성자 줄(그 사람이 쓴 글만 바뀐다).
    for (const [isKey, field] of [
      [isPostDetailKey, "post"],
      [isProductDetailKey, "product"],
      [isAuctionDetailKey, "auction"],
    ] as const) {
      void mutate(isKey, (data?: unknown) => withDetailAuthorFollow(data, field, targetUserId, isFollowing), {
        revalidate: false,
      });
    }
  };

  /** 지금 상태(isFollowing)를 받아 반대로 바꾼다. 처리 중이면 무시한다. */
  const toggle = async (isFollowing: boolean) => {
    if (!me) {
      // 로그인 뒤 이 화면으로 돌아와 팔로우를 이어 한다('로그인하고 팔로우하기').
      if (!isFollowing) setPendingAction({ kind: "follow", targetId: targetUserId, returnPath });
      router.push(toLoginHref(returnPath, "follow"));
      return;
    }
    if (pending) return;
    const next = !isFollowing;
    setPending(true);
    apply(next, next ? 1 : -1);
    try {
      // 바꿀 상태를 보낸다. 이미 그 상태면 서버가 그대로 둔다(화면 값이 낡아도 반대로 뒤집히지 않는다).
      const res = await authFetch(`/api/users/${targetUserId}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow: next }),
      });
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
      // 반려생활 '팔로잉' 목록은 첫 페이지를 다시 받지 않는 무한 목록이라 직접 다시 받게 한다.
      revalidateWhere({ cache, mutate }, isFollowingFeedKey);
    }
  };

  // 로그인 벽에서 누른 팔로우를 로그인 뒤 이어 한다. 팔로우할 상태(true)를 보내므로 이미 팔로우 중이어도 그대로다.
  usePendingAction("follow", targetUserId, () => {
    if (!pending) void toggle(false);
  });

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
  /** nearby: 홈 동네 카드(30 r8, 팔로우는 흰 바탕+테두리, 팔로잉은 주황 채움 — community-vibe 시안 .nbc .f). */
  size: "lg" | "sm" | "card" | "nearby";
}) {
  const { toggle, pending } = useFollowMutation(userId, returnPath);
  const [confirming, setConfirming] = useState(false);

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
          size === "lg" && "h-9 flex-1 rounded-lg text-[14px]",
          size === "sm" && "h-8 w-[74px] rounded-md text-[13px]",
          size === "card" && "h-8 w-full rounded-lg text-[13px]",
          size === "nearby" && "h-[30px] w-full rounded-lg border text-[13px]",
          size === "nearby"
            ? isFollowing
              ? "border-app-brand bg-app-brand text-white"
              : "border-app-border bg-app-bg text-app-text"
            : isFollowing
              ? "bg-app-surface text-app-text"
              : "bg-app-brand text-white",
          pending && "opacity-70"
        )}
      >
        {isFollowing ? "팔로잉" : "팔로우"}
      </button>
      {confirming ? (
        // 시트는 포털이지만 React 이벤트는 부모로 올라간다. 행 링크(랭킹·분양자 줄) 안에서 눌러도 이동하지 않게 막는다.
        <span className="contents" onClick={(event) => event.stopPropagation()}>
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
        </span>
      ) : null}
    </>
  );
}
