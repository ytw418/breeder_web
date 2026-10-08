import type { NotificationType } from "@prisma/client";
import { toAuctionPath } from "@libs/auction-route";
import { getProductPath } from "@libs/product-route";
import { toPostCommentPath } from "@libs/post-route";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** "방금" / "3분 전" / "5시간 전" / "어제" / "2026. 9. 1." (앱 notifications 와 같은 규칙). */
export function formatNotificationTime(iso: string | Date, now: number = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";

  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const dayDiff = Math.round((startOfDay(now) - startOfDay(time)) / DAY_MS);
  if (dayDiff <= 1) return "어제";

  return new Date(time).toLocaleDateString("ko-KR");
}

export type NotificationIconName = "hammer" | "bubble" | "bell" | "shield";

export const NOTIFICATION_ICON_PATHS: Record<NotificationIconName, string[]> = {
  hammer: ["M13.5 3.5l7 7-3 3-7-7z", "M12.5 9.5l-8 8", "M2.5 21h9"],
  bubble: [
    "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  ],
  bell: [
    "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  ],
  // 운영 알림(MODERATION). 앱 시안 design/mockups/moderation/A-karrot.html #shield 와 같은 path
  shield: ["M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6Z"],
};

const ICON_BY_TYPE: Partial<Record<NotificationType, NotificationIconName>> = {
  BID: "hammer",
  OUTBID: "hammer",
  AUCTION_WON: "hammer",
  AUCTION_END: "hammer",
  AUCTION_RECORD_BROKEN: "hammer",
  CHAT: "bubble",
  COMMENT: "bubble",
  // 출처 카드·혈통 받음(혈통 v2). 이동은 targetType "bloodline" → /bloodline-management/card/{id}
  BLOODLINE_RECEIVED: "bell",
  // 운영 조치 안내(경고·정지·숨김 등). 보낸 사람 대신 '브리디 운영팀'으로 보인다.
  MODERATION: "shield",
};

/** 경매 계열은 망치, 채팅·댓글은 말풍선, 혈통 받음 등 나머지는 종. */
export const getNotificationIcon = (type: NotificationType | string): NotificationIconName =>
  ICON_BY_TYPE[type as NotificationType] ?? "bell";

/** 알림 대상 경로. 갈 곳이 없으면 null. 댓글 알림은 그 댓글까지 스크롤한다(?commentId=). */
export function getNotificationHref(
  targetType: string | null,
  targetId: number | null,
  commentId?: number | null
): string | null {
  if (!targetType || !targetId) return null;
  switch (targetType) {
    case "post":
      return toPostCommentPath(targetId, commentId);
    case "product":
      return getProductPath(targetId);
    case "chatRoom":
      return `/chat/${targetId}`;
    case "user":
      return `/profiles/${targetId}`;
    case "bloodline":
      return `/bloodline-management/card/${targetId}`;
    case "auction":
      return toAuctionPath(targetId);
    case "record":
      return "/guinness";
    case "guinness_submission":
      return "/guinness/apply";
    case "sanction":
      // 경고·정지·해제 알림은 내 제재 내역으로 간다.
      return "/settings/sanctions";
    default:
      return null;
  }
}
