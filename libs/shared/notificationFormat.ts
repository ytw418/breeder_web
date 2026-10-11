/**
 * 알림 목록 표시 규칙(2026-10-11 알림 화면 A안 — 앱 시안 design/mockups/notifications/A-karrot.html, 앱 PRD docs/prd/notifications.md).
 * 종류 이름·아이콘, 시간 문구, 날짜 묶음(오늘·최근 7일·이전 알림), 보낸 사람 이름 굵게를 정한다.
 * 웹 breeder_web libs/shared/notificationFormat.ts = 앱 bredy_app src/lib/notificationFormat.ts 사본이라 함께 고치고
 * 웹 `npx jest notificationFormat`·앱 `npm run test:notification-format` 로 확인한다.
 */

export type NotificationIconName =
  | "heart"
  | "bubble"
  | "userPlus"
  | "hammer"
  | "pencil"
  | "tag"
  | "card"
  | "trophy"
  | "chart"
  | "shield"
  | "bell";

/** 24 viewBox 라인 아이콘 path. 사람 아바타 위 22 뱃지(12)와 44 원(22)에 같이 쓴다. */
export const NOTIFICATION_ICON_PATHS: Record<NotificationIconName, string[]> = {
  heart: ["M12 20s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 10c0 5.65-7 10-7 10z"],
  bubble: [
    "M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  ],
  userPlus: [
    "M15 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1",
    "M9 10a3 3 0 100-6 3 3 0 000 6z",
    "M19 8v6",
    "M22 11h-6",
  ],
  hammer: ["M13.5 3.5l7 7-3 3-7-7z", "M12.5 9.5l-8 8", "M2.5 21h9"],
  pencil: ["M4 20h4L19 9l-4-4L4 16v4z", "M13.5 6.5l4 4"],
  tag: ["M3 12V4h8l10 10-8 8z", "M7.5 7.5h.01"],
  card: ["M3 6h18v12H3z", "M7 10h6", "M7 14h4"],
  trophy: [
    "M8 4h8v5a4 4 0 01-8 0V4z",
    "M8 6H5a3 3 0 003 4",
    "M16 6h3a3 3 0 01-3 4",
    "M12 13v4",
    "M8.5 20h7",
    "M10 17h4",
  ],
  chart: ["M4 20h16", "M7 16v-4", "M12 16V8", "M17 16v-6"],
  // 운영 알림(MODERATION). 앱 시안 design/mockups/moderation/A-karrot.html #shield
  shield: ["M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6Z"],
  bell: [
    "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  ],
};

export interface NotificationKind {
  /** 시간 앞 종류 이름("입찰 · 3분 전") */
  label: string;
  icon: NotificationIconName;
  /**
   * 사람이 한 일이면 보낸 사람 아바타 + 종류 뱃지, 아니면(낙찰·랭킹·운영 등) 44 회색 원 안 아이콘.
   * 더 높은 입찰(OUTBID)은 상대 입찰자를 드러내지 않는다.
   */
  fromPerson: boolean;
}

const KINDS: Record<string, NotificationKind> = {
  LIKE: { label: "좋아요", icon: "heart", fromPerson: true },
  COMMENT: { label: "댓글", icon: "bubble", fromPerson: true },
  CHAT: { label: "채팅", icon: "bubble", fromPerson: true },
  FOLLOW: { label: "팔로우", icon: "userPlus", fromPerson: true },
  FAV: { label: "찜", icon: "heart", fromPerson: true },
  NEW_PRODUCT: { label: "새 분양글", icon: "tag", fromPerson: true },
  NEW_POST: { label: "새 글", icon: "pencil", fromPerson: true },
  BID: { label: "입찰", icon: "hammer", fromPerson: true },
  OUTBID: { label: "경매", icon: "hammer", fromPerson: false },
  AUCTION_WON: { label: "낙찰", icon: "trophy", fromPerson: false },
  AUCTION_END: { label: "경매 종료", icon: "hammer", fromPerson: false },
  AUCTION_RECORD_BROKEN: { label: "최고가 기록", icon: "trophy", fromPerson: false },
  NEW_RECORD: { label: "브리디북", icon: "trophy", fromPerson: false },
  BREEDER_RANK_DROP: { label: "랭킹", icon: "chart", fromPerson: false },
  BREEDER_OVERTAKEN: { label: "랭킹", icon: "chart", fromPerson: false },
  BLOODLINE_OVERTAKEN: { label: "혈통 랭킹", icon: "chart", fromPerson: false },
  BLOODLINE_RECEIVED: { label: "혈통", icon: "card", fromPerson: true },
  MODERATION: { label: "운영 알림", icon: "shield", fromPerson: false },
};

const FALLBACK_KIND: NotificationKind = { label: "알림", icon: "bell", fromPerson: false };

/** 서버 questionAlert.ts QUESTION_ALERT_MESSAGE_PREFIX. 질문 알림은 NEW_POST 로 오지만 '질문'으로 보인다. */
const QUESTION_ALERT_PREFIX = "답변을 기다리는 질문이 올라왔어요";

export function getNotificationKind(type: string, message = ""): NotificationKind {
  if (type === "NEW_POST" && message.startsWith(QUESTION_ALERT_PREFIX)) {
    return { label: "질문", icon: "bubble", fromPerson: true };
  }
  return KINDS[type] ?? FALLBACK_KIND;
}

/** 운영 알림의 보낸 사람 자리(서버 MODERATION_SENDER 와 같은 이름). */
export const MODERATION_SENDER_NAME = "브리디 운영팀";

/**
 * 메시지 앞의 보낸 사람 이름만 굵게 보이게 나눈다("젠크레" + "님이 … 입찰했습니다.").
 * 운영 알림은 '브리디 운영팀'을 앞에 붙인다. 이름으로 시작하지 않으면 lead 없이 그대로.
 */
export function splitNotificationMessage(notification: {
  type: string;
  message: string;
  sender?: { name?: string | null } | null;
}): { lead: string | null; rest: string } {
  const { type, message } = notification;
  if (type === "MODERATION") return { lead: MODERATION_SENDER_NAME, rest: ` ${message}` };
  const name = notification.sender?.name?.trim();
  if (name && message.startsWith(name) && message.length > name.length) {
    return { lead: name, rest: message.slice(name.length) };
  }
  return { lead: null, rest: message };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 달력 기준 며칠 전인지(오늘 0, 어제 1). 날짜를 못 읽으면 NaN. */
function calendarDaysAgo(time: number, now: number) {
  return Math.round((startOfDay(now) - startOfDay(time)) / DAY_MS);
}

/** "방금" / "3분 전" / "5시간 전" / "어제" / "3일 전" / "9월 28일" / "2025년 9월 28일" */
export function formatNotificationTime(iso: string | Date, now: number = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";

  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = calendarDaysAgo(time, now);
  if (days <= 1) return "어제";
  if (days < 7) return `${days}일 전`;

  const date = new Date(time);
  const monthDay = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return date.getFullYear() === new Date(now).getFullYear()
    ? monthDay
    : `${date.getFullYear()}년 ${monthDay}`;
}

export type NotificationSectionKey = "today" | "week" | "older";

export const NOTIFICATION_SECTION_TITLES: Record<NotificationSectionKey, string> = {
  today: "오늘",
  week: "최근 7일",
  older: "이전 알림",
};

export function notificationSectionKey(
  iso: string | Date,
  now: number = Date.now(),
): NotificationSectionKey {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "older";
  const days = calendarDaysAgo(time, now);
  if (days <= 0) return "today";
  if (days < 7) return "week";
  return "older";
}

export interface NotificationSection<T> {
  key: NotificationSectionKey;
  title: string;
  items: T[];
}

/** 서버가 최신순으로 준 목록을 순서 그대로 오늘 → 최근 7일 → 이전 알림으로 묶는다. 빈 묶음은 뺀다. */
export function groupNotifications<T extends { createdAt: string | Date }>(
  items: T[],
  now: number = Date.now(),
): NotificationSection<T>[] {
  const order: NotificationSectionKey[] = ["today", "week", "older"];
  const buckets: Record<NotificationSectionKey, T[]> = { today: [], week: [], older: [] };
  for (const item of items) buckets[notificationSectionKey(item.createdAt, now)].push(item);
  return order
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, title: NOTIFICATION_SECTION_TITLES[key], items: buckets[key] }));
}

/** 알림 하나를 읽음으로 바꾼 목록·안 읽은 수(누르자마자 화면·헤더 뱃지에 반영). 이미 읽었으면 그대로. */
export function markNotificationRead<
  T extends { id: number; isRead: boolean },
  R extends { notifications: T[]; unreadCount: number },
>(response: R, id: number): R {
  const target = response.notifications.find((item) => item.id === id);
  if (!target || target.isRead) return response;
  return {
    ...response,
    unreadCount: Math.max(0, response.unreadCount - 1),
    notifications: response.notifications.map((item) =>
      item.id === id ? { ...item, isRead: true } : item,
    ),
  };
}
