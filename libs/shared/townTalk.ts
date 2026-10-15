/**
 * 동네 사랑방 규칙·문구(앱 docs/prd/live-talk.md §3.4·§3.4c). 앱 src/lib/townTalk.ts 와 같은 파일 사본이다.
 * 방에 가입하지 않고, 보낸 사람의 시/군/구가 읽는 사람의 반경 50km 범위(libs/shared/regionScope) 안이면 보인다.
 */

export const TOWN_MESSAGE_MAX = 300;
/** 이 기간 메시지만 보인다(지우지는 않는다). */
export const TOWN_VISIBLE_DAYS = 7;
export const TOWN_PAGE_SIZE = 50;
/** 마지막 메시지 뒤 이 시간이 지나면 '조용해요' 줄과 대화 거리 칩. */
export const TOWN_QUIET_MINUTES = 30;
/** 연속 보내기 간격(초)·하루 한도. */
export const TOWN_RATE_SECONDS = 5;
export const TOWN_DAILY_LIMIT = 200;
/** 같은 사람 연속 메시지를 이 간격 안이면 이름·아바타를 생략한다. */
export const TOWN_GROUP_GAP_MS = 60_000;
/** 신고 이 건수면 자동 가림. */
export const TOWN_REPORT_HIDE_COUNT = 3;
/** 가입 이 기간 안이면 '새로 온 이웃' 줄을 붙인다. */
export const TOWN_NEWCOMER_DAYS = 7;
export const TOWN_PREVIEW_COUNT = 3;
export const TOWN_RULE_BANNER_MAX_VIEWS = 3;

export type TownMessageKind = "TEXT" | "IMAGE" | "PRODUCT";

/** 대화 거리(조용할 때 입력창 위 칩). 하루마다 순서를 바꿔 3개를 보인다. */
export const TOWN_PROMPTS = [
  "오늘 먹이 뭐 줬어요?",
  "요즘 사육장 몇 도로 두세요?",
  "이번 주말 렙타일 쇼 가세요?",
  "근처에 생먹이 파는 곳 아세요?",
  "탈피·산란 소식 있으면 자랑해 주세요",
  "처음 키우는 분 계세요? 궁금한 거 물어보세요",
  "요즘 들인 개체 사진 보여 주세요",
  "겨울 난방 어떻게 하세요?",
  "추천하는 바닥재 있어요?",
] as const;

/** 날짜(KST)로 정해지는 대화 거리 3개. */
export function townPromptsFor(now = Date.now(), count = 3): string[] {
  const kst = new Date(now + 9 * 3600_000);
  const day = Math.floor(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) / 86_400_000);
  const start = day % TOWN_PROMPTS.length;
  return Array.from({ length: count }, (_, i) => TOWN_PROMPTS[(start + i) % TOWN_PROMPTS.length]);
}

/** "서울" → "서울 근처 사랑방", "보은군 근처" → "보은군 근처 사랑방" */
export function townTitle(regionLabel: string): string {
  const base = regionLabel.replace(/\s*근처$/, "");
  return base ? `${base} 근처 사랑방` : "동네 사랑방";
}

export const townInputPlaceholder = (regionLabel: string) =>
  `${regionLabel.replace(/\s*근처$/, "") || "동네"} 근처 이웃에게 한마디`;

export const townEmptyTitle = (regionLabel: string) => `${townTitle(regionLabel)}이 열렸어요`;
export const TOWN_EMPTY_BODY = "여기 쓴 말은 반경 50km 이웃에게 보여요";
export const TOWN_RULE_TEXT = "거래 약속은 분양글 채팅에서 해요";
export const TOWN_REGION_REQUIRED = "내 동네를 정하면 근처 이웃과 이야기할 수 있어요";
export const townWelcomeMessage = (name: string) => `${name}님 반가워요!`;
export const townQuietLabel = (minutes: number) =>
  minutes >= 60 * 24 ? "하루 넘게 조용해요" : minutes >= 60 ? `${Math.floor(minutes / 60)}시간째 조용해요` : `${minutes}분째 조용해요`;

/** 미리보기·알림에 쓰는 한 줄. */
export function townMessagePreview(message: {
  type: TownMessageKind;
  body: string | null;
  productName?: string | null;
  deleted?: boolean;
}): string {
  if (message.deleted) return "삭제한 메시지예요";
  if (message.type === "IMAGE") return `[사진]${message.body ? ` ${message.body}` : ""}`;
  if (message.type === "PRODUCT") return `[분양글] ${message.productName ?? message.body ?? ""}`.trim();
  return message.body ?? "";
}

/** 같은 사람이 1분 안에 이어 보낸 메시지면 이름·아바타를 생략한다. */
export function isGroupedWithPrevious(
  prev: { userId: number; createdAt: string } | null,
  current: { userId: number; createdAt: string }
): boolean {
  if (!prev || prev.userId !== current.userId) return false;
  return new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime() < TOWN_GROUP_GAP_MS;
}

/** 마지막 메시지 뒤 지난 분(조용함 판단). 30분 미만이면 null. */
export function townQuietMinutes(lastCreatedAt: string | null, now = Date.now()): number | null {
  if (!lastCreatedAt) return null;
  const minutes = Math.floor((now - new Date(lastCreatedAt).getTime()) / 60_000);
  return minutes >= TOWN_QUIET_MINUTES ? minutes : null;
}

/** 메시지 시간: "오전 9:41" */
export function townTimeLabel(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const h = kst.getUTCHours();
  const m = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
}

/** 날짜 구분: "오늘" · "어제" · "10월 12일" */
export function townDayLabel(iso: string, now = Date.now()): string {
  const day = (t: number) => {
    const k = new Date(t + 9 * 3600_000);
    return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
  };
  const diff = Math.round((day(now) - day(new Date(iso).getTime())) / 86_400_000);
  if (diff <= 0) return "오늘";
  if (diff === 1) return "어제";
  const k = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
}
