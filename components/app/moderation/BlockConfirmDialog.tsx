"use client";

import { useState } from "react";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import useBlocks from "hooks/useBlocks";

/**
 * 사용자 차단 확인 창(앱 BlockConfirmDialog 와 같은 문구). 확인하면 서버에 차단을 요청하고
 * (토스트는 useBlocks 가 띄운다) 성공 시 onBlocked 를 부른다. target 이 null 이면 아무것도 그리지 않는다.
 */
export function BlockConfirmDialog({
  target,
  onClose,
  onBlocked,
}: {
  target: { id: number; name: string } | null;
  onClose: () => void;
  onBlocked?: () => void;
}) {
  const { block } = useBlocks();
  const [loading, setLoading] = useState(false);

  if (!target) return null;

  return (
    <ConfirmDialog
      open
      tone="danger"
      title={`${target.name}님을 차단할까요?`}
      description="차단하면 이 사용자의 게시글·댓글·분양글·경매가 보이지 않고 서로 채팅할 수 없어요. 서로 팔로우도 해제되고, 차단을 풀어도 팔로우는 돌아오지 않아요. 설정 > 차단 관리에서 해제할 수 있어요."
      confirmText="차단"
      cancelText="취소"
      loading={loading}
      onCancel={onClose}
      onConfirm={async () => {
        if (loading) return;
        setLoading(true);
        const ok = await block(target.id);
        setLoading(false);
        onClose();
        if (ok) onBlocked?.();
      }}
    />
  );
}

export default BlockConfirmDialog;
