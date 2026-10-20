/**
 * @jest-environment node
 */
/**
 * 차단한 사람이 일으킨 알림은 만들지 않지만, 경매 거래 알림은 차단과 관계없이 만들고 목록에도 남긴다
 * (A 가 B 를 차단해도 제3자 경매에서 B 에게 밀린 OUTBID 는 받아야 한다). libs/server/notificationGate.
 */
const mockClient = {
  // 받는 사람(1)이 보낸 사람(2)을 차단했다.
  userBlock: { findMany: jest.fn(async () => [{ blockerId: 1, blockedId: 2 }]) },
  notification: { findFirst: jest.fn(), create: jest.fn() },
  user: { findUnique: jest.fn(async () => null) },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/pushGateway", () => ({ sendAllPushToUsers: jest.fn() }));

import { createNotification } from "@libs/server/notification";
import { visibleNotificationWhere } from "@libs/server/notificationGate";

it("차단한 사람의 좋아요 알림은 만들지 않고, 더 높은 입찰 알림은 만들고 목록에도 남긴다", async () => {
  await createNotification({ type: "LIKE", userId: 1, senderId: 2, message: "좋아요", targetId: 3, targetType: "post" });
  expect(mockClient.notification.create).not.toHaveBeenCalled();

  await createNotification({ type: "OUTBID", userId: 1, senderId: 2, message: "더 높은 입찰", targetId: 4, targetType: "auction" });
  expect(mockClient.notification.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ type: "OUTBID", userId: 1 }) })
  );

  const where = await visibleNotificationWhere(1);
  expect(where.OR).toContainEqual({ type: { in: expect.arrayContaining(["MODERATION", "OUTBID", "AUCTION_WON", "AUCTION_END"]) } });
});
