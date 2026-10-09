"use client";
/**
 * 팔로워·팔로잉 목록 — 사진형 프로필(앱 profiles/[id]/follows.tsx, PRD S-3, 시안 #follows).
 * 헤더(뒤로 · 프로필 주인 이름) → 같은 너비 탭 2개("팔로워 N" / "팔로잉 N") → 행 목록(끝에 닿으면 다음 페이지).
 * 탭 숫자는 목록을 받기 전엔 프로필 숫자, 받은 뒤엔 응답 total(탈퇴·내가 차단한 사람 제외)이다.
 */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import MainLayout from "@components/features/MainLayout";
import { QueryErrorState } from "@components/app/QueryErrorState";
import FollowUserRow from "@components/features/profile/FollowUserRow";
import { LoadingBlock } from "@components/features/profile/ProfileRows";
import { usePagedList, type PagedListState } from "@components/features/profile/usePagedList";
import { cn } from "@libs/client/utils";
import useUser from "hooks/useUser";
import type { FollowListResponse, FollowListUser } from "@libs/server/followList";
import type { UserResponse } from "pages/api/users/[id]";

type FollowListKind = "followers" | "following";

const EMPTY_MESSAGE: Record<FollowListKind, string> = {
  followers: "아직 팔로워가 없어요",
  following: "아직 팔로우한 사람이 없어요",
};
const LABEL: Record<FollowListKind, string> = { followers: "팔로워", following: "팔로잉" };

const pickUsers = (page: FollowListResponse) => page.users;

function useFollowList(userId: string, kind: FollowListKind, enabled: boolean) {
  return usePagedList<FollowListResponse, FollowListUser>(
    userId && enabled ? `/api/users/${userId}/${kind}` : null,
    pickUsers
  );
}

/** 목록 끝에 닿으면 다음 페이지를 붙인다(앱 onEndReached). */
function EndSentinel({ list }: { list: PagedListState<unknown> }) {
  const ref = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, loadMore } = list;
  useEffect(() => {
    const target = ref.current;
    if (!target || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "400px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, loadMore]);
  return <div ref={ref} aria-hidden="true" />;
}

export default function FollowsClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { user: me } = useUser();
  const [kind, setKind] = useState<FollowListKind>(
    searchParams?.get("tab") === "following" ? "following" : "followers"
  );
  // 프로필 화면과 같은 키라 대개 캐시에서 바로 이름·숫자를 쓴다.
  const { data: profile } = useSWR<UserResponse>(id ? `/api/users/${id}` : null);
  const owner = profile?.user;
  // 보이는 탭만 받는다. 다른 탭은 예전에 받은 캐시가 있으면 그 total 을 숫자로 쓴다.
  const followers = useFollowList(id, "followers", kind === "followers");
  const following = useFollowList(id, "following", kind === "following");
  const list = kind === "followers" ? followers : following;
  const countOf = (target: FollowListKind) =>
    (target === "followers" ? followers : following).firstPage?.total ?? owner?._count?.[target];
  const returnPath = `/profiles/${id}/follows?tab=${kind}`;

  return (
    <MainLayout headerVariant="profile" title={owner?.name}>
      <div role="tablist" className="flex border-b border-app-line">
        {(["followers", "following"] as const).map((target) => {
          const selected = target === kind;
          const count = countOf(target);
          const label = count === undefined ? LABEL[target] : `${LABEL[target]} ${count}`;
          return (
            <button
              key={target}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setKind(target)}
              className={cn(
                "-mb-px h-12 flex-1 border-b-2 text-[15px] transition-colors",
                selected ? "border-app-text font-bold text-app-text" : "border-transparent text-app-muted"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {list.isLoading ? (
        <div role="status" aria-label="불러오는 중">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="h-11 w-11 animate-pulse rounded-full bg-app-placeholder" />
              <div className="flex-1">
                <span className="block h-3.5 w-2/5 animate-pulse rounded bg-app-placeholder" />
                <span className="mt-1.5 block h-3 w-[65%] animate-pulse rounded bg-app-placeholder" />
              </div>
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <QueryErrorState onRetry={() => list.refetch()} />
      ) : list.items.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-app-muted">{EMPTY_MESSAGE[kind]}</p>
      ) : (
        <div className="pb-8">
          {list.items.map((item) => (
            <FollowUserRow key={item.id} user={item} isMe={me?.id === item.id} returnPath={returnPath} />
          ))}
          {list.isFetchingNextPage ? <LoadingBlock height={56} /> : null}
          {list.isFetchNextPageError ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="text-[13px] text-app-muted">더 불러오지 못했어요</p>
              <button
                type="button"
                aria-label={`${LABEL[kind]} 다시 불러오기`}
                onClick={list.loadMore}
                className="text-[13px] font-semibold text-app-text"
              >
                다시 시도
              </button>
            </div>
          ) : null}
          <EndSentinel list={list} />
        </div>
      )}
    </MainLayout>
  );
}
