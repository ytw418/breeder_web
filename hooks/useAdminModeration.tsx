"use client";
/**
 * 관리자(ADMIN·SUPER_USER)용 ⋯ 시트 항목: 숨기기 / 숨김 해제 / 삭제(관리자). 앱 useAdminModeration 과 같다.
 * 관리자가 아니면 빈 배열이라 화면은 시트 앞에 그대로 펼쳐 넣으면 된다. 확인 창(confirmDialog)은 화면이 그린다.
 */
import { useState } from "react";
import { useSWRConfig } from "swr";
import type { ActionSheetAction } from "@components/app/ActionSheet";
import { authFetch } from "@libs/client/authFetch";
import {
  MODERATION_DONE_MESSAGE,
  MODERATION_LIST_KEY_PREFIXES,
  adminActionKeys,
  moderationConfirmText,
  type ModerationAction,
  type ModerationTargetType,
} from "@libs/client/moderation";
import { revalidateByPrefix } from "@libs/client/swrRevalidate";
import { toast } from "@libs/client/toast";
import useConfirmDialog from "hooks/useConfirmDialog";
import useUser from "hooks/useUser";

export interface AdminModerationTarget {
  targetType: ModerationTargetType;
  targetId: number;
  isHidden: boolean;
  /** 상세를 다시 받는다(댓글은 글 상세). 글·상품·경매 삭제면 화면을 떠나므로 부르지 않는다. */
  refreshDetail?: () => void;
  /** 삭제가 끝난 뒤(보통 목록으로) */
  onDeleted?: () => void;
}

export default function useAdminModeration() {
  const { isAdmin } = useUser();
  const { cache, mutate } = useSWRConfig();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [pending, setPending] = useState(false);

  const run = async (target: AdminModerationTarget, action: ModerationAction) => {
    setPending(true);
    try {
      const res = await authFetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: target.targetType, targetId: target.targetId, action }),
      });
      const result = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !result?.success) throw new Error(result?.error || "조치에 실패했습니다.");
      toast.success(MODERATION_DONE_MESSAGE[action]);
      if (action !== "delete" || target.targetType === "COMMENT") target.refreshDetail?.();
      revalidateByPrefix({ cache, mutate }, MODERATION_LIST_KEY_PREFIXES[target.targetType]);
      if (action === "delete") target.onDeleted?.();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "조치에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  const ask = async (target: AdminModerationTarget, action: ModerationAction) => {
    if (pending) return;
    const text = moderationConfirmText(action, target.targetType);
    const ok = await confirm({ ...text, tone: action === "unhide" ? "default" : "danger" });
    if (ok) await run(target, action);
  };

  const actionsFor = (target: AdminModerationTarget): ActionSheetAction[] =>
    adminActionKeys({ isAdmin, isHidden: target.isHidden }).map((key) =>
      key === "admin-unhide"
        ? { key, label: "숨김 해제 (관리자)", onSelect: () => void ask(target, "unhide") }
        : key === "admin-hide"
          ? { key, label: "숨기기 (관리자)", destructive: true, onSelect: () => void ask(target, "hide") }
          : { key, label: "삭제 (관리자)", destructive: true, onSelect: () => void ask(target, "delete") }
    );

  return { isAdmin, actionsFor, confirmDialog, pending };
}
