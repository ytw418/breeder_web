import client from "@libs/server/client";
import { NotificationType } from "@prisma/client";
import { sendAllPushToUsers } from "@libs/server/pushGateway";
import { getProductPath } from "@libs/product-route";
import { isBlockExemptType, isSenderBlockedByReceiver, shouldPushTo } from "@libs/server/notificationGate";

interface CreateNotificationParams {
  type: NotificationType;
  userId: number; // 알림을 받을 유저
  senderId: number; // 알림을 발생시킨 유저
  message: string;
  targetId?: number; // 대상 ID
  targetType?: string; // 대상 타입 (post, product, chatRoom)
  /** 게시글 댓글 알림이면 그 댓글 id. 알림을 누르면 그 댓글로 스크롤한다(/posts/:id?commentId=). */
  commentId?: number;
  allowSelf?: boolean;
  dedupe?: boolean;
  sendPush?: boolean;
  /** 푸시 제목. 없으면 종류별 기본 제목(getPushTitle). 예) 좋아요 알림은 글 제목. */
  pushTitle?: string;
}

export const getNotificationUrl = (targetType?: string, targetId?: number, commentId?: number) => {
  if (!targetType || !targetId) return "/";

  switch (targetType) {
    case "post":
      return commentId ? `/posts/${targetId}?commentId=${commentId}` : `/posts/${targetId}`;
    case "product":
      return getProductPath(targetId);
    case "chatRoom":
      return `/chat/${targetId}`;
    case "user":
      return `/profiles/${targetId}`;
    case "bloodline":
      return `/bloodline-management/card/${targetId}`;
    case "auction":
      return `/auctions/${targetId}`;
    case "record":
      return "/guinness";
    case "guinness_submission":
      return "/guinness/apply";
    case "ranking":
      // 순위 상승(RANK_UP): 전체 랭킹에서 내 행으로 스크롤.
      return "/ranking?focus=me";
    case "town":
      // 동네 사랑방 답장·반겨 주기: 사랑방, 그 메시지로 스크롤.
      return `/town?focus=${targetId}`;
    case "sanction":
      // 운영 알림(경고·정지·해제·삭제)은 내 제재 내역으로 연결한다.
      return "/settings/sanctions";
    default:
      return "/";
  }
};

const getPushTitle = (type: NotificationType) => {
  if (
    type === "BID" ||
    type === "OUTBID" ||
    type === "AUCTION_END" ||
    type === "AUCTION_WON" ||
    type === "AUCTION_RESTARTED"
  ) {
    return "브리디 경매 알림";
  }
  if (
    type === "ADOPTER_REQUESTED" ||
    type === "ADOPTER_ASSIGNED" ||
    type === "ADOPTION_CONFIRMED" ||
    type === "TRADE_REVIEW_RECEIVED" ||
    type === "TRADE_REVIEW_REPLIED"
  ) {
    // 입양자 지정·거래 후기(앱 docs/prd/trade-review.md §3.7)
    return "브리디 분양 알림";
  }
  if (type === "MODERATION") return "브리디 운영팀";
  return "브리디 알림";
};

/**
 * 알림을 생성하는 유틸 함수
 * - 자기 자신에게는 알림을 보내지 않음
 * - 받는 사람이 보낸 사람을 차단했으면 알림 행·푸시 모두 만들지 않는다(운영 알림·경매 거래 알림·자기 알림 제외, notificationGate BLOCK_EXEMPT_NOTIFICATION_TYPES).
 * - 알림 행은 항상 저장하고, 푸시는 받는 사람의 알림 종류·방해 금지 설정을 따른다(libs/server/notificationGate).
 */
export const createNotification = async ({
  type,
  userId,
  senderId,
  message,
  targetId,
  targetType,
  commentId,
  allowSelf = false,
  dedupe = false,
  sendPush = true,
  pushTitle,
}: CreateNotificationParams) => {
  // 자기 자신에게는 알림을 보내지 않음
  if (!allowSelf && userId === senderId) return;

  try {
    if (!isBlockExemptType(type) && (await isSenderBlockedByReceiver(userId, senderId))) return;

    if (dedupe) {
      const existed = await client.notification.findFirst({
        where: {
          type,
          userId,
          senderId,
          targetId: targetId ?? null,
          targetType: targetType ?? null,
          // 글 좋아요(null)와 댓글 좋아요(댓글 id)를 따로 센다.
          commentId: commentId ?? null,
        },
      });
      if (existed) return;
    }

    await client.notification.create({
      data: {
        type,
        message,
        userId,
        senderId,
        targetId,
        targetType,
        commentId,
      },
    });

    if (sendPush && (await shouldPushTo(userId, type))) {
      await sendAllPushToUsers([userId], {
        title: pushTitle || getPushTitle(type),
        body: message,
        url: getNotificationUrl(targetType, targetId, commentId),
        // 같은 글의 댓글 알림끼리 알림 트레이에서 서로 덮지 않게 댓글 id 를 붙인다.
        tag: `${type}-${targetType || "default"}-${targetId || 0}${commentId ? `-c${commentId}` : ""}`,
      });
    }
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

/**
 * 팔로워들에게 알림을 보내는 유틸 함수
 * - 새 상품/게시글 등록 시 팔로워들에게 일괄 알림
 */
export const notifyFollowers = async ({
  senderId,
  type,
  message,
  targetId,
  targetType,
  excludeUserIds = [],
}: {
  senderId: number;
  type: NotificationType;
  message: string;
  targetId: number;
  targetType: string;
  /** 같은 글로 이미 다른 알림을 받은 사람(예: 질문 알림)은 뺀다. */
  excludeUserIds?: number[];
}) => {
  try {
    // 해당 유저를 팔로우하는 모든 유저 조회
    const followers = await client.follow.findMany({
      where: {
        followingId: senderId,
        ...(excludeUserIds.length ? { followerId: { notIn: excludeUserIds } } : {}),
      },
      select: { followerId: true },
    });

    if (followers.length === 0) return;

    // 팔로워들에게 일괄 알림 생성
    await client.notification.createMany({
      data: followers.map((f) => ({
        type,
        message,
        userId: f.followerId,
        senderId,
        targetId,
        targetType,
      })),
    });
  } catch (error) {
    console.error("Failed to notify followers:", error);
  }
};
