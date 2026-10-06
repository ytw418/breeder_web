"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import useUser from "hooks/useUser";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";

/** GET/POST/DELETE /api/blocks 응답(pages/api/blocks 와 같은 모양). */
export interface BlockedUserItem {
  id: number;
  user: { id: number; name: string; avatar: string | null };
  createdAt: string;
}

export interface BlocksResponse {
  success: boolean;
  blocks?: BlockedUserItem[];
  blocked?: boolean;
  blockedUserIds?: number[];
  error?: string;
  errorCode?: string;
}

export const BLOCKS_KEY = "/api/blocks";

/**
 * 차단 후 다시 받아야 하는 SWR 키 접두어. 서버가 차단 사용자를 거르는 목록·상세와
 * 클라이언트가 거르는 공개 캐시 응답(홈 피드·랭킹)을 함께 갱신한다.
 */
export const BLOCK_DEPENDENT_KEY_PREFIXES = [
  "/api/home/feed",
  "/api/ranking",
  "/api/rankings",
  "/api/posts",
  "/api/products",
  "/api/chat",
  "/api/users/",
] as const;

/** SWR 키(문자열·배열·useSWRInfinite "$inf$" 접두어)가 차단 영향 목록인지. */
export function isBlockDependentKey(key: unknown): boolean {
  const raw = Array.isArray(key) ? key[0] : key;
  if (typeof raw !== "string") return false;
  const normalized = raw.replace(/^\$inf\$/, "");
  return BLOCK_DEPENDENT_KEY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

const EMPTY_BLOCKS: BlockedUserItem[] = [];

async function requestBlock(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; data: BlocksResponse | null }> {
  const res = await authFetch(url, init);
  const data = (await res.json().catch(() => null)) as BlocksResponse | null;
  return { ok: res.ok && Boolean(data?.success), data };
}

/**
 * 내 차단 목록(GET /api/blocks, 로그인 시에만)과 차단·해제 동작.
 * 성공하면 차단 목록을 바로 맞추고 차단 영향 목록 키를 다시 받는다. 토스트는 이 훅이 띄운다(앱 문구).
 */
export function useBlocks() {
  const { user } = useUser();
  const { mutate: globalMutate } = useSWRConfig();
  const [pending, setPending] = useState(false);
  const { data, isLoading, mutate } = useSWR<BlocksResponse>(user ? BLOCKS_KEY : null, {
    revalidateOnFocus: false,
  });

  const blockedUserIds = data?.blockedUserIds;
  const blockedIds = useMemo(
    () => new Set<number>(user && blockedUserIds ? blockedUserIds : []),
    [user, blockedUserIds]
  );
  const blocks = (user && data?.blocks) || EMPTY_BLOCKS;

  const isBlocked = useCallback(
    (userId: number | null | undefined) => userId != null && blockedIds.has(userId),
    [blockedIds]
  );

  const applyResult = useCallback(
    async (ids: number[]) => {
      const idSet = new Set(ids);
      await mutate(
        (prev) => ({
          success: true,
          blocks: (prev?.blocks ?? []).filter((item) => idSet.has(item.user.id)),
          blockedUserIds: ids,
        }),
        { revalidate: true }
      );
      void globalMutate(isBlockDependentKey);
    },
    [globalMutate, mutate]
  );

  const block = useCallback(
    async (userId: number): Promise<boolean> => {
      if (pending) return false;
      setPending(true);
      try {
        const { ok, data: result } = await requestBlock(BLOCKS_KEY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!ok) {
          toast.error(result?.error || "차단 중 오류가 발생했습니다.");
          return false;
        }
        await applyResult(result?.blockedUserIds ?? Array.from(blockedIds).concat(userId));
        toast.success("차단했어요. 설정 > 차단 관리에서 해제할 수 있어요.");
        return true;
      } catch {
        toast.error("차단 중 오류가 발생했습니다.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [applyResult, blockedIds, pending]
  );

  const unblock = useCallback(
    async (userId: number): Promise<boolean> => {
      if (pending) return false;
      setPending(true);
      try {
        const { ok, data: result } = await requestBlock(`${BLOCKS_KEY}/${userId}`, {
          method: "DELETE",
        });
        if (!ok) {
          toast.error(result?.error || "차단 해제 중 오류가 발생했습니다.");
          return false;
        }
        await applyResult(
          result?.blockedUserIds ?? Array.from(blockedIds).filter((id) => id !== userId)
        );
        toast.success("차단을 해제했어요.");
        return true;
      } catch {
        toast.error("차단 해제 중 오류가 발생했습니다.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [applyResult, blockedIds, pending]
  );

  return {
    blockedIds,
    blocks,
    isLoading: Boolean(user) && isLoading,
    isPending: pending,
    isBlocked,
    block,
    unblock,
    mutate,
  };
}

export default useBlocks;
