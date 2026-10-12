/**
 * @jest-environment node
 */
/**
 * 등록 보상(AC-5): 등록 응답의 celebrate = { ordinal, fact }. fact 우선순위 범위 첫 글 > 오늘 첫 글 > 이번 주 종 첫 글 > 관심 고정 N명.
 */
const counts = { ordinal: 234, region: 0, today: 0, species: 0, pinned: 0 };
const mockClient = {
  user: {
    findUnique: jest.fn(async () => ({ regionSido: "서울특별시", regionSigungu: "구로구" })),
    count: jest.fn(async () => counts.pinned),
  },
  post: {
    count: jest.fn(async ({ where }: any) => {
      if (where.id.lte) return counts.ordinal;
      if (where.user) return counts.region;
      if (where.type) return counts.species;
      return counts.today;
    }),
  },
  product: { count: jest.fn(async () => 0) },
  auction: { count: jest.fn(async () => 0) },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));

import { buildCelebrate, kstDayStart } from "@libs/server/celebrate";

const base = {
  target: "post" as const,
  id: 500,
  userId: 7,
  createdAt: new Date("2026-10-14T03:00:00.000Z"),
  species: "크레스티드 게코",
  categoryId: 12,
};

beforeEach(() => {
  Object.assign(counts, { ordinal: 234, region: 0, today: 0, species: 0, pinned: 0 });
  jest.clearAllMocks();
});

describe("buildCelebrate", () => {
  it("범위 첫 글이 가장 우선, ordinal 은 공지 뺀 id 순 번호", async () => {
    expect(await buildCelebrate(base)).toEqual({ ordinal: 234, fact: "서울 첫 글" });
    const ordinalWhere = (mockClient.post.count.mock.calls as any[]).find(([a]: any) => a.where.id.lte)![0].where;
    expect(ordinalWhere).toMatchObject({ id: { lte: 500 }, OR: [{ category: null }, { category: { not: "공지" } }] });
  });

  it("범위에 앞선 글이 있으면 오늘 첫 글(KST 자정 기준)", async () => {
    counts.region = 3;
    expect((await buildCelebrate(base))?.fact).toBe("오늘 첫 글");
    const todayWhere = (mockClient.post.count.mock.calls as any[]).find(([a]: any) => a.where.createdAt && !a.where.type)![0].where;
    expect(todayWhere.createdAt.gte.toISOString()).toBe("2026-10-13T15:00:00.000Z");
  });

  it("그다음 이번 주 같은 종 첫 글, 그다음 관심 고정 인원", async () => {
    counts.region = 3;
    counts.today = 2;
    expect((await buildCelebrate(base))?.fact).toBe("이번 주 크레스티드 게코 첫 글");
    counts.species = 1;
    counts.pinned = 6;
    expect((await buildCelebrate(base))?.fact).toBe("6명이 관심 분야로 고정한 글이에요");
    expect((mockClient.user.count.mock.calls as any[])[0][0].where).toMatchObject({ pinnedCategoryIds: { has: 12 }, id: { not: 7 } });
    counts.pinned = 0;
    expect((await buildCelebrate(base))?.fact).toBeNull();
  });

  it("동네가 없으면 범위 첫 글은 건너뛴다", async () => {
    mockClient.user.findUnique.mockResolvedValueOnce({ regionSido: null, regionSigungu: null } as any);
    expect((await buildCelebrate(base))?.fact).toBe("오늘 첫 글");
  });

  it("분양글·경매도 같은 규칙(이름만 다름)", async () => {
    mockClient.product.count.mockResolvedValueOnce(12);
    expect(await buildCelebrate({ ...base, target: "product" })).toEqual({ ordinal: 12, fact: "서울 첫 분양글" });
  });

  it("DB 오류면 null(등록은 성공)", async () => {
    mockClient.user.findUnique.mockRejectedValueOnce(new Error("db"));
    jest.spyOn(console, "error").mockImplementationOnce(() => undefined);
    expect(await buildCelebrate(base)).toBeNull();
  });

  it("kstDayStart", () => {
    expect(kstDayStart(new Date("2026-10-13T14:59:00.000Z")).toISOString()).toBe("2026-10-12T15:00:00.000Z");
    expect(kstDayStart(new Date("2026-10-13T15:00:00.000Z")).toISOString()).toBe("2026-10-13T15:00:00.000Z");
  });
});
