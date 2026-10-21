/** 주간 요약 푸시 대상(커뮤니티 감사 #22): 활동 중·마지막 활동 3~10일 전·푸시 기기 있는 사람. */
const mockClient = {
  user: { findMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/pushGateway", () => ({ sendAllPushToUsers: jest.fn() }));

import { selectDigestAudience } from "@libs/server/weeklyDigest";

const NOW = new Date("2026-10-26T01:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

it("마지막 활동이 정확히 3일 전·10일 전인 사람까지 넣고, 그보다 최근·오래된 사람은 뺀다", async () => {
  mockClient.user.findMany.mockResolvedValue([]);

  await selectDigestAudience(NOW);

  expect(mockClient.user.findMany.mock.calls[0][0].where).toEqual({
    status: "ACTIVE",
    lastActiveAt: { gte: new Date(NOW.getTime() - 10 * DAY), lte: new Date(NOW.getTime() - 3 * DAY) },
    fcmTokens: { some: {} },
  });
});
