"use client";

import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl, getTimeAgoString } from "@libs/client/utils";
import Link from "next/link";
import useSWR from "swr";
import useMutation from "hooks/useMutation";
import { NotificationsResponse } from "pages/api/notifications";
import { NotificationType } from "@prisma/client";

/** 알림 타입별 색상 */
const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  LIKE: "bg-red-400",
  COMMENT: "bg-blue-400",
  CHAT: "bg-green-400",
  FOLLOW: "bg-purple-400",
  FAV: "bg-yellow-400",
  NEW_PRODUCT: "bg-orange-400",
  NEW_POST: "bg-teal-400",
  BID: "bg-emerald-400",
  OUTBID: "bg-amber-500",
  AUCTION_WON: "bg-yellow-500",
  AUCTION_END: "bg-gray-400",
  NEW_RECORD: "bg-indigo-400",
};

/** 알림 타입별 링크 경로 */
const getNotificationLink = (
  targetType: string | null,
  targetId: number | null
): string => {
  if (!targetType || !targetId) return "#";

  switch (targetType) {
    case "post":
      return `/posts/${targetId}`;
    case "product":
      return `/products/${targetId}`;
    case "chatRoom":
      return `/chat/${targetId}`;
    case "user":
      return `/profiles/${targetId}`;
    case "auction":
      return `/auctions/${targetId}`;
    case "record":
      return `/guinness`;
    case "guinness_submission":
      return `/guinness`;
    default:
      return "#";
  }
};

const NotificationsClient = () => {
  const { data, mutate } = useSWR<NotificationsResponse>(
    "/api/notifications"
  );
  const [markAllRead] = useMutation("/api/notifications");

  const handleMarkAllRead = async () => {
    await markAllRead({ data: {} });
    mutate();
  };

  return (
    <Layout canGoBack title="알림" seoTitle="알림">
      {/* 헤더: 모두 읽음 처리 */}
      {data?.unreadCount && data.unreadCount > 0 ? (
        <div className="px-4 py-2 flex justify-end">
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-primary hover:underline"
          >
            모두 읽음 처리
          </button>
        </div>
      ) : null}

      {/* 알림 목록 */}
      <div className="divide-y divide-gray-50">
        {data?.notifications?.map((notification) => (
          <Link
            key={notification.id}
            href={getNotificationLink(
              notification.targetType,
              notification.targetId
            )}
            className={cn(
              "flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors",
              !notification.isRead && "bg-primary/5"
            )}
          >
            {/* 발신자 아바타 */}
            <div className="relative flex-shrink-0">
              {notification.sender.avatar ? (
                <Image
                  src={makeImageUrl(notification.sender.avatar, "avatar")}
                  alt={notification.sender.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full bg-gray-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200" />
              )}
              {/* 알림 타입 표시 */}
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                  NOTIFICATION_COLORS[notification.type]
                )}
              />
            </div>

            {/* 알림 내용 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">{notification.message}</p>
              <span className="text-xs text-gray-400">
                {getTimeAgoString(new Date(notification.createdAt))}
              </span>
            </div>

            {/* 읽지 않은 표시 */}
            {!notification.isRead && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
            )}
          </Link>
        ))}
      </div>

      {/* 알림 없음 */}
      {data && data.notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg font-medium">알림이 없습니다</p>
          <p className="text-sm mt-1">새로운 소식이 생기면 알려드릴게요</p>
        </div>
      )}
    </Layout>
  );
};

export default NotificationsClient;
