"use client";
/**
 * 하단 탭 빨간 점: 반려생활·경매 최신 1페이지에 이 브라우저에서 안 본 것(최근 7일·내 것 아님)이 있으면 true.
 * 규칙은 libs/shared/unread-marks.ts(앱 src/components/features/navigation/useUnreadTabDots.ts 와 같은 기준).
 * 반려생활은 목록과 같은 관심 카테고리 범위로 본다(목록에 없는 글로 점이 뜨지 않게).
 */
import useSWR from "swr";
import useUser from "hooks/useUser";
import useCategoryScope, { withCategoryPath } from "hooks/useCategoryScope";
import { useSeenMarks } from "@libs/client/unreadMarks";
import { hasUnreadItems, type UnreadItem } from "@libs/shared/unread-marks";

type ListItem = { id: number; createdAt: string; userId?: number; user?: { id?: number } | null };

const SWR_OPTIONS = { revalidateOnFocus: true, dedupingInterval: 60_000 };

const toUnreadItems = (items: ListItem[] | undefined): UnreadItem[] =>
  (items ?? []).map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    authorId: item.user?.id ?? item.userId ?? null,
  }));

export default function useUnreadTabDots(enabled: boolean) {
  const scope = useCategoryScope();
  const marks = useSeenMarks();
  const { user } = useUser();
  const ready = enabled && scope.hydrated && marks.hydrated;
  const { data: posts } = useSWR<{ posts?: ListItem[] }>(
    ready ? withCategoryPath("/api/posts?page=1", scope.categoryPath) : null,
    SWR_OPTIONS
  );
  const { data: auctions } = useSWR<{ auctions?: ListItem[] }>(
    ready ? "/api/auctions?page=1" : null,
    SWR_OPTIONS
  );
  if (!ready) return { posts: false, auctions: false };
  const now = marks.now;
  return {
    posts: hasUnreadItems(toUnreadItems(posts?.posts), marks.seen.post, user?.id, now),
    auctions: hasUnreadItems(toUnreadItems(auctions?.auctions), marks.seen.auction, user?.id, now),
  };
}
