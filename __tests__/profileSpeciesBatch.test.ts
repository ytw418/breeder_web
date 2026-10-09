/**
 * @jest-environment node
 */
const mockClient = {
  post: { groupBy: jest.fn() },
  product: { groupBy: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

import { getTopSpeciesByUserIds } from "../libs/server/profileSpecies";

const at = (day: number) => new Date(Date.UTC(2026, 9, day));

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.post.groupBy.mockResolvedValue([]);
  mockClient.product.groupBy.mockResolvedValue([]);
});

describe("getTopSpeciesByUserIds (여러 사용자 주력 종 한 번에)", () => {
  it("빈 입력이면 쿼리하지 않는다", async () => {
    const result = await getTopSpeciesByUserIds([]);
    expect(result.size).toBe(0);
    expect(mockClient.post.groupBy).not.toHaveBeenCalled();
    expect(mockClient.product.groupBy).not.toHaveBeenCalled();
  });

  it("사용자별로 글 종·상품 카테고리를 합쳐 많은 순 최대 2개, 없는 사람은 빈 배열", async () => {
    mockClient.post.groupBy.mockResolvedValue([
      {
        userId: 1,
        type: "사슴벌레",
        _count: { _all: 2 },
        _max: { createdAt: at(1) },
      },
      {
        userId: 1,
        type: "베타",
        _count: { _all: 1 },
        _max: { createdAt: at(5) },
      },
      {
        userId: 2,
        type: "general",
        _count: { _all: 9 },
        _max: { createdAt: at(1) },
      },
    ]);
    mockClient.product.groupBy.mockResolvedValue([
      {
        userId: 1,
        category: "사슴벌레",
        _count: { _all: 1 },
        _max: { createdAt: at(2) },
      },
      {
        userId: 1,
        category: "구피",
        _count: { _all: 1 },
        _max: { createdAt: at(3) },
      },
    ]);

    const result = await getTopSpeciesByUserIds([1, 2, 3]);

    expect(result.get(1)).toEqual(["사슴벌레", "베타"]);
    expect(result.get(2)).toEqual([]);
    expect(result.get(3)).toEqual([]);
  });

  it("공지·숨김 글, 삭제·숨김 상품은 세지 않도록 where 를 넘긴다", async () => {
    await getTopSpeciesByUserIds([4, 5]);
    expect(mockClient.post.groupBy.mock.calls[0][0]).toMatchObject({
      by: ["userId", "type"],
      where: {
        userId: { in: [4, 5] },
        isHidden: false,
        NOT: { category: "공지" },
      },
    });
    expect(mockClient.product.groupBy.mock.calls[0][0]).toMatchObject({
      by: ["userId", "category"],
      where: { userId: { in: [4, 5] }, isDeleted: false, isHidden: false },
    });
  });
});
