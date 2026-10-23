/** 재방문 알림 크론 ②·④: 토론 마감 임박·답 없는 질문. */
const mockClient = {
  debate: { findMany: jest.fn() },
  debateVote: { findMany: jest.fn() },
  userBlock: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  post: { findMany: jest.fn(), groupBy: jest.fn() },
  comment: { groupBy: jest.fn() },
  notification: { findMany: jest.fn(), createMany: jest.fn() },
};
const mockPush = jest.fn();
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/pushGateway", () => ({ sendAllPushToUsers: (...args: unknown[]) => mockPush(...args) }));
jest.mock("@libs/server/notificationGate", () => ({ filterPushRecipients: async (ids: number[]) => ids }));
jest.mock("@libs/server/categories", () => ({
  getAllCategories: async () => [
    { id: 1, name: "파충류", path: "/reptile/" },
    { id: 2, name: "레오파드 게코", path: "/reptile/leopard-gecko/" },
  ],
  resolveScopeCategoryIds: jest.fn(),
}));

import { runDebateClosingAlerts, runQuestionHelpAlerts } from "@libs/server/reengagement";

const NOW = new Date("2026-10-23T10:00:00.000Z"); // KST 19시

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.userBlock.findMany.mockResolvedValue([]);
  mockClient.notification.findMany.mockResolvedValue([]);
});

describe("토론 마감 임박", () => {
  const debate = (postId: number) => ({
    postId,
    optionA: "된다",
    optionB: "안 된다",
    endsAt: new Date(NOW.getTime() + 60 * 60_000),
    post: { title: "합사 해도 될까요?", userId: 9, categoryId: 2 },
  });

  it("표 3개 이상인 토론만, 투표한 사람·작성자는 빼고 관심 분야가 맞거나 고정이 없는 회원에게 보낸다", async () => {
    mockClient.debate.findMany.mockResolvedValue([debate(100), debate(101)]);
    mockClient.debateVote.findMany
      .mockResolvedValueOnce([
        { userId: 1, side: "A" },
        { userId: 2, side: "A" },
        { userId: 3, side: "B" },
      ])
      .mockResolvedValueOnce([{ userId: 1, side: "A" }]);
    mockClient.user.findMany.mockResolvedValue([{ id: 50 }]);

    await expect(runDebateClosingAlerts(NOW)).resolves.toEqual({ debates: 1, sent: 1 });

    const where = mockClient.user.findMany.mock.calls[0][0].where;
    expect(where.id.notIn).toEqual([9, 1, 2, 3]);
    expect(where.OR).toEqual([{ pinnedCategoryIds: { isEmpty: true } }, { pinnedCategoryIds: { hasSome: [1, 2] } }]);
    expect(mockPush).toHaveBeenCalledWith([50], {
      title: "실시간 HOT 토론이 1시간 뒤 마감돼요!",
      body: "합사 해도 될까요? · 지금 된다 67% : 안 된다 33%",
      url: "/posts/100",
      tag: "debate-closing-100",
    });
  });

  it("이미 알린 토론은 다시 보내지 않고, 밤에는 돌지 않는다", async () => {
    mockClient.debate.findMany.mockResolvedValue([debate(100)]);
    mockClient.notification.findMany.mockResolvedValueOnce([{ targetId: 100 }]);
    await expect(runDebateClosingAlerts(NOW)).resolves.toEqual({ debates: 0, sent: 0 });
    await expect(runDebateClosingAlerts(new Date("2026-10-23T13:00:00.000Z"))).resolves.toEqual({ debates: 0, sent: 0 });
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("답 없는 질문", () => {
  it("남이 단 댓글이 없는 질문만, 그 종 글을 써 본 회원에게 보낸다", async () => {
    mockClient.post.findMany.mockResolvedValue([
      { id: 200, title: "탈피가 안 돼요", userId: 7, categoryId: 2 },
      { id: 201, title: "먹이 추천", userId: 8, categoryId: 2 },
    ]);
    mockClient.comment.groupBy.mockResolvedValue([
      { postId: 200, userId: 7 },
      { postId: 201, userId: 60 },
    ]);
    mockClient.post.groupBy.mockResolvedValue([{ userId: 61 }, { userId: 62 }]);

    await expect(runQuestionHelpAlerts(NOW)).resolves.toEqual({ questions: 1, sent: 2 });

    expect(mockClient.post.groupBy.mock.calls[0][0].where.categoryId).toEqual({ in: [2] });
    expect(mockPush).toHaveBeenCalledWith([61, 62], {
      title: "레오파드 게코 질문에 아직 답이 없어요",
      body: "탈피가 안 돼요 · 키워 본 경험을 나눠 주세요",
      url: "/posts/200",
      tag: "question-help-200",
    });
  });
});
