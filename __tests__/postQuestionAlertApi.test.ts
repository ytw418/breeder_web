import type { NextApiRequest, NextApiResponse } from "next";

/** POST /api/posts — 질문 글이면 관심 분야가 같은 사람에게 질문 알림, 팔로워 알림과 겹치지 않게 한다. */

const mockClient = {
  post: { create: jest.fn() },
  user: { findUnique: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
const mockNotifyFollowers = jest.fn();
jest.mock("@libs/server/notification", () => ({
  notifyFollowers: (...args: unknown[]) => mockNotifyFollowers(...args),
}));
const mockQuestionAlert = jest.fn();
jest.mock("@libs/server/questionAlert", () => ({
  notifyQuestionToInterestedUsers: (...args: unknown[]) => mockQuestionAlert(...args),
}));
jest.mock("@libs/server/categories", () => ({
  resolveCategoryIdByName: jest.fn(async () => 12),
  resolveScopeCategoryIds: jest.fn(async () => null),
}));
jest.mock("@libs/server/growth", () => ({ incrementUserMissionProgress: jest.fn() }));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: () => [],
}));

import postsHandler from "../pages/api/posts/index";

const me = { id: 7, name: "브리더" } as NextApiRequest["user"];

async function create(body: Record<string, unknown>) {
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
    setHeader() {},
  };
  await postsHandler(
    {
      method: "POST",
      headers: {},
      query: {},
      cookies: {},
      user: me,
      body: { title: "유충이 톱밥 위로 올라와요", description: "열 글자 이상 게시글 본문", species: "사슴벌레", ...body },
    } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.post.create.mockImplementation(({ data }) => Promise.resolve({ id: 143, ...data }));
  mockClient.user.findUnique.mockResolvedValue({ name: "곤충초보" });
  mockQuestionAlert.mockResolvedValue([21, 22]);
});

it("질문 글이면 분야가 같은 사람에게 질문 알림을 보내고, 받은 사람은 팔로워 알림에서 뺀다", async () => {
  const res = await create({ category: "질문" });

  expect(res.statusCode).toBe(200);
  expect(mockQuestionAlert).toHaveBeenCalledWith({
    postId: 143,
    authorId: 7,
    title: "유충이 톱밥 위로 올라와요",
    categoryId: 12,
  });
  expect(mockNotifyFollowers).toHaveBeenCalledWith(
    expect.objectContaining({ type: "NEW_POST", targetId: 143, excludeUserIds: [21, 22] })
  );
});

it("질문이 아닌 글은 질문 알림을 보내지 않는다", async () => {
  await create({ category: "자유" });

  expect(mockQuestionAlert).not.toHaveBeenCalled();
  expect(mockNotifyFollowers).toHaveBeenCalledWith(
    expect.objectContaining({ excludeUserIds: [] })
  );
});
