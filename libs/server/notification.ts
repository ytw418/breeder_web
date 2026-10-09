import client from "@libs/server/client";
import { NotificationType } from "@prisma/client";
import { sendAllPushToUsers } from "@libs/server/pushGateway";
import { getProductPath } from "@libs/product-route";

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
}

const getNotificationUrl = (targetType?: string, targetId?: number, commentId?: number) => {
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
    case "sanction":
      // 운영 알림(경고·정지·해제·삭제)은 내 제재 내역으로 연결한다.
      return "/settings/sanctions";
    default:
      return "/";
  }
};

const getPushTitle = (type: NotificationType) => {
  if (type === "BID" || type === "OUTBID" || type === "AUCTION_END" || type === "AUCTION_WON") {
    return "브리디 경매 알림";
  }
  if (type === "MODERATION") return "브리디 운영팀";
  return "브리디 알림";
};

/**
 * 알림을 생성하는 유틸 함수
 * - 자기 자신에게는 알림을 보내지 않음
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
}: CreateNotificationParams) => {
  // 자기 자신에게는 알림을 보내지 않음
  if (!allowSelf && userId === senderId) return;

  try {
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

    if (sendPush) {
      await sendAllPushToUsers([userId], {
        title: getPushTitle(type),
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
}: {
  senderId: number;
  type: NotificationType;
  message: string;
  targetId: number;
  targetType: string;
}) => {
  try {
    // 해당 유저를 팔로우하는 모든 유저 조회
    const followers = await client.follow.findMany({
      where: { followingId: senderId },
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
