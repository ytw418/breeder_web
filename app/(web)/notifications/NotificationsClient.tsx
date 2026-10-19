"use client";

import { markNotificationsSeen } from "@libs/client/notificationSeen";
import Layout, { toLoginHref } from "@components/features/MainLayout";
import { EmptyState } from "@components/app/EmptyState";
import { QueryErrorState } from "@components/app/QueryErrorState";
import Image from "@components/atoms/Image";
import { LoadingBlock, ProfileAvatar } from "@components/features/profile/ProfileRows";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { cn, makeImageUrl } from "@libs/client/utils";
import { toAuctionPath } from "@libs/auction-route";
import {
  formatNotificationTime,
  getNotificationKind,
  groupNotifications,
  markNotificationRead,
  NOTIFICATION_ICON_PATHS,
  splitNotificationMessage,
  type NotificationIconName,
} from "@libs/shared/notificationFormat";
import useSWR, { useSWRConfig } from "swr";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { NotificationItem, NotificationsResponse } from "pages/api/notifications";
import { getNotificationHref } from "./notificationFormat";

const UNREAD_COUNT_KEY = "/api/notifications/unread-count";
/** 서버 GET /api/notifications 가 주는 최대 개수(take: 50). */
const NOTIFICATION_LIMIT = 50;

function NotiIcon({
  name,
  size,
  strokeWidth = 1.5,
  className,
}: {
  name: NotificationIconName;
  size: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      className={className}
    >
      {NOTIFICATION_ICON_PATHS[name].map((d) => (
        <path key={d} d={d} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/**
 * 알림 행(앱 notifications/index.tsx, 시안 bredy_app design/mockups/notifications/A-karrot.html #noti-row).
 * 사람이 한 일은 아바타 44 + 종류 뱃지 22, 시스템 알림은 44 회색 원 아이콘. 안 읽음은 brand-soft 배경.
 */
function NotificationRow({ notification, onPress }: { notification: NotificationItem; onPress: () => void }) {
  const kind = getNotificationKind(notification.type, notification.message);
  const { lead, rest } = splitNotificationMessage(notification);
  const unread = !notification.isRead;
  const time = formatNotificationTime(notification.createdAt);
  return (
    <button
      type="button"
      onClick={onPress}
      // 아바타 '프로필 이미지' 라벨이 섞이지 않게 앱과 같은 문장으로 읽힌다.
      aria-label={`${unread ? "안 읽음, " : ""}${lead ?? ""}${rest}, ${kind.label}, ${time}`}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
        unread ? "bg-app-brand-soft" : "bg-app-bg hover:bg-app-surface"
      )}
    >
      <span className="relative h-11 w-11 shrink-0">
        {kind.fromPerson ? (
          <>
            <ProfileAvatar avatar={notification.sender?.avatar} name={notification.sender?.name ?? ""} size={44} />
            {/* 22 고리(행 배경색) 안에 18 뱃지. 다크의 안 읽음 배경(brand-soft)은 반투명이라 bg 위에 한 겹 더 깐다. */}
            <span className="absolute -bottom-[3px] -right-[3px] flex h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full bg-app-bg">
              {unread ? <span className="absolute inset-0 bg-app-brand-soft" /> : null}
              <span className="relative flex h-[18px] w-[18px] items-center justify-center rounded-full bg-app-text text-app-bg">
                <NotiIcon name={kind.icon} size={12} strokeWidth={2} />
              </span>
            </span>
          </>
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-app-surface">
            {/* 운영 알림 방패는 읽음 여부와 상관없이 회색이다(시안 moderation #noti-row). */}
            <NotiIcon
              name={kind.icon}
              size={22}
              className={notification.type === "MODERATION" ? "text-app-muted" : "text-app-text"}
            />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1 pt-px">
        <span className="line-clamp-3 break-keep text-[15px] leading-[21px] text-app-text">
          {lead ? <b className="font-semibold">{lead}</b> : null}
          {rest}
        </span>
        <span className="mt-1 block text-[13px] leading-[18px] text-app-muted">
          {kind.label} · {time}
        </span>
      </span>

      {notification.targetImage ? (
        <Image
          src={makeImageUrl(notification.targetImage, "product")}
          alt="알림 대상 사진"
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-lg bg-app-placeholder object-cover"
        />
      ) : null}
    </button>
  );
}

/** 알림 목록(앱 notifications/index.tsx): 날짜 묶음 · 안 읽은 수 + 모두 읽음 · 누른 알림만 읽음. */
const NotificationsClient = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isToolRoute = pathname?.startsWith("/tool");
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>("/api/notifications");
  const [markingAll, setMarkingAll] = useState(false);

  // 화면을 열면(그리고 목록을 새로 받을 때마다) '여기까지 봤다'만 남긴다 → 모든 헤더 벨 점이 바로 사라진다.
  // 개별 알림 읽음은 그대로 둔다(2026-10-11 버그 수정 유지).
  useEffect(() => {
    markNotificationsSeen();
  }, [data]);
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

  // 화면에 들어왔다고 읽음 처리하지 않는다(2026-10-11 버그 — 누르지 않은 알림까지 다 읽음이 됐다).
  // 누른 알림 하나, 또는 '모두 읽음'을 눌렀을 때만 읽음이 된다.
  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      const res = await authFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !result?.success) {
        toast.error(result?.error || "읽음 처리에 실패했습니다.");
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
      toast.error("읽음 처리에 실패했습니다.");
    } finally {
      setMarkingAll(false);
    }
  }, [mutate, setUnreadBadge]);

  const getLink = (targetType: string | null, targetId: number | null, commentId?: number | null) => {
    if (!isToolRoute) return getNotificationHref(targetType, targetId, commentId);
    if (!targetType || !targetId) return "/tool";
    if (targetType === "auction") return `/tool${toAuctionPath(targetId)}`;
    return "/tool";
  };

  /** 누르면 바로 읽음으로 바꾸고(낙관적), 서버에 그 알림만 읽음 처리한 뒤 대상으로 이동한다. */
  const handlePress = (notification: NotificationItem) => {
    if (!notification.isRead) {
      void mutate((prev) => (prev ? markNotificationRead(prev, notification.id) : prev), false);
      setUnreadBadge((prev) => prev - 1);
      void authFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      }).catch(() => undefined);
    }
    const href = getLink(notification.targetType, notification.targetId, notification.commentId);
    if (href) router.push(href);
  };

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = useMemo(() => data?.notifications ?? [], [data]);
  const sections = useMemo(() => groupNotifications(notifications), [notifications]);

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
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 pb-24 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-surface text-app-caption">
          <NotiIcon name="bell" size={28} />
        </span>
        <p className="text-[16px] font-semibold leading-[22px] text-app-text">아직 알림이 없어요</p>
        <p className="mt-1.5 text-[14px] leading-5 text-app-muted">
          댓글·입찰·팔로우 소식이 생기면
          <br />
          여기에서 알려드릴게요
        </p>
      </div>
    );
  } else {
    content = (
      <div className="pb-6">
        {sections.map((section, index) => (
          <section key={section.key} aria-labelledby={`noti-section-${section.key}`}>
            <h2
              id={`noti-section-${section.key}`}
              className={cn("px-4 pb-1.5 text-[15px] font-bold leading-5 text-app-text", index === 0 ? "pt-4" : "pt-5")}
            >
              {section.title}
            </h2>
            <ul>
              {section.items.map((notification) => (
                <li key={notification.id}>
                  <NotificationRow notification={notification} onPress={() => handlePress(notification)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {notifications.length >= NOTIFICATION_LIMIT ? (
          <p className="pt-6 text-center text-[13px] text-app-muted">최근 알림 {NOTIFICATION_LIMIT}개까지 보여요</p>
        ) : null}
      </div>
    );
  }

  return (
    <Layout canGoBack title="알림" seoTitle="알림">
      <div className="bg-app-bg">
        {unreadCount > 0 ? (
          <div className="flex h-11 items-center justify-between border-b border-app-line px-4">
            <p className="text-[14px] text-app-muted">
              안 읽은 알림 <b className="font-semibold text-app-text">{unreadCount > 99 ? "99+" : unreadCount}개</b>
            </p>
            <button
              type="button"
              disabled={markingAll}
              onClick={() => void handleMarkAllRead()}
              className="-my-2 py-2 text-[14px] font-semibold text-app-brand disabled:opacity-60"
            >
              {markingAll ? "처리 중..." : "모두 읽음"}
            </button>
          </div>
        ) : null}
        {content}
      </div>
    </Layout>
  );
};

export default NotificationsClient;
