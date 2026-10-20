/**
 * 알림 종류별 끄기·방해 금지(2026-10-21, 앱 docs/prd/notifications.md §알림 종류, 시안 design/mockups/notifications/A-karrot.html #noti-prefs).
 * 서버 User.notificationPrefs(Json) 를 읽고 쓰는 규칙과 푸시를 보낼지 판단하는 규칙을 한곳에 둔다.
 * - 끈 종류도 알림 목록에는 쌓인다. 푸시만 보내지 않는다.
 * - 운영 알림(MODERATION)은 종류·방해 금지와 관계없이 항상 보낸다.
 * - 방해 금지 시간은 KST 시(0~23) 기준 [start, end) 이고, 22~8 처럼 자정을 넘을 수 있다.
 * 웹 breeder_web libs/shared/notificationPrefs.ts = 앱 bredy_app src/lib/notificationPrefs.ts 사본이라 함께 고치고
 * 웹 `npx jest notificationPrefs`·앱 `node --test scripts/test-notification-prefs.mjs` 로 확인한다.
 */

export type NotificationPrefKind = "chat" | "trade" | "reaction" | "follow" | "news";

export const NOTIFICATION_PREF_KINDS: readonly NotificationPrefKind[] = [
  "chat",
  "trade",
  "reaction",
  "follow",
  "news",
];

/** 설정 화면 행 이름과 설명(한 줄). */
export const NOTIFICATION_PREF_COPY: Record<NotificationPrefKind, { label: string; description: string }> = {
  chat: { label: "채팅", description: "분양 문의·채팅 메시지" },
  trade: { label: "거래·경매", description: "입찰·더 높은 입찰·낙찰·찜" },
  reaction: { label: "내 글 반응", description: "좋아요·댓글·답글" },
  follow: { label: "팔로우·새 글", description: "새 팔로워·팔로우한 브리더의 새 글·관심 분야 질문" },
  news: { label: "브리디 소식(순위·토론)", description: "순위·토론 결과·기록·사랑방·주간 요약·공지" },
};

export interface QuietHours {
  enabled: boolean;
  /** KST 시(0~23). 이 시각부터 */
  start: number;
  /** KST 시(0~23). 이 시각 전까지 */
  end: number;
  /** 방해 금지 시간에도 채팅·거래(경매) 알림은 받는다. */
  exemptChatTrade: boolean;
}

export interface NotificationPrefs {
  chat: boolean;
  trade: boolean;
  reaction: boolean;
  follow: boolean;
  news: boolean;
  quiet: QuietHours;
}

/** PATCH 본문. 보낸 값만 바꾼다. */
export type NotificationPrefsPatch = Partial<Record<NotificationPrefKind, boolean>> & {
  quiet?: Partial<QuietHours>;
};

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: 22,
  end: 8,
  exemptChatTrade: true,
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  chat: true,
  trade: true,
  reaction: true,
  follow: true,
  news: true,
  quiet: DEFAULT_QUIET_HOURS,
};

const KIND_BY_TYPE: Record<string, NotificationPrefKind> = {
  CHAT: "chat",
  BID: "trade",
  OUTBID: "trade",
  AUCTION_END: "trade",
  AUCTION_WON: "trade",
  AUCTION_RESTARTED: "trade",
  FAV: "trade",
  LIKE: "reaction",
  COMMENT: "reaction",
  FOLLOW: "follow",
  NEW_POST: "follow",
  NEW_PRODUCT: "follow",
};

/** 알림 type → 설정 종류. 운영 알림(MODERATION)은 끌 수 없어 null. 그 밖의 type(순위·토론·기록·사랑방 등)은 news. */
export function kindOfType(type: string): NotificationPrefKind | null {
  if (type === "MODERATION") return null;
  return KIND_BY_TYPE[type] ?? "news";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isHour = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23;

function applyQuiet(base: QuietHours, raw: unknown): QuietHours {
  if (!isRecord(raw)) return { ...base };
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : base.enabled,
    start: isHour(raw.start) ? raw.start : base.start,
    end: isHour(raw.end) ? raw.end : base.end,
    exemptChatTrade: typeof raw.exemptChatTrade === "boolean" ? raw.exemptChatTrade : base.exemptChatTrade,
  };
}

/** base 위에 raw 의 올바른 값만 덮는다. 모르는 키·틀린 값은 버린다. */
function applyPrefs(base: NotificationPrefs, raw: unknown): NotificationPrefs {
  const next: NotificationPrefs = { ...base, quiet: { ...base.quiet } };
  if (!isRecord(raw)) return next;
  for (const kind of NOTIFICATION_PREF_KINDS) {
    if (typeof raw[kind] === "boolean") next[kind] = raw[kind] as boolean;
  }
  next.quiet = applyQuiet(base.quiet, raw.quiet);
  return next;
}

/** 저장된 Json(비었거나 옛 모양이어도) → 완전한 설정. 비어 있으면 모두 켜짐·방해 금지 꺼짐. */
export function normalizePrefs(raw: unknown): NotificationPrefs {
  return applyPrefs(DEFAULT_NOTIFICATION_PREFS, raw);
}

/** 지금 설정에 PATCH 본문을 부분 반영한다. */
export function mergePrefs(current: unknown, patch: unknown): NotificationPrefs {
  return applyPrefs(normalizePrefs(current), patch);
}

/** Date → KST 시(0~23). */
export function kstHour(now: Date): number {
  return (now.getUTCHours() + 9) % 24;
}

/** hour 가 [start, end) 안인지. start > end 면 자정을 넘는 구간, 같으면 구간 없음. */
export function isQuietHour(quiet: Pick<QuietHours, "start" | "end">, hour: number): boolean {
  if (quiet.start === quiet.end) return false;
  if (quiet.start < quiet.end) return hour >= quiet.start && hour < quiet.end;
  return hour >= quiet.start || hour < quiet.end;
}

/**
 * 이 type 의 푸시를 보낼지. 알림 행 저장과는 별개다(끈 종류도 목록엔 쌓인다).
 * - 운영 알림은 항상 보낸다.
 * - 종류가 꺼져 있으면 보내지 않는다.
 * - 방해 금지가 켜져 있고 지금(KST)이 그 시간 안이면, '채팅·경매는 예외'가 켜진 채팅·거래만 보낸다.
 */
export function shouldPush(prefs: unknown, type: string, now: Date = new Date()): boolean {
  const kind = kindOfType(type);
  if (kind === null) return true;
  const normalized = normalizePrefs(prefs);
  if (!normalized[kind]) return false;
  const { quiet } = normalized;
  if (!quiet.enabled || !isQuietHour(quiet, kstHour(now))) return true;
  return quiet.exemptChatTrade && (kind === "chat" || kind === "trade");
}

/** 0~23 → '밤 10시'·'오전 8시'. */
export function formatQuietHour(hour: number): string {
  if (hour === 0) return "밤 12시";
  if (hour < 6) return `새벽 ${hour}시`;
  if (hour < 12) return `오전 ${hour}시`;
  if (hour === 12) return "낮 12시";
  if (hour < 18) return `오후 ${hour - 12}시`;
  if (hour < 21) return `저녁 ${hour - 12}시`;
  return `밤 ${hour - 12}시`;
}

/** '밤 10시 ~ 오전 8시' */
export function quietRangeLabel(quiet: Pick<QuietHours, "start" | "end">): string {
  return `${formatQuietHour(quiet.start)} ~ ${formatQuietHour(quiet.end)}`;
}
