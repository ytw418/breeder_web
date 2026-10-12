import {
  formatNotificationTime,
  getNotificationKind,
  groupNotifications,
  markNotificationRead,
  splitNotificationMessage,
} from "@libs/shared/notificationFormat";

/** 앱 src/lib/notificationFormat.ts 와 같은 규칙(앱은 scripts/test-notification-format.mjs). */

// 2026-10-11(일) 15:00 현지 시각
const NOW = new Date(2026, 9, 11, 15, 0, 0).getTime();
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe("formatNotificationTime", () => {
  it("방금·분·시간·어제·N일 전·날짜", () => {
    expect(formatNotificationTime(new Date(NOW - 20_000).toISOString(), NOW)).toBe("방금");
    expect(formatNotificationTime(new Date(NOW - 3 * 60_000).toISOString(), NOW)).toBe("3분 전");
    expect(formatNotificationTime(new Date(NOW - 5 * 3600_000).toISOString(), NOW)).toBe("5시간 전");
    expect(formatNotificationTime(at(2026, 10, 10, 9), NOW)).toBe("어제");
    expect(formatNotificationTime(at(2026, 10, 8), NOW)).toBe("3일 전");
    expect(formatNotificationTime(at(2026, 10, 5), NOW)).toBe("6일 전");
    expect(formatNotificationTime(at(2026, 10, 4), NOW)).toBe("10월 4일");
    expect(formatNotificationTime(at(2025, 12, 31), NOW)).toBe("2025년 12월 31일");
    expect(formatNotificationTime("잘못된 값", NOW)).toBe("");
  });
});

describe("groupNotifications", () => {
  it("오늘 → 최근 7일 → 이전 알림, 빈 묶음은 뺀다", () => {
    const items = [
      { id: 1, createdAt: at(2026, 10, 11, 14) },
      { id: 2, createdAt: at(2026, 10, 11, 0, 5) },
      { id: 3, createdAt: at(2026, 10, 10, 23) },
      { id: 4, createdAt: at(2026, 10, 5) },
      { id: 5, createdAt: at(2026, 10, 4) },
    ];
    expect(groupNotifications(items, NOW).map((s) => [s.key, s.title, s.items.map((i) => i.id)])).toEqual([
      ["today", "오늘", [1, 2]],
      ["week", "최근 7일", [3, 4]],
      ["older", "이전 알림", [5]],
    ]);
    expect(groupNotifications([{ createdAt: at(2026, 9, 1) }], NOW).map((s) => s.key)).toEqual(["older"]);
    expect(groupNotifications([], NOW)).toEqual([]);
  });
});

describe("getNotificationKind", () => {
  it("사람이 한 일은 아바타+뱃지, 시스템 알림은 아이콘 원", () => {
    expect(getNotificationKind("BID")).toEqual({ label: "입찰", icon: "hammer", fromPerson: true });
    expect(getNotificationKind("FOLLOW")).toEqual({ label: "팔로우", icon: "userPlus", fromPerson: true });
    expect(getNotificationKind("OUTBID").fromPerson).toBe(false);
    expect(getNotificationKind("AUCTION_WON").label).toBe("낙찰");
    expect(getNotificationKind("NEW_RECORD").label).toBe("브리디북");
    expect(getNotificationKind("MODERATION")).toEqual({ label: "운영 알림", icon: "shield", fromPerson: false });
    expect(getNotificationKind("SOMETHING_NEW")).toEqual({ label: "알림", icon: "bell", fromPerson: false });
  });

  it("질문 알림(NEW_POST + 질문 문구)은 '질문'으로 보인다", () => {
    expect(getNotificationKind("NEW_POST", "답변을 기다리는 질문이 올라왔어요: 탈피가 안 돼요").label).toBe("질문");
    expect(getNotificationKind("NEW_POST", "젠크레님이 새 글을 작성했습니다: 해칭").label).toBe("새 글");
  });
});

describe("splitNotificationMessage", () => {
  it("보낸 사람 이름만 굵게 나눈다", () => {
    expect(
      splitNotificationMessage({ type: "FOLLOW", message: "젠크레님이 회원님을 팔로우했습니다.", sender: { name: "젠크레" } })
    ).toEqual({ lead: "젠크레", rest: "님이 회원님을 팔로우했습니다." });
    expect(
      splitNotificationMessage({ type: "OUTBID", message: "\"크레\" 경매에서 더 높은 입찰이 들어왔습니다.", sender: { name: "젠크레" } })
    ).toEqual({ lead: null, rest: "\"크레\" 경매에서 더 높은 입찰이 들어왔습니다." });
    expect(
      splitNotificationMessage({ type: "MODERATION", message: "신고하신 게시글을 조치했습니다.", sender: { name: "브리디 운영팀" } })
    ).toEqual({ lead: "브리디 운영팀", rest: " 신고하신 게시글을 조치했습니다." });
    expect(splitNotificationMessage({ type: "LIKE", message: "젠크레", sender: { name: "젠크레" } })).toEqual({ lead: null, rest: "젠크레" });
    expect(splitNotificationMessage({ type: "LIKE", message: "좋아요", sender: null })).toEqual({ lead: null, rest: "좋아요" });
  });
});

describe("markNotificationRead", () => {
  it("목록·안 읽은 수를 바꾸고, 이미 읽은 알림은 그대로", () => {
    const res = {
      success: true,
      unreadCount: 2,
      notifications: [
        { id: 1, isRead: false },
        { id: 2, isRead: false },
        { id: 3, isRead: true },
      ],
    };
    const next = markNotificationRead(res, 2);
    expect(next.unreadCount).toBe(1);
    expect(next.notifications.map((n) => n.isRead)).toEqual([false, true, true]);
    expect(res.notifications[1].isRead).toBe(false);
    expect(markNotificationRead(res, 3)).toBe(res);
    expect(markNotificationRead(res, 99)).toBe(res);
  });
});
