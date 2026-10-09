/**
 * 새 질문 알림: 질문 글이 올라오면 그 분야(또는 상위 분야)를 관심 카테고리로 고정한 사람에게
 * '답변을 기다리는 질문' 알림과 푸시를 보낸다. 작성자·차단 관계·정지 계정은 빼고,
 * 12시간 안에 이미 받은 사람에게는 다시 보내지 않는다.
 */
const mockClient = {
  category: { findUnique: jest.fn(), findMany: jest.fn() },
  userBlock: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  notification: { findMany: jest.fn(), createMany: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
const mockSendPush = jest.fn();
jest.mock("@libs/server/pushGateway", () => ({
  sendAllPushToUsers: (...args: unknown[]) => mockSendPush(...args),
}));

import {
  QUESTION_ALERT_COOLDOWN_MS,
  QUESTION_ALERT_MESSAGE_PREFIX,
  notifyQuestionToInterestedUsers,
} from "@libs/server/questionAlert";

const NOW = new Date("2026-10-09T12:00:00.000Z");
const AUTHOR = 7;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  mockClient.category.findUnique.mockResolvedValue({ path: "/insect/stag-beetle/" });
  mockClient.category.findMany.mockResolvedValue([{ id: 1 }, { id: 12 }]);
  mockClient.userBlock.findMany.mockResolvedValue([{ blockerId: 30, blockedId: AUTHOR }]);
  mockClient.user.findMany.mockResolvedValue([{ id: 21 }, { id: 22 }]);
  mockClient.notification.findMany.mockResolvedValue([]);
  mockClient.notification.createMany.mockResolvedValue({ count: 2 });
});

afterEach(() => jest.useRealTimers());

const run = () =>
  notifyQuestionToInterestedUsers({
    postId: 143,
    authorId: AUTHOR,
    title: "유충이 톱밥 위로 계속 올라와요",
    categoryId: 12,
  });

it("글 분야와 그 상위 분야를 고정한 사람을 찾는다(작성자·차단 관계·정지 계정 제외)", async () => {
  await run();

  expect(mockClient.category.findMany).toHaveBeenCalledWith({
    where: { path: { in: ["/insect/", "/insect/stag-beetle/"] } },
    select: { id: true },
  });
  const where = mockClient.user.findMany.mock.calls[0][0].where;
  expect(where).toEqual({
    id: { notIn: [AUTHOR, 30] },
    status: "ACTIVE",
    pinnedCategoryIds: { hasSome: [1, 12] },
  });
});

it("알림을 한 번에 만들고 푸시도 한 번에 보낸다", async () => {
  const recipients = await run();

  expect(recipients).toEqual([21, 22]);
  const message = `${QUESTION_ALERT_MESSAGE_PREFIX}: 유충이 톱밥 위로 계속 올라와요`;
  expect(mockClient.notification.createMany).toHaveBeenCalledWith({
    data: [21, 22].map((userId) => ({
      type: "NEW_POST",
      message,
      userId,
      senderId: AUTHOR,
      targetId: 143,
      targetType: "post",
    })),
  });
  expect(mockSendPush).toHaveBeenCalledTimes(1);
  expect(mockSendPush).toHaveBeenCalledWith(
    [21, 22],
    expect.objectContaining({ body: message, url: "/posts/143" })
  );
});

it("12시간 안에 질문 알림을 받은 사람은 뺀다", async () => {
  mockClient.notification.findMany.mockResolvedValue([{ userId: 21 }]);
  const recipients = await run();

  expect(mockClient.notification.findMany.mock.calls[0][0].where).toEqual({
    userId: { in: [21, 22] },
    type: "NEW_POST",
    message: { startsWith: QUESTION_ALERT_MESSAGE_PREFIX },
    createdAt: { gte: new Date(NOW.getTime() - QUESTION_ALERT_COOLDOWN_MS) },
  });
  expect(recipients).toEqual([22]);
  expect(mockSendPush).toHaveBeenCalledWith([22], expect.anything());
});

it("분야가 없는 질문(종 미선택)은 아무에게도 보내지 않는다", async () => {
  const recipients = await notifyQuestionToInterestedUsers({
    postId: 1,
    authorId: AUTHOR,
    title: "질문",
    categoryId: null,
  });
  expect(recipients).toEqual([]);
  expect(mockClient.user.findMany).not.toHaveBeenCalled();
  expect(mockSendPush).not.toHaveBeenCalled();
});

it("받을 사람이 없으면 알림·푸시를 만들지 않는다", async () => {
  mockClient.user.findMany.mockResolvedValue([]);
  expect(await run()).toEqual([]);
  expect(mockClient.notification.createMany).not.toHaveBeenCalled();
  expect(mockSendPush).not.toHaveBeenCalled();
});

it("조회가 실패해도 글 등록을 막지 않는다(빈 배열)", async () => {
  mockClient.user.findMany.mockRejectedValue(new Error("db down"));
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  expect(await run()).toEqual([]);
  spy.mockRestore();
});
