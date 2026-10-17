/**
 * @jest-environment node
 */
/**
 * 질문 첫 답변 점수(AC-7): 질문 글의 첫 보이는 댓글은 댓글 점수 8, 운영 계정(FAKE_USER) 댓글은 첫 답변이 되지 않는다.
 */
type FakeComment = {
  id: number;
  postId: number;
  userId: number;
  role: "USER" | "FAKE_USER";
  postAuthorId: number;
  postCategory: string;
  createdAt: Date;
  isHidden?: boolean;
  deletedAt?: Date | null;
  parentId?: number | null;
};

let comments: FakeComment[] = [];

const matches = (c: FakeComment, where: any) => {
  if (where.isHidden === false && c.isHidden) return false;
  if (where.deletedAt === null && c.deletedAt) return false;
  if (where.parentId === null && c.parentId) return false;
  if (where.post?.category && c.postCategory !== where.post.category) return false;
  if (where.user?.role?.not && c.role === where.user.role.not) return false;
  if (where.user?.role?.notIn?.includes(c.role)) return false; // RANKABLE_USER_WHERE(운영 계정 제외)
  if (where.postId?.in && !where.postId.in.includes(c.postId)) return false;
  const t = c.createdAt.getTime();
  if (where.createdAt?.gte && t < where.createdAt.gte.getTime()) return false;
  if (where.createdAt?.lte && t > where.createdAt.lte.getTime()) return false;
  if (where.createdAt?.lt && t >= where.createdAt.lt.getTime()) return false;
  return true;
};

const mockClient = {
  comment: {
    findMany: jest.fn(async ({ where }: any) =>
      comments
        .filter((c) => matches(c, where))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
        .map((c) => ({ id: c.id, postId: c.postId, userId: c.userId, createdAt: c.createdAt, post: { userId: c.postAuthorId } }))
    ),
  },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/growth", () => ({
  ensureAlertSubscription: jest.fn(),
  ensureCurrentWeeklySeason: jest.fn(),
}));

import { countFirstAnswers, scoreBreeder } from "@libs/server/ranking";
import { BREEDER_SCORE_WEIGHTS, FIRST_ANSWER_COMMENT_SCORE } from "@libs/shared/ranking";

const day = (d: number) => new Date(Date.UTC(2026, 9, d, 3));
const c = (id: number, postId: number, userId: number, d: number, extra: Partial<FakeComment> = {}): FakeComment => ({
  id,
  postId,
  userId,
  role: "USER",
  postAuthorId: 100,
  postCategory: "질문",
  createdAt: day(d),
  ...extra,
});
const asMap = (rows: { key: number; count: number }[]) => Object.fromEntries(rows.map((r) => [r.key, r.count]));

beforeEach(() => {
  comments = [];
  jest.clearAllMocks();
});

describe("scoreBreeder 첫 답변", () => {
  it("첫 답변 1개 + 일반 댓글 1개 = 8 + 4", () => {
    expect(FIRST_ANSWER_COMMENT_SCORE).toBe(8);
    expect(
      scoreBreeder({ postsCount: 0, commentsCount: 2, bidsCount: 0, auctionWinsCount: 0, sellerEndedAuctionsCount: 0, firstAnswersCount: 1 })
    ).toBe(FIRST_ANSWER_COMMENT_SCORE + BREEDER_SCORE_WEIGHTS.comment);
  });

  it("첫 답변 수를 안 주면 예전과 같다", () => {
    expect(scoreBreeder({ postsCount: 1, commentsCount: 2, bidsCount: 0, auctionWinsCount: 0, sellerEndedAuctionsCount: 0 })).toBe(18);
  });
});

describe("countFirstAnswers", () => {
  it("질문 글의 가장 이른 보이는 루트 댓글 작성자만 센다", async () => {
    comments = [
      c(1, 10, 1, 5),
      c(2, 10, 2, 6), // 두 번째 댓글
      c(3, 11, 2, 5),
      c(4, 12, 3, 5, { postCategory: "자유" }), // 질문 아님
    ];
    expect(asMap(await countFirstAnswers(null))).toEqual({ 1: 1, 2: 1 });
  });

  it("운영 계정(FAKE_USER)·글쓴이 본인·숨김·삭제·대댓글은 첫 답변이 아니고, 다음 사람이 첫 답변이 된다", async () => {
    comments = [
      c(1, 10, 50, 5, { role: "FAKE_USER" }),
      c(2, 10, 100, 5), // 글쓴이 본인
      c(3, 10, 4, 5, { isHidden: true }),
      c(4, 10, 5, 5, { deletedAt: day(6) }),
      c(5, 10, 6, 5, { parentId: 1 }),
      c(6, 10, 7, 6),
    ];
    expect(asMap(await countFirstAnswers(null))).toEqual({ 7: 1 });
  });

  it("기간: 기간 전에 이미 첫 답변이 달린 글은 세지 않는다", async () => {
    comments = [
      c(1, 10, 1, 1), // 지난주 첫 답변
      c(2, 10, 2, 8),
      c(3, 11, 3, 9), // 이번 주 첫 답변
      c(4, 12, 50, 1, { role: "FAKE_USER" }), // 지난주 운영 계정 댓글은 무시
      c(5, 12, 4, 9),
    ];
    const window = { startAt: day(7), endAt: day(13) };
    expect(asMap(await countFirstAnswers(window))).toEqual({ 3: 1, 4: 1 });
  });
});
