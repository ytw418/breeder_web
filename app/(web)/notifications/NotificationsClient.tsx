"use client";

import Layout, { toLoginHref } from "@components/features/MainLayout";
import { EmptyState } from "@components/app/EmptyState";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { LoadingBlock } from "@components/features/profile/ProfileRows";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import { toAuctionPath } from "@libs/auction-route";
import useSWR, { useSWRConfig } from "swr";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { NotificationItem, NotificationsResponse } from "pages/api/notifications";
import {
  formatNotificationTime,
  getNotificationHref,
  getNotificationIcon,
  NOTIFICATION_ICON_PATHS,
} from "./notificationFormat";

const UNREAD_COUNT_KEY = "/api/notifications/unread-count";

function NotificationIcon({ type, unread }: { type: NotificationItem["type"]; unread: boolean }) {
  const name = getNotificationIcon(type);
  return (
    <div className="mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-surface">
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
        className={unread ? "text-app-brand" : "text-app-muted"}
      >
        {NOTIFICATION_ICON_PATHS[name].map((d) => (
          <path key={d} d={d} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    </div>
  );
}

/** 알림 목록(앱 notifications/index.tsx): 72 행 · 44 타입 아이콘 · 안 읽음 brandSoft 배경. */
const NotificationsClient = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isToolRoute = pathname?.startsWith("/tool");
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>("/api/notifications");
  const [markingAll, setMarkingAll] = useState(false);
  const didAutoMarkReadRef = useRef(false);
  const errorStatus = (error as (Error & { status?: number }) | undefined)?.status;

  const setUnreadBadge = useCallback(
    (next: (prev: number) => number) => {
      void globalMutate(
        UNREAD_COUNT_KEY,
        (prev: { success: boolean; unreadCount: number } | undefined) =>
          prev ? { ...prev, unreadCount: Math.max(0, next(prev.unreadCount)) } : prev,
        false
      );
    },
    [globalMutate]
  );

  const handleMarkAllRead = useCallback(
    async (silent = false) => {
      setMarkingAll(true);
      try {
        const res = await authFetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const result = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
        if (!res.ok || !result?.success) {
          if (!silent) toast.error(result?.error || "읽음 처리에 실패했습니다.");
          return;
        }
        // 목록 화면과 헤더 뱃지 수치를 즉시 동기화한다.
        void mutate(
          (prev) =>
            prev
              ? {
                  ...prev,
                  unreadCount: 0,
                  notifications: prev.notifications.map((item) => ({ ...item, isRead: true })),
                }
              : prev,
          false
        );
        setUnreadBadge(() => 0);
      } catch {
        if (!silent) toast.error("읽음 처리에 실패했습니다.");
      } finally {
        setMarkingAll(false);
      }
    },
    [mutate, setUnreadBadge]
  );

  // 화면에 들어오면 안 읽은 알림을 조용히 모두 읽음 처리한다(앱과 같다).
  useEffect(() => {
    if (!data || data.unreadCount <= 0 || didAutoMarkReadRef.current) return;
    didAutoMarkReadRef.current = true;
    void handleMarkAllRead(true);
  }, [data, handleMarkAllRead]);

  const getLink = (targetType: string | null, targetId: number | null) => {
    if (!isToolRoute) return getNotificationHref(targetType, targetId);
    if (!targetType || !targetId) return "/tool";
    if (targetType === "auction") return `/tool${toAuctionPath(targetId)}`;
    return "/tool";
  };

  /** 누르면 바로 읽음으로 바꾸고(낙관적), 서버에 그 알림만 읽음 처리한 뒤 대상으로 이동한다. */
  const handlePress = (notification: NotificationItem) => {
    if (!notification.isRead) {
      void mutate(
        (prev) =>
          prev
            ? {
                ...prev,
                unreadCount: Math.max(0, prev.unreadCount - 1),
                notifications: prev.notifications.map((item) =>
                  item.id === notification.id ? { ...item, isRead: true } : item
                ),
              }
            : prev,
        false
      );
      setUnreadBadge((prev) => prev - 1);
      void authFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      }).catch(() => undefined);
    }
    const href = getLink(notification.targetType, notification.targetId);
    if (href) router.push(href);
  };

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  let content;
  if (isLoading) {
    content = <LoadingBlock height={320} />;
  } else if (!data && errorStatus === 401) {
    content = (
      <EmptyState
        title="로그인이 필요해요"
        description="알림을 보려면 로그인해 주세요."
        action={{
          label: "로그인하기",
          // 툴 알림은 툴 로그인으로 보낸다(로그인 후 툴 알림으로 돌아온다).
          href: isToolRoute
            ? `/tool/login?next=${encodeURIComponent(pathname || "/tool/notifications")}`
            : toLoginHref(pathname || "/notifications"),
        }}
        className="py-24"
      />
    );
  } else if (error && !data) {
    content = (
      <div className="flex min-h-[60vh] flex-col justify-center px-6">
        <QueryErrorState title="알림을 불러오지 못했어요" onRetry={() => void mutate()} />
      </div>
    );
  } else if (!notifications.length) {
    content = (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-[16px] font-semibold text-app-text">알림이 없습니다</p>
        <p className="mt-1.5 text-[14px] text-app-muted">새로운 소식이 생기면 알려드릴게요</p>
      </div>
    );
  } else {
    content = (
      <ul>
        {notifications.map((notification) => (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => handlePress(notification)}
              className={cn(
                "flex min-h-[72px] w-full items-center border-b border-app-line px-4 py-3 text-left transition-colors",
                notification.isRead ? "bg-app-bg hover:bg-app-surface" : "bg-app-brand-soft"
              )}
            >
              <NotificationIcon type={notification.type} unread={!notification.isRead} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-keep text-[15px] leading-[21px] text-app-text">
                  {notification.message}
                </p>
                <p className="mt-1 text-[13px] text-app-muted">{formatNotificationTime(notification.createdAt)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Layout canGoBack title="알림" seoTitle="알림">
      <div className="bg-app-bg">
        {unreadCount > 0 ? (
          <div className="flex justify-end border-b border-app-line px-4 py-2.5">
            <button
              type="button"
              disabled={markingAll}
              onClick={() => void handleMarkAllRead()}
              className="text-[14px] text-app-brand disabled:opacity-60"
            >
              {markingAll ? "처리 중..." : "모두 읽음 처리"}
            </button>
          </div>
        ) : null}
        {content}
      </div>
    </Layout>
  );
};

export default NotificationsClient;
