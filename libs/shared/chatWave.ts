/**
 * 동네 브리더 '손 흔들어 인사하기'(2026-10-12 사용자 결정: 문구 3개 중 하나 고르기, 보내면 채팅방이 생긴다, 하루 10명).
 * 같은 사람에게는 한 번만 보낸다. 서버(pages/api/chat/wave.ts)·웹·앱이 같은 문구와 한도를 쓴다.
 * 앱 bredy_app src/lib/chatWave.ts 와 같은 사본이다. 함께 고치고 웹 jest·앱 npm run test:chat-wave 로 확인한다.
 */
export const WAVE_DAILY_LIMIT = 10;

export type WavePresetId = "hello" | "neighbor" | "friend";

export const WAVE_PRESETS: readonly { id: WavePresetId; text: string }[] = [
  { id: "hello", text: "안녕하세요! 같은 동네 브리더예요. 반가워요 👋" },
  { id: "neighbor", text: "이웃사촌끼리 인사드려요. 어떤 아이들 키우세요?" },
  { id: "friend", text: "동네 브리더끼리 친하게 지내요! 동네 친구해요 🙂" },
];

export const WAVE_SHEET_TITLE = "손 흔들어 인사하기";
export const waveSheetCaption = (name: string) => `${name}님에게 보낼 인사를 골라 주세요`;
export const WAVE_SENT_MESSAGE = "인사를 보냈어요";

export function isWavePresetId(value: unknown): value is WavePresetId {
  return typeof value === "string" && WAVE_PRESETS.some((preset) => preset.id === value);
}

export function wavePresetText(id: unknown): string | null {
  return WAVE_PRESETS.find((preset) => preset.id === id)?.text ?? null;
}

/** 버튼 상태. 이미 인사했으면 '인사함'(누를 수 없음), 오늘 한도를 다 썼으면 '오늘 마감'. */
export function waveButtonState(input: {
  waved?: boolean;
  wavesLeftToday?: number | null;
}): "ready" | "waved" | "limit" {
  if (input.waved) return "waved";
  if (input.wavesLeftToday != null && input.wavesLeftToday <= 0) return "limit";
  return "ready";
}

export function waveButtonLabel(state: "ready" | "waved" | "limit"): string {
  if (state === "waved") return "인사함";
  if (state === "limit") return "오늘 인사 마감";
  return "손 흔들어 인사하기";
}

/** 시트 아래 안내. 한도를 하나도 안 썼으면 null. */
export function wavesLeftCaption(left: number | null | undefined): string | null {
  if (left == null || left >= WAVE_DAILY_LIMIT) return null;
  if (left <= 0) return "오늘 인사는 여기까지예요. 내일 다시 인사할 수 있어요";
  return `오늘 ${left}명 더 인사할 수 있어요`;
}

export type WaveErrorCode =
  | "WAVE_SELF"
  | "WAVE_BAD_PRESET"
  | "WAVE_NOT_NEARBY"
  | "WAVE_ALREADY"
  | "WAVE_LIMIT"
  | "CHAT_BLOCKED"
  | "CHAT_PARTNER_DELETED";

const WAVE_ERROR_MESSAGES: Record<WaveErrorCode, string> = {
  WAVE_SELF: "나에게는 인사할 수 없어요",
  WAVE_BAD_PRESET: "인사 문구를 다시 골라 주세요",
  WAVE_NOT_NEARBY: "동네 브리더에게만 인사할 수 있어요",
  WAVE_ALREADY: "이미 인사한 브리더예요",
  WAVE_LIMIT: `오늘 인사는 여기까지예요(하루 ${WAVE_DAILY_LIMIT}명)`,
  CHAT_BLOCKED: "인사를 보낼 수 없는 상대예요",
  CHAT_PARTNER_DELETED: "탈퇴한 사용자예요",
};

export function waveErrorMessage(code?: string | null): string {
  return (code && WAVE_ERROR_MESSAGES[code as WaveErrorCode]) || "인사를 보내지 못했어요. 잠시 뒤 다시 해 주세요";
}
