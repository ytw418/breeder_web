/**
 * 채팅방 사기 주의 카드 닫기 기록(방별, 이 브라우저 localStorage). 앱 src/lib/chatScamNotice.ts(SecureStore)와 같은 키다.
 * 감사 24번, 앱 docs/prd/chat.md.
 */
const KEY_PREFIX = "bredy.chat.scam.";

export function isChatScamNoticeDismissed(roomId: number): boolean {
  try {
    return window.localStorage.getItem(`${KEY_PREFIX}${roomId}`) === "1";
  } catch {
    return false;
  }
}

export function dismissChatScamNotice(roomId: number): void {
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${roomId}`, "1");
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 닫힌다.
  }
}
