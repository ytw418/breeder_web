/**
 * 채팅 목록·채팅방 순수 로직. 앱 bredy_app src/components/features/chat/chatTokens.ts 와
 * src/app/(tabs)/chat.tsx, src/app/chat/[chatRoomId].tsx 의 규칙을 그대로 옮겼다.
 * 원본 시안: bredy_app design/mockups/chat/A-karrot.html, PRD docs/prd/chat.md
 */
import { DELETED_USER_LABEL, isDeletedUserName } from "@libs/shared/deletedUser";

/** 목록·방 폴링 주기(기존 동작 유지). */
export const CHAT_LIST_POLL_MS = 5000;
export const CHAT_ROOM_POLL_MS = 3000;

export const CHAT_PAGE_SIZE = 20;
/** 같은 발신자 연속 메시지를 한 묶음으로 보는 간격(분). */
export const CHAT_GROUP_MINUTES = 5;
/** 한 번에 보낼 수 있는 사진 수. 장마다 IMAGE 메시지 1개. */
export const MAX_CHAT_IMAGES = 10;
/** 게시글·상품·혈통카드 이미지와 같은 기준(10MB). */
export const MAX_CHAT_IMAGE_SIZE = 10 * 1024 * 1024;

export const CHAT_PLACEHOLDER = "메시지 보내기";
export const CHAT_DELETED_PLACEHOLDER = "탈퇴한 사용자예요. 더 이상 대화할 수 없어요.";
export const CHAT_BLOCKED_PLACEHOLDER = "차단한 사용자예요. 차단을 해제하면 대화할 수 있어요.";

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 목록 행 시간 라벨: "방금 전" / "3분 전" / "1시간 전" / "어제" / "3일 전",
 * 7일이 지나면 같은 해 "9월 24일", 다른 해 "2025.09.24".
 */
export function formatChatListTime(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return "";

  const diffMin = Math.floor((now.getTime() - time.getTime()) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}시간 전`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(time, yesterday)) return "어제";

  const diffDay = Math.floor(diffMin / (60 * 24));
  if (diffDay < 7) return `${diffDay}일 전`;

  const month = time.getMonth() + 1;
  const day = time.getDate();
  if (time.getFullYear() === now.getFullYear()) return `${month}월 ${day}일`;
  return `${time.getFullYear()}.${pad2(month)}.${pad2(day)}`;
}

/** 말풍선 옆 시간: "오후 2:41" / "오전 12:05". */
export function formatChatTime(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = date.getHours();
  const meridiem = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${meridiem} ${hour12}:${pad2(date.getMinutes())}`;
}

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

/** 날짜 구분: "오늘" / "어제" / "2월 14일 금요일". */
export function formatChatDay(date: Date, now: Date = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) return "오늘";
  if (isSameDay(date, yesterday)) return "어제";
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}`;
}

/* ------------------------------- 목록 ------------------------------- */

export type ChatFilter = "all" | "unread";

export interface ChatListLastMessage {
  type: string;
  message: string;
  userId: number;
}

/** 목록 미리보기. 줄바꿈·연속 공백은 한 칸으로 합친다. */
export function chatPreview(message?: Pick<ChatListLastMessage, "type" | "message"> | null): string {
  if (!message) return "아직 대화가 없습니다.";
  if (message.type === "IMAGE") return "사진을 보냈습니다";
  const text = (message.message ?? "").replace(/\s+/g, " ").trim();
  return text || "메시지";
}

interface FilterableRoom {
  unreadCount: number;
  chatRoomMembers: { user: { id: number; name: string } }[];
}

export function findPartner<T extends { user: { id: number } }>(members: T[], myId?: number | null): T | undefined {
  return members.find((member) => member.user.id !== myId);
}

/** 이름 검색 + 안 읽음 필터. */
export function filterChatRooms<T extends FilterableRoom>(
  rooms: T[],
  { myId, keyword, filter }: { myId?: number | null; keyword: string; filter: ChatFilter }
): T[] {
  const kw = keyword.trim().toLowerCase();
  return rooms.filter((room) => {
    const other = findPartner(room.chatRoomMembers, myId)?.user;
    const matchKw = kw ? Boolean(other?.name?.toLowerCase().includes(kw)) : true;
    const matchFilter = filter === "unread" ? room.unreadCount > 0 : true;
    return matchKw && matchFilter;
  });
}

/** 빈 목록 문구. 검색 중이면 검색 결과 문구가 먼저다. */
export function chatListEmptyMessage(keyword: string, filter: ChatFilter): string {
  const kw = keyword.trim();
  if (kw) {
    return filter === "unread" ? `'${kw}'에 해당하는 안 읽은 채팅이 없습니다.` : "검색 결과가 없습니다.";
  }
  return filter === "unread" ? "안 읽은 채팅이 없습니다." : "아직 대화가 없습니다.";
}

/* ------------------------------- 채팅방 ------------------------------- */

export interface ChatMessageLike {
  id: number;
  createdAt: string;
  user: { id: number; avatar: string | null };
}

export function mergeMessages<T extends ChatMessageLike>(prev: T[], incoming: T[]): T[] {
  const map = new Map<number, T>();
  for (const message of prev) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

export function isGroupedWithPrev(current: ChatMessageLike, prev?: ChatMessageLike): boolean {
  if (!prev) return false;
  if (current.user.id !== prev.user.id) return false;
  const currentDate = new Date(current.createdAt);
  const prevDate = new Date(prev.createdAt);
  if (!isSameDay(prevDate, currentDate)) return false;
  return Math.abs(currentDate.getTime() - prevDate.getTime()) <= CHAT_GROUP_MINUTES * 60 * 1000;
}

export type ChatMessageGroup<T extends ChatMessageLike> = {
  type: "group";
  key: string;
  messages: T[];
  mine: boolean;
  avatar: string | null;
};

export type ChatRenderItem<T extends ChatMessageLike> =
  | { type: "divider"; key: string; label: string }
  | ChatMessageGroup<T>;

/** 날짜 구분 + 발신자별 묶음(오래된 → 최신 순). */
export function buildChatItems<T extends ChatMessageLike>(
  messages: T[],
  myId?: number | null,
  now: Date = new Date()
): ChatRenderItem<T>[] {
  const items: ChatRenderItem<T>[] = [];
  let current: ChatMessageGroup<T> | null = null;

  messages.forEach((message, index) => {
    const prev = messages[index - 1];
    const date = new Date(message.createdAt);
    const prevDate = prev ? new Date(prev.createdAt) : null;

    if (!prevDate || !isSameDay(prevDate, date)) {
      items.push({ type: "divider", key: `divider-${message.id}`, label: formatChatDay(date, now) });
      current = null;
    }

    if (current && isGroupedWithPrev(message, prev)) {
      current.messages.push(message);
      return;
    }

    current = {
      type: "group",
      key: `group-${message.id}`,
      messages: [message],
      mine: myId != null && message.user.id === myId,
      avatar: message.user.avatar,
    };
    items.push(current);
  });

  return items;
}

/** 상대가 읽은 내 마지막 메시지 id(상대 lastReadAt 이전에 보낸 것 중 가장 최신). */
export function findReadReceiptMessageId(
  messages: ChatMessageLike[],
  partnerLastReadAt?: string | null,
  myId?: number | null
): number | null {
  if (!partnerLastReadAt || myId == null) return null;
  const readAt = new Date(partnerLastReadAt).getTime();
  if (Number.isNaN(readAt)) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.user.id !== myId) continue;
    const sentAt = new Date(message.createdAt).getTime();
    if (!Number.isNaN(sentAt) && sentAt <= readAt) return message.id;
  }
  return null;
}

/** 탈퇴 상대: 응답 정규화 후의 "탈퇴한 사용자" 와 원본 "탈퇴한 사용자#<id>" 모두. */
export const isDeletedPartnerName = (name?: string | null) =>
  name === DELETED_USER_LABEL || isDeletedUserName(name);

/** 입력창 placeholder. 탈퇴 안내가 차단보다 우선. */
export function composerPlaceholder({ deleted, blocked }: { deleted: boolean; blocked: boolean }): string {
  if (deleted) return CHAT_DELETED_PLACEHOLDER;
  if (blocked) return CHAT_BLOCKED_PLACEHOLDER;
  return CHAT_PLACEHOLDER;
}

/* ------------------------------- 사진 전송 ------------------------------- */

export interface ImageUploadSummary {
  sent: number;
  invalidType: number;
  oversized: number;
  failed: number;
  serverError: string | null;
}

export const emptyUploadSummary = (): ImageUploadSummary => ({
  sent: 0,
  invalidType: 0,
  oversized: 0,
  failed: 0,
  serverError: null,
});

/** 고른 파일을 보낼 것 / 제외할 것으로 나눈다(최대 10장, 이미지 아님·10MB 초과 제외). */
export function planImageUploads<F extends { type: string; size: number }>(
  files: F[]
): { toSend: F[]; summary: ImageUploadSummary } {
  const summary = emptyUploadSummary();
  const toSend: F[] = [];
  for (const file of files.slice(0, MAX_CHAT_IMAGES)) {
    if (!file.type.startsWith("image/")) {
      summary.invalidType += 1;
      continue;
    }
    if (file.size > MAX_CHAT_IMAGE_SIZE) {
      summary.oversized += 1;
      continue;
    }
    toSend.push(file);
  }
  return { toSend, summary };
}

/** 업로드 결과 안내 문구(앱 Alert "이미지 업로드" 본문과 같다). */
export function imageUploadNotices(summary: ImageUploadSummary): string[] {
  return [
    summary.invalidType > 0 ? `이미지 파일이 아닌 ${summary.invalidType}개는 제외했습니다.` : null,
    summary.oversized > 0 ? `10MB를 넘는 이미지 ${summary.oversized}장은 제외했습니다.` : null,
    summary.failed > 0 ? `이미지 ${summary.failed}장을 보내지 못했습니다.` : null,
    summary.serverError,
  ].filter((notice): notice is string => Boolean(notice));
}
