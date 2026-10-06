/**
 * @jest-environment node
 */

/**
 * HOT 토론(getHotDiscussions) 기간 제한.
 * - 최근 7일 글에서 먼저 고르고, 3개 미만이면 30일 → 전체 기간 글로 남은 자리를 채운다.
 * - 역대 댓글 상위 글이 최근 토론을 밀어내지 않는다.
 * - 응답 형태(HotDiscussionItem[])는 그대로 둔다.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-05T12:00:00.000Z");

type FakePost = {
  id: number;
  title: string;
  description: string;
  image: string;
  category: string;
  createdAt: Date;
  userStatus: string;
  comments: number;
  likes: number;
};

let posts: FakePost[] = [];

const makePost = (
  id: number,
  daysAgo: number,
  comments: number,
  likes = 0,
  overrides: Partial<FakePost> = {}
): FakePost => ({
  id,
  title: `글 ${id}`,
  description: `본문 ${id}`,
  image: "",
  category: "자유",
  createdAt: new Date(NOW.getTime() - daysAgo * DAY),
  userStatus: "ACTIVE",
  comments,
  likes,
  ...overrides,
});

type FindManyArgs = {
  where: {
    category?: { in: string[] };
    user?: { status: string };
    createdAt?: { gte: Date };
  };
  orderBy: unknown;
  take?: number;
};

// prisma 의 where/orderBy/take 를 흉내 내는 가짜 post.findMany
const mockClient = {
  post: {
    findMany: jest.fn(async ({ where, take }: FindManyArgs) => {
      const rows = posts
        .filter((p) => !where.category || where.category.in.includes(p.category))
        .filter((p) => !where.user || p.userStatus === where.user.status)
        .filter((p) => !where.createdAt || p.createdAt.getTime() >= where.createdAt.gte.getTime())
        .sort(
          (a, b) => b.comments - a.comments || b.createdAt.getTime() - a.createdAt.getTime()
        )
        .slice(0, take ?? undefined);
      return rows.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        image: p.image,
        category: p.category,
        createdAt: p.createdAt,
        _count: { comments: p.comments, Likes: p.likes },
        user: { id: 1, name: "작성자", avatar: null },
      }));
    }),
  },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/growth", () => ({
  ensureAlertSubscription: jest.fn(),
  ensureCurrentWeeklySeason: jest.fn(),
}));

import { getHotDiscussions } from "@libs/server/ranking";

const ids = (items: Array<{ id: number }>) => items.map((item) => item.id);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW });
  posts = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe("getHotDiscussions 기간 제한", () => {
  it("최근 7일 글이 3개 이상이면 역대 인기글 없이 7일 안에서만 고른다", async () => {
    posts = [
      makePost(1, 90, 100, 50), // 역대 인기글
      makePost(2, 1, 1),
      makePost(3, 2, 3),
      makePost(4, 6, 2, 1),
      makePost(5, 8, 10), // 7일 밖
    ];

    const result = await getHotDiscussions({ limit: 5 });

    // 점수 = 댓글 x2 + 좋아요
    expect(ids(result)).toEqual([3, 4, 2]);
    expect(mockClient.post.findMany).toHaveBeenCalledTimes(1);
    const where = mockClient.post.findMany.mock.calls[0][0].where;
    expect(where.createdAt?.gte.getTime()).toBe(NOW.getTime() - 7 * DAY);
    expect(where.category).toEqual({ in: ["질문", "자유", "정보"] });
    expect(where.user).toEqual({ status: "ACTIVE" });
  });

  it("7일 안에 3개 미만이면 30일 글로 남은 자리를 채운다(최근 글이 먼저)", async () => {
    posts = [
      makePost(1, 90, 100), // 전체 기간
      makePost(2, 3, 1),
      makePost(3, 20, 9),
      makePost(4, 25, 5),
      makePost(5, 29, 7),
    ];

    const result = await getHotDiscussions({ limit: 5 });

    expect(ids(result)).toEqual([2, 3, 5, 4]);
    expect(mockClient.post.findMany).toHaveBeenCalledTimes(2);
    expect(mockClient.post.findMany.mock.calls[1][0].where.createdAt?.gte.getTime()).toBe(
      NOW.getTime() - 30 * DAY
    );
  });

  it("30일 안에도 3개 미만이면 전체 기간 글로 채운다", async () => {
    posts = [makePost(1, 90, 100), makePost(2, 2, 1), makePost(3, 200, 4)];

    const result = await getHotDiscussions({ limit: 5 });

    expect(ids(result)).toEqual([2, 1, 3]);
    expect(mockClient.post.findMany).toHaveBeenCalledTimes(3);
    expect(mockClient.post.findMany.mock.calls[2][0].where).not.toHaveProperty("createdAt");
  });

  it("limit 개수를 넘기지 않는다", async () => {
    posts = [
      makePost(1, 1, 1),
      makePost(2, 20, 2),
      makePost(3, 21, 3),
      makePost(4, 22, 4),
      makePost(5, 23, 5),
      makePost(6, 24, 6),
    ];

    const result = await getHotDiscussions({ limit: 3 });

    expect(ids(result)).toEqual([1, 6, 5]);
  });

  it("댓글·좋아요가 없는 글은 넣지 않고, 공지 등 다른 카테고리도 넣지 않는다", async () => {
    posts = [
      makePost(1, 1, 0, 0),
      makePost(2, 1, 0, 2),
      makePost(3, 1, 5, 0, { category: "공지" }),
    ];

    const result = await getHotDiscussions({ limit: 5 });

    expect(ids(result)).toEqual([2]);
  });

  it("응답 형태는 그대로다", async () => {
    posts = [makePost(1, 1, 2, 3, { image: "img", title: "제목" })];

    const [item] = await getHotDiscussions({ limit: 5 });

    expect(item).toEqual({
      id: 1,
      title: "제목",
      description: "본문 1",
      image: "img",
      category: "자유",
      createdAt: new Date(NOW.getTime() - DAY).toISOString(),
      commentsCount: 2,
      wonderCount: 3,
      user: { id: 1, name: "작성자", avatar: null },
    });
  });
});
