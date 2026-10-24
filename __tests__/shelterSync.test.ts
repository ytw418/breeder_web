/**
 * 보호소 아이들 동기화(앱 docs/prd/shelter-animals.md AC-1·AC-2·AC-3·AC-13). DB 와 fetch 는 모두 모의다.
 * 리뷰 보강: 새 글 createdAt=공고 시작일(H1), 실패 시 ok:false(M1), 종별 가드(M2), 숨긴 글 되살리기, 표시 태그만 떼기.
 */
import { runShelterSync, SHELTER_MISSED_TAG, type ShelterDb } from "@libs/server/shelterSync";
import { SHELTER_SOURCE, type ShelterApiItem } from "@libs/shared/shelterAnimal";

type Row = Record<string, any>;

/** 이 테스트가 쓰는 질의만 흉내 내는 메모리 DB. */
function createDb(seed: Row[] = []) {
  const rows: Row[] = seed.map((r) => ({ tags: [], isHidden: false, isDeleted: false, photos: [], externalSource: null, externalId: null, ...r }));
  let nextId = 1000;
  const matches = (row: Row, where: Row) =>
    Object.keys(where).every((key) => {
      const cond = where[key];
      return cond && typeof cond === "object" && "in" in cond ? cond.in.includes(row[key]) : row[key] === cond;
    });
  const apply = (row: Row, data: Row) => {
    Object.keys(data).forEach((key) => {
      const value = data[key];
      if (key === "tags" && value && !Array.isArray(value)) row.tags = "set" in value ? [...value.set] : [...row.tags, value.push];
      else row[key] = value;
    });
  };
  const product = {
    findMany: jest.fn(async ({ where }: Row) => rows.filter((r) => matches(r, where)).map((r) => ({ ...r }))),
    create: jest.fn(async ({ data }: Row) => {
      const row = { id: nextId++, tags: [], isHidden: false, isDeleted: false, ...data };
      rows.push(row);
      return { ...row };
    }),
    update: jest.fn(async ({ where, data }: Row) => {
      const row = rows.find((r) => r.id === where.id)!;
      apply(row, data);
      return { ...row };
    }),
    updateMany: jest.fn(async ({ where, data }: Row) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => apply(r, data));
      return { count: hit.length };
    }),
  };
  return { db: { product } as unknown as ShelterDb, rows, product };
}

const item = (n: number, over: Partial<ShelterApiItem> = {}): ShelterApiItem => ({
  desertionNo: `D${n}`,
  noticeNo: `경기-화성-2026-${n}`,
  noticeSdt: `202610${String(10 + n).padStart(2, "0")}`,
  noticeEdt: "20261030",
  popfile1: `http://www.animal.go.kr/files/${n}.jpg`,
  kindNm: "[개] 믹스견",
  age: "2024(년생)",
  sexCd: "M",
  specialMark: "순함",
  careNm: "화성시 동물보호센터",
  careTel: "031-123-4567",
  orgNm: "경기도 화성시",
  ...over,
});

/** upkind·pageNo·numOfRows 를 보고 해당 종 목록을 돌려주는 공공 API 모의. */
function apiFetch(dogs: ShelterApiItem[], cats: ShelterApiItem[] = []) {
  return jest.fn(async (url: string) => {
    const q = new URL(url).searchParams;
    const list = q.get("upkind") === "417000" ? dogs : cats;
    const size = Number(q.get("numOfRows"));
    const slice = list.slice((Number(q.get("pageNo")) - 1) * size, Number(q.get("pageNo")) * size);
    return {
      ok: true,
      status: 200,
      json: async () => ({ response: { header: { resultCode: "00" }, body: { items: slice.length ? { item: slice } : "", totalCount: list.length } } }),
    };
  }) as unknown as typeof fetch & jest.Mock;
}

const run = (db: ShelterDb, fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) =>
  runShelterSync({ db, fetchImpl, apiKey: "test-key", userId: 87, ...extra });

describe("runShelterSync", () => {
  it("AC-1·AC-13: 회차당 maxNew 건만 넣고 다음 회차에 이어 넣으며, 같은 목록을 다시 돌리면 새 글이 0건이다", async () => {
    const { db, rows } = createDb();
    const cats = [item(4, { kindNm: "[고양이] 코리안 숏헤어" }), item(5, { kindNm: "[고양이] 기타" })];
    const fetchImpl = apiFetch([item(1), item(2), item(3)], cats);
    const resolveCategoryId = async (name: string) => (name === "강아지" ? 11 : 12);

    expect(await run(db, fetchImpl, { maxNew: 3, resolveCategoryId })).toMatchObject({ ok: true, fetched: 5, created: 3, remaining: 2 });
    expect(await run(db, fetchImpl, { resolveCategoryId })).toMatchObject({ created: 2, remaining: 0 });
    const calls = fetchImpl.mock.calls.length;
    expect(await run(db, fetchImpl, { resolveCategoryId })).toMatchObject({ created: 0, updated: 0, hidden: 0 });

    expect(fetchImpl.mock.calls.length - calls).toBeLessThanOrEqual(10);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.externalSource === SHELTER_SOURCE && r.userId === 87 && r.dealType === "rehoming")).toBe(true);
    expect(rows.find((r) => r.externalId === "D1")).toMatchObject({ categoryId: 11, photos: ["https://www.animal.go.kr/files/1.jpg"] });
    expect(rows.find((r) => r.externalId === "D4")).toMatchObject({ category: "고양이", categoryId: 12 });
    // H1: 새 글의 createdAt 은 공고 시작일 0시(KST)라 최근 공고가 목록(createdAt desc) 앞에 온다.
    expect(rows.find((r) => r.externalId === "D1")!.createdAt).toEqual(new Date("2026-10-11T00:00:00+09:00"));
    expect(rows.find((r) => r.externalId === "D3")!.createdAt.getTime()).toBeGreaterThan(rows.find((r) => r.externalId === "D1")!.createdAt.getTime());
  });

  it("AC-2: 연속 두 번 성공한 회차에서 빠진 공고만 숨기고, 중간에 다시 나타나면 세지 않는다. 숨긴 글은 다시 나타나면 되살린다", async () => {
    const { db, rows } = createDb();
    const all = [item(1), item(2), item(3), item(4), item(5)];
    await run(db, apiFetch(all));
    const row = (id: string) => rows.find((r) => r.externalId === id)!;

    expect(await run(db, apiFetch(all.slice(1)))).toMatchObject({ marked: 1, hidden: 0 });
    expect(row("D1")).toMatchObject({ isHidden: false, tags: [SHELTER_MISSED_TAG] });

    // 표시만 떼고 다른 태그는 남긴다.
    row("D1").tags.push("keep");
    expect(await run(db, apiFetch(all))).toMatchObject({ recovered: 1, hidden: 0 });
    expect(row("D1").tags).toEqual(["keep"]);

    await run(db, apiFetch(all.slice(1)));
    expect(await run(db, apiFetch(all.slice(1)))).toMatchObject({ hidden: 1 });
    expect(rows.filter((r) => r.isHidden).map((r) => r.externalId)).toEqual(["D1"]);

    // 동기화가 숨긴 글(숨김 + 표시)은 온전한 회차에 다시 나타나면 되살리고, 표시 없이 숨긴 글(운영 제재)은 그대로 둔다.
    row("D2").isHidden = true;
    expect(await run(db, apiFetch(all))).toMatchObject({ resurrected: 1 });
    expect(row("D1")).toMatchObject({ isHidden: false, tags: ["keep"] });
    expect(row("D2").isHidden).toBe(true);
  });

  it("AC-3: 받기 실패(E-1)나 총수 30% 넘는 감소(E-2)면 아무것도 숨기거나 표시하지 않는다", async () => {
    const { db, rows } = createDb();
    const all = Array.from({ length: 10 }, (_v, i) => item(i + 1));
    await run(db, apiFetch(all));
    const before = JSON.stringify(rows);

    const failing = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await run(db, failing)).toMatchObject({ ok: false, created: 0, hidden: 0 });
    expect(JSON.stringify(rows)).toBe(before);

    expect(await run(db, apiFetch(all.slice(0, 5)))).toMatchObject({ ok: true, hidden: 0, marked: 0, skippedHideReason: "api-total-dropped" });
    expect(JSON.stringify(rows)).toBe(before);

    // 30% 이내로 줄면(10 → 8) 정상 처리한다.
    expect(await run(db, apiFetch(all.slice(0, 8)))).toMatchObject({ marked: 2 });
  });

  it("M1: 저장에 실패하거나 시간 한도로 새 글을 하나도 못 넣으면 ok:false 로 알린다", async () => {
    const { db, product } = createDb();
    const fetchImpl = apiFetch([item(1), item(2)]);

    expect(await run(db, fetchImpl, { timeBudgetMs: -1 })).toMatchObject({ ok: false, created: 0, remaining: 2 });

    // 가장 최근 공고(D2)부터 넣다 실패해도 나머지는 넣고, 실패가 있으니 ok:false.
    product.create.mockRejectedValueOnce(new Error("db down"));
    expect(await run(db, fetchImpl)).toMatchObject({ ok: false, failed: 1, created: 1 });
    expect(await run(db, fetchImpl)).toMatchObject({ ok: true, created: 1 });
  });

  it("M2: 종 하나의 총수가 0이거나 그 종의 보이는 글 70% 미만이면 그 종만 표시·숨김을 건너뛴다", async () => {
    const { db, rows } = createDb();
    const dogs = Array.from({ length: 10 }, (_v, i) => item(i + 1));
    const cats = Array.from({ length: 4 }, (_v, i) => item(i + 11, { kindNm: "[고양이] 코리안 숏헤어" }));
    await run(db, apiFetch(dogs, cats));

    // 고양이 응답이 비었다(총수 0): 개 10건은 정상이라 전체 가드는 통과하지만 고양이는 건드리지 않는다.
    expect(await run(db, apiFetch(dogs, []))).toMatchObject({ marked: 0, hidden: 0, skippedSpecies: ["고양이"] });
    // 고양이 4건 중 1건만 왔다(25%): 고양이는 건너뛰고, 개는 빠진 1건(D1)만 표시한다.
    expect(await run(db, apiFetch(dogs.slice(1), cats.slice(0, 1)))).toMatchObject({ marked: 1, skippedSpecies: ["고양이"] });
    expect(rows.filter((r) => r.tags.length).map((r) => r.externalId)).toEqual(["D1"]);
  });

  it("손으로 올린 옛 글(externalId 없음)은 출처 줄의 공고번호로 이어받고 새로 만들지 않는다", async () => {
    const legacy = {
      id: 5,
      userId: 87,
      dealType: "rehoming",
      description: "본문\n출처: 국가동물보호정보시스템 공고 경기-화성-2026-1\n보호 기간이 지나면...",
      name: "옛 제목",
    };
    const other = { id: 6, userId: 99, dealType: "rehoming", description: "출처: 국가동물보호정보시스템 공고 경기-화성-2026-2", name: "회원 글" };
    // 지웠거나 숨긴 옛 글은 이어받지 않는다.
    const deleted = { id: 7, userId: 87, dealType: "rehoming", isDeleted: true, description: "출처: 국가동물보호정보시스템 공고 경기-화성-2026-3", name: "지운 글" };
    const { db, rows } = createDb([legacy, other, deleted]);

    expect(await run(db, apiFetch([item(1), item(2), item(3)]))).toMatchObject({ adopted: 1, created: 2 });
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.id === 7)!.externalId).toBeNull();
    expect(rows.find((r) => r.id === 5)).toMatchObject({ externalSource: SHELTER_SOURCE, externalId: "D1" });
    expect(rows.find((r) => r.id === 5)!.name).not.toBe("옛 제목");
    expect(rows.find((r) => r.id === 6)!.externalId).toBeNull();
  });
});
