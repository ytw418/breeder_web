/**
 * 채팅방 나가기·알림 끄기·차단 메뉴와 문구(앱 docs/prd/chat-room-settings.md).
 * 앱 src/lib/chatRoomSettings.ts 와 같은 사본이다 — 함께 고친다.
 */

export type ChatRoomActionId = "mute" | "unmute" | "report" | "block" | "unblock" | "leave";

export interface ChatRoomActionItem {
  id: ChatRoomActionId;
  label: string;
  destructive?: boolean;
}

/**
 * 채팅방 ⋮ 시트·목록 길게 누르기 시트의 행 순서: 알림 → 신고 → 차단 → 나가기(빨강).
 * 상대가 탈퇴했으면(canModerate=false) 신고·차단을 뺀다.
 */
export function chatRoomActions({
  muted,
  partnerBlocked,
  canModerate,
}: {
  muted: boolean;
  partnerBlocked: boolean;
  canModerate: boolean;
}): ChatRoomActionItem[] {
  const actions: ChatRoomActionItem[] = [
    muted ? { id: "unmute", label: "알림 켜기" } : { id: "mute", label: "알림 끄기" },
  ];
  if (canModerate) {
    actions.push({ id: "report", label: "신고하기" });
    actions.push(
      partnerBlocked ? { id: "unblock", label: "차단 해제" } : { id: "block", label: "차단하기" }
    );
  }
  actions.push({ id: "leave", label: "채팅방 나가기", destructive: true });
  return actions;
}

/** 목록 길게 누르기 시트 제목. */
export function chatRoomSheetTitle(partnerName: string | null | undefined): string {
  return partnerName ? `${partnerName}님과의 채팅` : "채팅방";
}

/** 나가기 확인 창 문구. partnerName 이 없으면(탈퇴 상대) 차단·신고 줄을 그리지 않는다. */
export function leaveChatCopy(partnerName: string | null | undefined) {
  const name = partnerName ?? "";
  return {
    title: "채팅방을 나갈까요?",
    description: name
      ? `대화 내용이 내 채팅 목록에서 사라지고 다시 볼 수 없어요. ${name}님에게는 알리지 않아요. 상대가 다시 메시지를 보내면 채팅방이 다시 생겨요.`
      : "대화 내용이 내 채팅 목록에서 사라지고 다시 볼 수 없어요.",
    blockLabel: `${name}님 차단하기`,
    blockHint: "연락을 완전히 끊으려면 차단도 함께 하세요.",
    reportLink: "나가기 전에 신고하기 ›",
    cancel: "취소",
    confirm: (withBlock: boolean) => (withBlock ? "차단하고 나가기" : "나가기"),
  };
}

export const CHAT_ROOM_TOAST = {
  left: "채팅방을 나갔어요",
  blockedAndLeft: "차단하고 채팅방을 나갔어요",
  leaveFailed: "채팅방을 나가지 못했어요. 다시 시도해 주세요.",
  muted: "이 채팅방 알림을 껐어요",
  unmuted: "이 채팅방 알림을 켰어요",
  muteFailed: "알림 설정을 바꾸지 못했어요.",
} as const;
