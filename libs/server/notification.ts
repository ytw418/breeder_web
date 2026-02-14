import client from "@libs/server/client";
import { NotificationType } from "@prisma/client";
import { sendPushToUsers } from "@libs/server/push";
import { getProductPath } from "@libs/product-route";

interface CreateNotificationParams {
  type: NotificationType;
  userId: number; // 알림을 받을 유저
  senderId: number; // 알림을 발생시킨 유저
  message: string;
  targetId?: number; // 대상 ID
  targetType?: string; // 대상 타입 (post, product, chatRoom)
  allowSelf?: boolean;
  dedupe?: boolean;
  sendPush?: boolean;
}

const getNotificationUrl = (targetType?: string, targetId?: number) => {
  if (!targetType || !targetId) return "/";

  switch (targetType) {
    case "post":
      return `/posts/${targetId}`;
    case "product":
      return getProductPath(targetId);
    case "chatRoom":
      return `/chat/${targetId}`;
    case "user":
      return `/profiles/${targetId}`;
    case "auction":
      return `/auctions/${targetId}`;
    case "record":
      return "/guinness";
    case "guinness_submission":
      return "/guinness/apply";
    default:
      return "/";
  }
};

const getPushTitle = (type: NotificationType) => {
  if (type === "BID" || type === "OUTBID" || type === "AUCTION_END" || type === "AUCTION_WON") {
    return "브리디 경매 알림";
  }
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
      },
    });

    if (sendPush) {
      await sendPushToUsers([userId], {
        title: getPushTitle(type),
        body: message,
        url: getNotificationUrl(targetType, targetId),
        tag: `${type}-${targetType || "default"}-${targetId || 0}`,
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
