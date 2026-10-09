import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  notification: { findMany: jest.fn(), count: jest.fn() },
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
