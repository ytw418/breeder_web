/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  userBlock: { findMany: jest.fn() },
  userBadge: { findMany: jest.fn() },
  follow: { findMany: jest.fn() },
  post: { groupBy: jest.fn(), count: jest.fn() },
  product: { groupBy: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: (rows: unknown[]) => rows,
}));

import nearbyHandler from "../pages/api/users/nearby";

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader(key: string, value: string) {
      res.headers[key] = value;
    },
  };
  return res;
}

async function get(query: Record<string, string> = {}, user?: NextApiRequest["user"]) {
  const res = createRes();
  await nearbyHandler(
    { method: "GET", headers: {}, query, body: {}, user } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const me = { id: 7, name: "나" } as NextApiRequest["user"];
const NOW = new Date("2026-10-14T03:00:00.000Z"); // 수요일 12:00 KST

const row = (
  id: number,
  name: string,
  sido: string,
  sigungu: string,
  extra: Partial<{ posts: number; comments: number; updatedAt: Date; programs: unknown[] }> = {}
) => ({
  id,
  name,
  avatar: null,
  regionSido: sido,
  regionSigungu: sigungu,
  regionUpdatedAt: extra.updatedAt ?? new Date(2026, 9, 1),
  _count: { posts: extra.posts ?? 0, Comments: extra.comments ?? 0 },
  breederPrograms: extra.programs ?? [],
});

/** findMany 는 where.OR(시/도별 시/군/구 목록)를 흉내 내어 고른다. */
function seedUsers(users: ReturnType<typeof row>[]) {
  const match = (where: any) =>
    users.filter(
      (u) =>
        !where.id.notIn.includes(u.id) &&
        where.OR.some((c: any) => c.regionSido === u.regionSido && c.regionSigungu.in.includes(u.regionSigungu))
    );
  mockClient.user.findMany.mockImplementation(async ({ where }: any) => match(where));
  mockClient.user.count.mockImplementation(async ({ where }: any) => match(where).length);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  mockClient.userBlock.findMany.mockResolvedValue([]);
  mockClient.userBadge.findMany.mockResolvedValue([]);
  mockClient.follow.findMany.mockResolvedValue([]);
  mockClient.post.groupBy.mockResolvedValue([]);
  mockClient.post.count.mockResolvedValue(0);
  mockClient.product.groupBy.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());

describe("GET /api/users/nearby (50km 범위)", () => {
  it("비로그인은 401", async () => {
    const res = await get();
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("동네 미설정이면 scope none·빈 라벨", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: null, regionSigungu: null });
    const res = await get({}, me);
    expect(res.body).toEqual({
      success: true,
      scope: "none",
      regionLabel: "",
      total: 0,
      greetingCount: 0,
      items: [],
      region: null,
    });
    expect(mockClient.user.findMany).not.toHaveBeenCalled();
    expect(res.headers["Cache-Control"]).toContain("no-store");
  });

  it("보은군 사용자에게 청주시·대전 브리더가 보이고 라벨은 '보은군 근처'(AC-18)", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "충청북도", regionSigungu: "보은군" });
    seedUsers([
      row(1, "청주", "충청북도", "청주시"),
      row(2, "대전", "대전광역시", "동구"),
      row(3, "서울", "서울특별시", "종로구"),
      row(4, "보은", "충청북도", "보은군"),
    ]);
    const res = await get({ limit: "10" }, me);
    expect(res.body.scope).toBe("near");
    expect(res.body.regionLabel).toBe("보은군 근처");
    expect(res.body.total).toBe(3);
    // 같은 시/군/구 → 거리순
    expect(res.body.items.map((i: any) => i.name)).toEqual(["보은", "청주", "대전"]);
    expect(res.body.items[0]).toMatchObject({ sameRegion: true, distanceKm: 0 });
    expect(res.body.items[1].distanceKm).toBeGreaterThan(0);
    expect(res.body.items[1].distanceKm).toBeLessThanOrEqual(50);
  });

  it("구로구 사용자에겐 서울 전 구 + 광명·부천, 라벨 '서울'(AC-18). 본인·차단 관계는 뺀다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "서울특별시", regionSigungu: "구로구" });
    mockClient.userBlock.findMany.mockResolvedValue([
      { blockerId: 7, blockedId: 20 },
      { blockerId: 21, blockedId: 7 },
    ]);
    seedUsers([
      row(1, "도봉", "서울특별시", "도봉구"),
      row(2, "광명", "경기도", "광명시"),
      row(3, "부천", "경기도", "부천시"),
      row(20, "차단", "서울특별시", "구로구"),
      row(21, "차단당함", "서울특별시", "구로구"),
      row(5, "부산", "부산광역시", "중구"),
    ]);
    const res = await get({ limit: "10" }, me);
    const where = mockClient.user.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: "ACTIVE", regionVisible: true, id: { notIn: [7, 20, 21] } });
    expect(res.body.regionLabel).toBe("서울");
    expect(res.body.items.map((i: any) => i.name).sort()).toEqual(["광명", "도봉", "부천"].sort());
    // 응답 항목은 계약 필드 + 옛 필드
    expect(res.body.items[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        image: null,
        species: null,
        distanceKm: expect.any(Number),
        sameRegion: false,
        isFollowing: false,
        badges: [],
        programTypes: [],
        user: expect.objectContaining({ id: expect.any(Number) }),
        // 옛 모양 그대로(구 앱 호환)
        topSpecies: [],
        breederPrograms: [],
        postsCount: 0,
        commentsCount: 0,
      })
    );
  });

  it("정렬: 같은 동네 → 거리 → 팔로우 → 최근 활동", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "경기도", regionSigungu: "수원시" });
    seedUsers([
      row(1, "용인-옛활동", "경기도", "용인시", { updatedAt: new Date(2026, 8, 1) }),
      row(2, "용인-팔로우", "경기도", "용인시", { updatedAt: new Date(2026, 8, 1) }),
      row(3, "용인-최근", "경기도", "용인시", { updatedAt: new Date(2026, 8, 1) }),
      row(4, "수원", "경기도", "수원시"),
      row(5, "오산", "경기도", "오산시"),
    ]);
    mockClient.follow.findMany.mockResolvedValue([{ followingId: 2 }]);
    mockClient.post.groupBy.mockImplementation(async (args: any) =>
      args.by.length === 1 ? [{ userId: 3, _max: { createdAt: new Date(2026, 9, 10) } }] : []
    );
    const res = await get({ limit: "10" }, me);
    const names = res.body.items.map((i: any) => i.name);
    expect(names[0]).toBe("수원");
    const yongin = names.filter((n: string) => n.startsWith("용인"));
    expect(yongin).toEqual(["용인-팔로우", "용인-최근", "용인-옛활동"]);
    expect(res.body.items.find((i: any) => i.name === "용인-팔로우").isFollowing).toBe(true);
  });

  it("50km 안 0명이면 scope none 에 라벨은 그대로, 배치 쿼리는 부르지 않는다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "제주특별자치도", regionSigungu: "제주시" });
    seedUsers([row(1, "서울", "서울특별시", "종로구")]);
    const res = await get({}, me);
    expect(res.body).toMatchObject({ scope: "none", regionLabel: "제주시", total: 0, items: [] });
    expect(mockClient.follow.findMany).not.toHaveBeenCalled();
    expect(mockClient.product.groupBy).not.toHaveBeenCalled();
  });

  it("greetingCount: 이번 주(KST 월요일부터) 범위 안 '동네' 글", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "서울특별시", regionSigungu: "구로구" });
    seedUsers([]);
    mockClient.post.count.mockResolvedValue(3);
    const res = await get({}, me);
    expect(res.body.greetingCount).toBe(3);
    const where = mockClient.post.count.mock.calls[0][0].where;
    expect(where.category).toBe("동네");
    expect(where.isHidden).toBe(false);
    expect(where.createdAt.gte.toISOString()).toBe("2026-10-11T15:00:00.000Z");
    expect(where.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ regionSido: "경기도" })])
    );
  });

  it("limit 은 1~50 으로 자르고 잘못된 값은 기본 3, total 은 자르기 전 인원", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "서울특별시", regionSigungu: "강남구" });
    seedUsers(Array.from({ length: 60 }, (_, i) => row(i + 1, `b${i}`, "서울특별시", "강남구")));
    expect((await get({ limit: "999" }, me)).body.items).toHaveLength(50);
    const def = (await get({ limit: "abc" }, me)).body;
    expect(def.items).toHaveLength(3);
    // 본인(id 7)은 빠진다
    expect(def.total).toBe(59);
    expect((await get({ limit: "0" }, me)).body.items).toHaveLength(1);
  });

  it("주력 종(species 첫 번째, 옛 topSpecies 배열)·뱃지·프로그램 타입(옛 breederPrograms 객체)은 보이는 사람에게만", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "서울특별시", regionSigungu: "강남구" });
    seedUsers([
      row(1, "a", "서울특별시", "강남구", { programs: [{ programType: "FOUNDING_BREEDER" }] }),
      row(2, "b", "서울특별시", "서초구"),
    ]);
    mockClient.post.groupBy.mockImplementation(async (args: any) =>
      args.by.length === 1
        ? []
        : [{ userId: 1, type: "사슴벌레", _count: { _all: 3 }, _max: { createdAt: new Date(2026, 9, 1) } }]
    );
    mockClient.userBadge.findMany.mockResolvedValue([{ userId: 1, label: "주간 TOP 1" }]);
    const res = await get({ limit: "1" }, me);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: 1,
      species: "사슴벌레",
      topSpecies: ["사슴벌레"],
      badges: ["주간 TOP 1"],
      programTypes: ["FOUNDING_BREEDER"],
      breederPrograms: [{ programType: "FOUNDING_BREEDER" }],
    });
    expect(mockClient.userBadge.findMany.mock.calls[0][0].where).toEqual({ userId: { in: [1] } });
  });
});

describe("옛 앱(334ce43 홈 동네 섹션) 호환", () => {
  // 옛 앱 src/lib/neighborhoodSection.ts 의 판정·캡션을 그대로 옮긴 것.
  const oldCaption = (item: any, scope: "sigungu" | "sido") => {
    const species = (item.topSpecies ?? []).slice(0, 2);
    const base = species.length ? species.join(" · ") : `글 ${item.postsCount} · 댓글 ${item.commentsCount}`;
    return scope === "sido" ? `${item.region.sigungu} · ${base}` : base;
  };
  const oldKind = (data: any) =>
    data.scope === "none" || data.items.length === 0 ? "none" : data.scope === "sido" ? "widened" : "filled";

  it("새 응답으로도 옛 판정·캡션이 죽지 않는다(scope near → filled, none → none)", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSido: "서울특별시", regionSigungu: "강남구" });
    seedUsers([row(1, "a", "서울특별시", "강남구", { posts: 2, comments: 1 })]);
    mockClient.post.groupBy.mockImplementation(async (args: any) =>
      args.by.length === 1 ? [] : [{ userId: 1, type: "레오파드게코", _count: { _all: 2 }, _max: { createdAt: new Date(2026, 9, 1) } }]
    );
    const res = await get({ limit: "10" }, me);
    expect(oldKind(res.body)).toBe("filled");
    expect(res.body.region).toEqual({ sido: "서울특별시", sigungu: "강남구" });
    expect(oldCaption(res.body.items[0], "sigungu")).toBe("레오파드게코");
    expect(res.body.items[0].user.id).toBe(1);

    seedUsers([]);
    const empty = await get({}, me);
    expect(oldKind(empty.body)).toBe("none");
    expect(empty.body.region).toEqual({ sido: "서울특별시", sigungu: "강남구" });
  });
});
