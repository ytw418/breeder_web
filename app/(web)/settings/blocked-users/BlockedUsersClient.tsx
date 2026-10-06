"use client";

import { useState } from "react";
import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { LoadingBlock, SMALL_BUTTON_CLASS } from "@components/features/profile/ProfileRows";
import { makeImageUrl } from "@libs/client/utils";
import useBlocks, { BLOCKS_KEY, type BlockedUserItem, type BlocksResponse } from "hooks/useBlocks";
import useSWR from "swr";

function BlockedUserRow({
  item,
  pending,
  onUnblock,
}: {
  item: BlockedUserItem;
  pending: boolean;
  onUnblock: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-app-line px-4 py-3.5">
      {item.user.avatar ? (
        <Image
          src={makeImageUrl(item.user.avatar, "avatar")}
          alt={`${item.user.name} 프로필 이미지`}
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-full bg-app-surface object-cover"
        />
      ) : (
        <div className="h-11 w-11 shrink-0 rounded-full bg-app-surface" aria-hidden="true" />
      )}
      <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-app-text">{item.user.name}</p>
      <button
        type="button"
        aria-label={`${item.user.name} 차단 해제`}
        disabled={pending}
        onClick={onUnblock}
        className={SMALL_BUTTON_CLASS}
      >
        차단 해제
      </button>
    </div>
  );
}

/** 설정 > 차단 관리(앱 settings/blocked-users.tsx). 차단 해제는 확인 없이 바로 실행하고 토스트로 알린다. */
export default function BlockedUsersClient() {
  const { blocks, isLoading, unblock } = useBlocks();
  // 오류 여부는 같은 키(SWR 캐시 공유)로 읽는다.
  const { data, error, mutate } = useSWR<BlocksResponse>(BLOCKS_KEY, { revalidateOnFocus: false });
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);

  const handleUnblock = async (userId: number) => {
    if (pendingUserId !== null) return;
    setPendingUserId(userId);
    try {
      await unblock(userId);
    } finally {
      setPendingUserId(null);
    }
  };

  let content;
  if (isLoading) {
    content = <LoadingBlock />;
  } else if (error && !data) {
    content = <QueryErrorState onRetry={() => void mutate()} />;
  } else if (!blocks.length) {
    content = (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[14px] text-app-muted">차단한 사용자가 없어요.</p>
      </div>
    );
  } else {
    content = (
      <div>
        {blocks.map((item) => (
          <BlockedUserRow
            key={item.id}
            item={item}
            pending={pendingUserId === item.user.id}
            onUnblock={() => void handleUnblock(item.user.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <Layout canGoBack title="차단 관리" seoTitle="차단 관리">
      <div className="bg-app-bg pb-4">{content}</div>
    </Layout>
  );
}
