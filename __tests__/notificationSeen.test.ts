import { hasUnseen, showNotificationDot } from "@libs/shared/notificationSeen";
import { markNotificationsSeen, NOTIFICATIONS_SEEN_KEY, readNotificationsSeenAt } from "@libs/client/notificationSeen";

describe("알림 벨 점(notificationSeen)", () => {
  it("hasUnseen: 최신 알림이 마지막으로 본 시각보다 뒤일 때만 true", () => {
    expect(hasUnseen("2026-10-12T10:00:00Z", "2026-10-12T09:00:00Z")).toBe(true);
    expect(hasUnseen("2026-10-12T10:00:00Z", "2026-10-12T11:00:00Z")).toBe(false);
    expect(hasUnseen("2026-10-12T10:00:00Z", null)).toBe(true);
    expect(hasUnseen(null, null)).toBe(false);
  });

  it("showNotificationDot: 안 읽은 게 없으면 없음, 구 서버(최신 시각 없음)는 한 번도 안 봤을 때만", () => {
    expect(showNotificationDot({ unreadCount: 0, latestUnreadAt: "2026-10-12T10:00:00Z", lastSeenAt: null })).toBe(false);
    expect(showNotificationDot({ unreadCount: 2, latestUnreadAt: null, lastSeenAt: null })).toBe(true);
    expect(showNotificationDot({ unreadCount: 2, latestUnreadAt: null, lastSeenAt: 1 })).toBe(false);
  });

  it("markNotificationsSeen 은 시각을 저장하고 같은 탭에 알린다", () => {
    const listener = jest.fn();
    window.addEventListener("bredy:notifications-seen", listener);
    markNotificationsSeen(1234);
    expect(window.localStorage.getItem(NOTIFICATIONS_SEEN_KEY)).toBe("1234");
    expect(readNotificationsSeenAt()).toBe(1234);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("bredy:notifications-seen", listener);
  });
});
