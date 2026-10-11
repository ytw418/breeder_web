import { toAuctionPath } from "@libs/auction-route";
import { getProductPath } from "@libs/product-route";
import { toPostCommentPath } from "@libs/post-route";
import { getNotificationKind, type NotificationIconName } from "@libs/shared/notificationFormat";

// 표시 규칙(종류·아이콘·시간·날짜 묶음)은 앱과 같은 사본 libs/shared/notificationFormat.ts 에 있다.
export {
  formatNotificationTime,
  NOTIFICATION_ICON_PATHS,
  type NotificationIconName,
} from "@libs/shared/notificationFormat";

/** 알림 종류 아이콘(사람 알림 뱃지·시스템 알림 원). */
export const getNotificationIcon = (type: string): NotificationIconName => getNotificationKind(type).icon;

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
