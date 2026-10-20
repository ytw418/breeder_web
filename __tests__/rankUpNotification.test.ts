/**
 * @jest-environment node
 */
/**
 * RANK_UP·BREEDER_RANK_DROP 알림: 같은 주(KST) 안에서 순위가 바뀌었을 때 방향마다 주 1회, url /ranking?focus=me.
 */
const NOW = new Date("2026-10-14T00:00:00.000Z"); // 수요일 09:00 KST (주 시작 10-11T15:00Z)
const mockCreateNotification = jest.fn();
const mockSendPush = jest.fn();
const mockClient = {
  alertSubscription: { findMany: jest.fn() },
  alertState: { upsert: jest.fn() },
  notification: { findFirst: jest.fn(), create: jest.fn() },
  auction: { findUnique: jest.fn() },
  // 푸시 전 알림 설정 조회(libs/server/notificationGate). 저장된 적 없으면 모두 켜짐.
  user: { findUnique: jest.fn(async () => null) },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/pushGateway", () => ({ sendAllPushToUsers: (...args: unknown[]) => mockSendPush(...args) }));
jest.mock("@libs/server/ranking", () => ({
  getBreederRanking: jest.fn(async () => [{ user: { id: 7 }, rank: 5, score: 40 }]),
  getBloodlineRanking: jest.fn(async () => []),
  getAuctionRanking: jest.fn(async () => []),
}));

import { processRankingAlerts, rankUpMessage, shouldNotifyRankUp } from "@libs/server/growth-jobs";
import { getNotificationUrl } from "@libs/server/notification";

const sub = (alertType: string, lastObservedRank: number, updatedAt: Date) => ({
  id: alertType === "BREEDER_RANK_DROP" ? 1 : 2,
  userId: 7,
  alertType,
  entityType: "USER",
  entityId: 7,
  state: { lastObservedRank, lastNotifiedAt: null, updatedAt },
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  mockClient.notification.findFirst.mockResolvedValue(null);
});
afterEach(() => jest.useRealTimers());

describe("shouldNotifyRankUp", () => {
  const weekStart = new Date("2026-10-11T15:00:00.000Z");
  const base = { previousRank: 7, currentRank: 5, observedAt: new Date("2026-10-13T00:00:00.000Z"), weekStart, notifiedThisWeek: false };
  it("같은 주 안에서 오르면 true", () => expect(shouldNotifyRankUp(base)).toBe(true));
  it("내려갔거나 같으면 false", () => {
    expect(shouldNotifyRankUp({ ...base, currentRank: 7 })).toBe(false);
    expect(shouldNotifyRankUp({ ...base, currentRank: 9 })).toBe(false);
  });
  it("지난주 관측과는 비교하지 않는다", () => {
    expect(shouldNotifyRankUp({ ...base, observedAt: new Date("2026-10-11T00:00:00.000Z") })).toBe(false);
  });
  it("이번 주에 이미 보냈으면 false", () => expect(shouldNotifyRankUp({ ...base, notifiedThisWeek: true })).toBe(false));
  it("문구", () => expect(rankUpMessage(7, 5)).toBe("순위가 올랐어요 · 7위 → 5위"));
});

describe("processRankingAlerts RANK_UP", () => {
  it("같은 주 7위 → 5위면 구독 하나에서만 한 번 보낸다(url /ranking?focus=me)", async () => {
    const observed = new Date("2026-10-13T00:00:00.000Z");
    mockClient.alertSubscription.findMany.mockResolvedValue([
      sub("BREEDER_RANK_DROP", 7, observed),
      sub("BREEDER_OVERTAKEN", 7, observed),
    ]);
    await processRankingAlerts();
    const created = mockClient.notification.create.mock.calls.map((c) => c[0].data);
    expect(created).toEqual([
      expect.objectContaining({ type: "RANK_UP", userId: 7, message: "순위가 올랐어요 · 7위 → 5위", targetType: "ranking" }),
    ]);
    expect(mockSendPush.mock.calls[0][1]).toMatchObject({ url: "/ranking?focus=me" });
    expect(mockClient.notification.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 7, type: "RANK_UP" });
  });

  it("3위 → 5위로 내려가면 구독이 둘이어도 하락 알림 한 통, 누르면 랭킹", async () => {
    const observed = new Date("2026-10-13T00:00:00.000Z");
    mockClient.alertSubscription.findMany.mockResolvedValue([
      sub("BREEDER_RANK_DROP", 3, observed),
      sub("BREEDER_OVERTAKEN", 3, observed),
    ]);
    await processRankingAlerts();
    const created = mockClient.notification.create.mock.calls.map((c) => c[0].data);
    expect(created).toEqual([
      expect.objectContaining({
        type: "BREEDER_RANK_DROP",
        message: "순위가 #3에서 #5로 내려갔어요 · 추월한 브리더 2명",
        targetType: "ranking",
      }),
    ]);
    expect(mockSendPush.mock.calls[0][1]).toMatchObject({ url: "/ranking?focus=me" });
  });

  it("이번 주에 이미 보냈으면 보내지 않는다", async () => {
    mockClient.alertSubscription.findMany.mockResolvedValue([sub("BREEDER_RANK_DROP", 7, new Date("2026-10-13T00:00:00.000Z"))]);
    mockClient.notification.findFirst.mockResolvedValue({ id: 1 });
    await processRankingAlerts();
    expect(mockClient.notification.create).not.toHaveBeenCalled();
  });

  it("같은 주 두 번째 하락은 보내지 않는다", async () => {
    mockClient.alertSubscription.findMany.mockResolvedValue([sub("BREEDER_RANK_DROP", 3, new Date("2026-10-13T00:00:00.000Z"))]);
    mockClient.notification.findFirst.mockResolvedValue({ id: 1 });
    await processRankingAlerts();
    expect(mockClient.notification.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 7, type: "BREEDER_RANK_DROP" });
    expect(mockClient.notification.create).not.toHaveBeenCalled();
  });

  it("하락도 지난주 관측과는 비교하지 않는다(월요일 첫 실행의 가짜 하락)", async () => {
    mockClient.alertSubscription.findMany.mockResolvedValue([sub("BREEDER_RANK_DROP", 3, new Date("2026-10-11T00:00:00.000Z"))]);
    await processRankingAlerts();
    expect(mockClient.notification.create).not.toHaveBeenCalled();
  });

  it("getNotificationUrl ranking", () => {
    expect(getNotificationUrl("ranking", 7)).toBe("/ranking?focus=me");
  });
});
