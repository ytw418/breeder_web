"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { useBlocks } from "hooks/useBlocks";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { CHAT_ROOM_TOAST } from "@libs/shared/chatRoomSettings";

async function postJson(url: string, body: unknown): Promise<boolean> {
  const res = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
  return res.ok && Boolean(data?.success);
}

/**
 * 채팅방 알림 끄기·나가기(앱 docs/prd/chat-room-settings.md). 토스트는 이 훅이 띄우고,
 * 성공하면 채팅 목록·방·안 읽음 숫자(/api/chat 로 시작하는 키)를 다시 받는다.
 */
export function useChatRoomSettings() {
  const { mutate: globalMutate } = useSWRConfig();
  const { block } = useBlocks();
  const [pending, setPending] = useState(false);

  const refreshChat = useCallback(
    () => globalMutate((key) => typeof key === "string" && key.startsWith("/api/chat")),
    [globalMutate]
  );

  const setMuted = useCallback(
    async (roomId: number, muted: boolean): Promise<boolean> => {
      if (pending) return false;
      setPending(true);
      try {
        const ok = await postJson(`/api/chat/${roomId}/mute`, { muted });
        if (!ok) {
          toast.error(CHAT_ROOM_TOAST.muteFailed);
          return false;
        }
        toast.success(muted ? CHAT_ROOM_TOAST.muted : CHAT_ROOM_TOAST.unmuted);
        await refreshChat();
        return true;
      } catch {
        toast.error(CHAT_ROOM_TOAST.muteFailed);
        return false;
      } finally {
        setPending(false);
      }
    },
    [pending, refreshChat]
  );

  /** blockUserId 가 있으면 먼저 차단하고, 차단이 실패하면 나가지 않는다. */
  const leave = useCallback(
    async (roomId: number, blockUserId?: number | null): Promise<boolean> => {
      if (pending) return false;
      setPending(true);
      try {
        if (blockUserId != null && !(await block(blockUserId, { silent: true }))) return false;
        const ok = await postJson(`/api/chat/${roomId}/leave`, {});
        if (!ok) {
          toast.error(CHAT_ROOM_TOAST.leaveFailed);
          return false;
        }
        toast.success(blockUserId != null ? CHAT_ROOM_TOAST.blockedAndLeft : CHAT_ROOM_TOAST.left);
        await refreshChat();
        return true;
      } catch {
        toast.error(CHAT_ROOM_TOAST.leaveFailed);
        return false;
      } finally {
        setPending(false);
      }
    },
    [block, pending, refreshChat]
  );

  return { setMuted, leave, pending };
}
