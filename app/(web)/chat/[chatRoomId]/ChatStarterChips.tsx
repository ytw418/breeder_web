"use client";

/**
 * 채팅방 추천 칩 — 앱 ChatStarterChips (시안 trade-review #chat-buyer-empty .starter).
 * 입력바 바로 위 가로 스크롤 한 줄(좌우 16 · 위아래 8 · 간격 8), 칩 32 r16 1px border · 13 text.
 * 누르면 입력창을 거치지 않고 그 문구를 바로 보낸다(화면이 productId 와 함께 전송).
 */
export function ChatStarterChips({
  chips,
  disabled = false,
  onSend,
}: {
  chips: readonly string[];
  disabled?: boolean;
  onSend: (text: string) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div
      aria-label="추천 메시지"
      className="flex shrink-0 gap-2 overflow-x-auto bg-app-bg px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          disabled={disabled}
          aria-label={`${chip} 보내기`}
          onClick={() => onSend(chip)}
          className="h-8 shrink-0 whitespace-nowrap rounded-2xl border border-app-border bg-app-bg px-3.5 text-[13px] text-app-text disabled:opacity-50"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
