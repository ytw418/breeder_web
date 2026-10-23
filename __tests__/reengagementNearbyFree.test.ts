/** 동네 무료 분양 알림(재방문 알림 ①): 동네를 공개한 분양자의 무료 분양만, 같은 시/군/구 이웃에게, 팔로워·차단 제외. */
const mockClient = {
  product: { findUnique: jest.fn() },
  userBlock: { findMany: jest.fn() },
  follow: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  notification: { findMany: jest.fn(), createMany: jest.fn() },
};
const mockPush = jest.fn();
const mockFilter = jest.fn(async (ids: number[]) => ids);
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/pushGateway", () => ({ sendAllPushToUsers: (...args: unknown[]) => mockPush(...args) }));
jest.mock("@libs/server/notificationGate", () => ({
  filterPushRecipients: (ids: number[]) => mockFilter(ids),
}));
jest.mock("@libs/server/categories", () => ({ getAllCategories: jest.fn(), resolveScopeCategoryIds: jest.fn() }));

import { notifyNearbyFreeProduct } from "@libs/server/reengagement";

const DAY_TIME = new Date("2026-10-23T03:00:00.000Z"); // KST 12시
const NIGHT_TIME = new Date("2026-10-23T14:00:00.000Z"); // KST 23시

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 77,
  name: "레오 베이비",
  price: 0,
  dealType: "sale",
  category: "레오파드 게코",
  isHidden: false,
  isDeleted: false,
  userId: 10,
  user: { regionSido: "서울특별시", regionSigungu: "강남구", regionVisible: true, status: "ACTIVE" },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.userBlock.findMany.mockResolvedValue([{ blockerId: 30, blockedId: 10 }]);
  mockClient.follow.findMany.mockResolvedValue([{ followerId: 20 }]);
  mockClient.user.findMany.mockResolvedValue([{ id: 40 }, { id: 41 }]);
  mockClient.notification.findMany.mockResolvedValue([{ userId: 41, type: "NEARBY_FREE_PRODUCT" }]);
});

it("같은 시/군/구 이웃에게 알림과 푸시를 보내고, 분양자·차단·팔로워·오늘 받은 사람은 뺀다", async () => {
  mockClient.product.findUnique.mockResolvedValue(product());

  await expect(notifyNearbyFreeProduct(77, DAY_TIME)).resolves.toBe(1);

  const where = mockClient.user.findMany.mock.calls[0][0].where;
  expect(where).toMatchObject({ status: "ACTIVE", regionSido: "서울특별시", regionSigungu: "강남구" });
  expect(where.id.notIn).toEqual([10, 30, 20]);
  expect(mockClient.notification.createMany.mock.calls[0][0].data).toEqual([
    {
      type: "NEARBY_FREE_PRODUCT",
      message: "강남구에 레오파드 게코 무료 분양이 올라왔어요: 레오 베이비",
      userId: 40,
      senderId: 10,
      targetId: 77,
      targetType: "product",
    },
  ]);
  expect(mockPush).toHaveBeenCalledWith([40], {
    title: "강남구에 레오파드 게코 무료 분양이 올라왔어요",
    body: "레오 베이비 · 바로 확인해 보세요",
    url: "/products/77",
    tag: "nearby-free-77",
  });
});

it("동네를 숨긴 분양자·유료 분양·숨긴 글은 보내지 않는다", async () => {
  for (const overrides of [
    { user: { regionSido: "서울특별시", regionSigungu: "강남구", regionVisible: false, status: "ACTIVE" } },
    { price: 50000 },
    { isHidden: true },
    { user: { regionSido: null, regionSigungu: null, regionVisible: true, status: "ACTIVE" } },
  ]) {
    mockClient.product.findUnique.mockResolvedValue(product(overrides));
    await expect(notifyNearbyFreeProduct(77, DAY_TIME)).resolves.toBe(0);
  }
  expect(mockClient.notification.createMany).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it("밤(KST 21시~8시)에는 알림 행만 남기고 푸시는 보내지 않는다", async () => {
  mockClient.product.findUnique.mockResolvedValue(product({ dealType: "adoption", price: 10000 }));

  await expect(notifyNearbyFreeProduct(77, NIGHT_TIME)).resolves.toBe(1);

  expect(mockClient.notification.createMany).toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});
