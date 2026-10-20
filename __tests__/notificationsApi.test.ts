import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  notification: { findMany: jest.fn(), count: jest.fn() },
  post: { findMany: jest.fn().mockResolvedValue([]) },
  product: { findMany: jest.fn().mockResolvedValue([]) },
  auction: { findMany: jest.fn().mockResolvedValue([]) },
  bloodlineCard: { findMany: jest.fn().mockResolvedValue([]) },
  // 차단한 발신자 제외(libs/server/notificationGate visibleNotificationWhere)
  userBlock: { findMany: jest.fn().mockResolvedValue([]) },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import notificationsHandler from "../pages/api/notifications";

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

const NOW = new Date("2026-10-09T05:20:00.000Z");

describe("GET /api/notifications — 운영 알림 보낸 사람 숨김(AC-15)", () => {
  it("MODERATION 알림은 운영자 계정 대신 '브리디 운영팀'을 준다", async () => {
    mockClient.notification.findMany.mockResolvedValue([
      { id: 1, type: "MODERATION", message: "경고", isRead: false, targetId: 3, targetType: "sanction", createdAt: NOW, sender: { id: 1, name: "운영자A", avatar: "admin-avatar" } },
      { id: 2, type: "COMMENT", message: "댓글", isRead: true, targetId: 30, targetType: "post", createdAt: NOW, sender: { id: 5, name: "참나무", avatar: null } },
    ]);
    mockClient.notification.count.mockResolvedValue(1);
    const res = createRes();
    await notificationsHandler(
      { method: "GET", headers: {}, query: {}, body: {}, user: { id: 7 } } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications[0].sender).toEqual({ id: 0, name: "브리디 운영팀", avatar: null });
    expect(JSON.stringify(res.body.notifications[0])).not.toMatch(/운영자A|admin-avatar/);
    expect(res.body.notifications[1].sender).toEqual({ id: 5, name: "참나무", avatar: null });
  });
});

describe("GET /api/notifications — 대상 썸네일(targetImage)", () => {
  const getList = async () => {
    const res = createRes();
    await notificationsHandler(
      { method: "GET", headers: {}, query: {}, body: {}, user: { id: 7 } } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );
    return res;
  };
  const base = { message: "m", isRead: false, commentId: null, createdAt: NOW, sender: { id: 5, name: "참나무", avatar: null } };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.notification.findMany.mockResolvedValue([
      { ...base, id: 1, type: "LIKE", targetType: "post", targetId: 30 },
      { ...base, id: 2, type: "FAV", targetType: "product", targetId: 40 },
      { ...base, id: 3, type: "BID", targetType: "auction", targetId: 50 },
      { ...base, id: 4, type: "BLOODLINE_RECEIVED", targetType: "bloodline", targetId: 60 },
      { ...base, id: 5, type: "FOLLOW", targetType: "user", targetId: 5 },
      { ...base, id: 6, type: "COMMENT", targetType: "post", targetId: 30 },
      { ...base, id: 7, type: "LIKE", targetType: "post", targetId: 31 },
    ]);
    mockClient.notification.count.mockResolvedValue(7);
  });

  it("게시글·분양글·경매·혈통 카드의 대표 사진을 붙이고, 대상마다 한 번씩만 읽는다", async () => {
    mockClient.post.findMany.mockResolvedValue([{ id: 30, image: "old", images: ["p1", "p2"] }]);
    mockClient.product.findMany.mockResolvedValue([{ id: 40, mainImage: null, photos: ["pr1"] }]);
    mockClient.auction.findMany.mockResolvedValue([{ id: 50, photos: ["a1"] }]);
    mockClient.bloodlineCard.findMany.mockResolvedValue([{ id: 60, image: "c1" }]);

    const res = await getList();
    expect(res.statusCode).toBe(200);
    expect(res.body.notifications.map((n: { targetImage: string | null }) => n.targetImage)).toEqual([
      "p1",
      "pr1",
      "a1",
      "c1",
      null, // 사용자 대상은 썸네일이 없다
      "p1",
      null, // 숨김·삭제돼 조회되지 않은 글
    ]);
    expect(mockClient.post.findMany).toHaveBeenCalledTimes(1);
    expect(mockClient.post.findMany.mock.calls[0][0].where).toEqual({ id: { in: [30, 31] }, isHidden: false });
    expect(mockClient.product.findMany.mock.calls[0][0].where).toEqual({
      id: { in: [40] },
      isHidden: false,
      isDeleted: false,
    });
  });

  it("사진을 못 읽어도 목록은 썸네일 없이 그대로 준다", async () => {
    mockClient.post.findMany.mockRejectedValue(new Error("db down"));
    mockClient.product.findMany.mockResolvedValue([]);
    mockClient.auction.findMany.mockResolvedValue([]);
    mockClient.bloodlineCard.findMany.mockResolvedValue([]);
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await getList();
    spy.mockRestore();
    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toHaveLength(7);
    expect(res.body.notifications.every((n: { targetImage: string | null }) => n.targetImage === null)).toBe(true);
  });
});
