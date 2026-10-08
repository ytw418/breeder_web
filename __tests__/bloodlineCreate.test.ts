/**
 * @jest-environment node
 */

/**
 * 혈통 만들기·내 목록 — pages/api/bloodline-cards/index.ts (설계 §3.1, PRD AC-77~83)
 * - POST: 이름(띄어쓰기 허용, 정규화 키 중복 검사는 트랜잭션 안) → 종(노출 카테고리 이름) → 사진 → 산지 순으로 검사한다.
 *   소개는 선택, 기본 이름 폴백 없음, visualStyle·transferPolicy 는 받기만 하고 저장하지 않는다. 만들면 bloodline_created 1회.
 * - GET: currentOwnerId 기준 분류. myBloodlines = 지금 보유한 혈통, receivedLines = 남이 만든 출처 카드. ?mode=attach 는 attachable[].
 * 목록(GET) 테스트도 같은 라우트 파일이라 이 파일에 둔다(PRD AC-83 의 bloodlineList 케이스).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { bloodlineNameKey } from "@libs/shared/bloodline-names";

/* ------------------------------------------------------------------ */
/* 메모리 가짜 DB: where(동등·in·not·OR·AND)·orderBy·take·include 만 해석한다 */
/* ------------------------------------------------------------------ */
type Row = Record<string, any>;
const db = {
  users: [] as Row[],
  cards: [] as Row[],
  transfers: [] as Row[],
  events: [] as Row[],
  owners: [] as Row[],
  products: [] as Row[],
};
let nextId = 100;
const NOW = new Date("2026-10-08T09:00:00.000Z");

const matches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((w) => matches(row, w));
    if (key === "AND") return (cond as Row[]).every((w) => matches(row, w));
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond && !cond.in.includes(row[key])) return false;
      if ("not" in cond && row[key] === cond.not) return false;
      return true;
    }
    return row[key] === cond;
  });
const comparable = (value: unknown) => (value instanceof Date ? value.getTime() : (value as number));
const sortRows = (rows: Row[], orderBy?: Row | Row[]) => {
  const orders = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const [key, dir] = Object.entries(order)[0];
      const av = comparable(a[key]);
      const bv = comparable(b[key]);
      if (av !== bv) return (av < bv ? -1 : 1) * (dir === "desc" ? -1 : 1);
    }
    return 0;
  });
};
const userRef = (id: number | null | undefined) => {
  const found = db.users.find((user) => user.id === id);
  return found ? { id: found.id, name: found.name } : null;
};
const withCardRelations = (card: Row, args: Row = {}) => {
  const rel = { ...(args.select ?? {}), ...(args.include ?? {}) };
  const out: Row = { ...card };
  if (rel.creator) out.creator = userRef(card.creatorId);
  if (rel.currentOwner) out.currentOwner = userRef(card.currentOwnerId);
  if (rel.transfers) {
    out.transfers = sortRows(
      db.transfers.filter((t) => t.cardId === card.id),
      [{ createdAt: "desc" }]
    )
      .slice(0, rel.transfers.take ?? undefined)
      .map((t) => ({ ...t, fromUser: userRef(t.fromUserId), toUser: userRef(t.toUserId) }));
  }
  return out;
};
const findCards = (args: Row = {}) => {
  const rows = sortRows(
    db.cards.filter((card) => matches(card, args.where)),
    args.orderBy
  ).slice(0, args.take ?? undefined);
  return rows.map((card) => withCardRelations(card, args));
};

const mockClient: Row = {
  $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mockClient)),
  $executeRaw: jest.fn(),
  // 정규화 키 중복 검사(SELECT ... lower(regexp_replace(name,'\s','','g')) = key). 첫 값이 키다.
  // 상태 조건은 SQL 에 적힌 대로 해석한다(status = 'ACTIVE' / status IN ('ACTIVE', 'INACTIVE')).
  $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join("?");
    const statuses = ["ACTIVE", "INACTIVE", "REVOKED"].filter((status) => sql.includes(`'${status}'`));
    return db.cards
      .filter(
        (card) =>
          card.cardType === "BLOODLINE" &&
          statuses.includes(card.status) &&
          bloodlineNameKey(card.name) === values[0]
      )
      .map((card) => ({ id: card.id }));
  }),
  bloodlineCard: {
    findMany: jest.fn(async (args: Row) => findCards(args)),
    findFirst: jest.fn(async (args: Row) => findCards(args)[0] ?? null),
    findUnique: jest.fn(async (args: Row) => findCards(args)[0] ?? null),
    create: jest.fn(async (args: Row) => {
      const row = {
        id: nextId++,
        cardType: "BLOODLINE",
        speciesType: null,
        bloodlineReferenceId: null,
        parentCardId: null,
        status: "ACTIVE",
        transferPolicy: "NONE",
        issueCount: 0,
        transferCount: 0,
        visualStyle: "noir",
        description: null,
        image: null,
        originSido: null,
        originSigungu: null,
        ownerNameVisible: false,
        createdAt: NOW,
        updatedAt: NOW,
        ...args.data,
      };
      db.cards.push(row);
      return withCardRelations(row, args);
    }),
  },
  bloodlineCardTransfer: {
    create: jest.fn(async (args: Row) => {
      const row = { id: nextId++, createdAt: NOW, ...args.data };
      db.transfers.push(row);
      return row;
    }),
  },
  bloodlineCardEvent: {
    create: jest.fn(async (args: Row) => {
      const row = { id: nextId++, createdAt: NOW, ...args.data };
      db.events.push(row);
      return row;
    }),
    findMany: jest.fn(async (args: Row) => db.events.filter((event) => matches(event, args.where))),
  },
  bloodlineCardOwner: {
    createMany: jest.fn(async (args: Row) => {
      db.owners.push(...args.data);
      return { count: args.data.length };
    }),
  },
  product: {
    groupBy: jest.fn(async () => []),
  },
};

jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
const mockCaptureServerEvent = jest.fn(async () => undefined);
jest.mock("@libs/server/analytics", () => ({
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...(args as [])),
}));
// 노출 카테고리(#173 트리). 포유류 아래 강아지·고양이, 하위가 없는 기타.
const mockVisibleCategories = jest.fn();
jest.mock("@libs/server/categories", () => ({
  getVisibleCategories: () => mockVisibleCategories(),
}));

import handler from "../pages/api/bloodline-cards/index";

function createRes() {
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
  return res;
}

async function call(req: Partial<NextApiRequest>) {
  const res = createRes();
  await (handler as (req: NextApiRequest, res: NextApiResponse) => unknown)(
    { headers: {}, query: {}, body: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const ME = 7;
const me = { id: ME, name: "브리더" } as NextApiRequest["user"];
const create = (body: Record<string, unknown>) => call({ method: "POST", user: me, body });
const list = (query: Record<string, string> = {}) => call({ method: "GET", user: me, query });

const validBody = {
  name: "강산 라인",
  speciesType: "사슴벌레",
  image: "cf-image-1",
};

const card = (overrides: Row): Row => ({
  cardType: "BLOODLINE",
  speciesType: "사슴벌레",
  bloodlineReferenceId: null,
  parentCardId: null,
  status: "ACTIVE",
  transferPolicy: "NONE",
  issueCount: 0,
  transferCount: 0,
  visualStyle: "noir",
  description: null,
  image: "cf",
  originSido: null,
  originSigungu: null,
  ownerNameVisible: false,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  nextId = 100;
  db.users = [
    { id: 1, name: "강산" },
    { id: 3, name: "백두" },
    { id: 5, name: "도윤파파" },
    { id: ME, name: "브리더" },
    { id: 8, name: "한라" },
  ];
  db.cards = [];
  db.transfers = [];
  db.events = [];
  db.owners = [];
  db.products = [];
  mockVisibleCategories.mockResolvedValue([
    { id: 1, name: "곤충", slug: "insect", parentId: null, path: "/insect/", sortOrder: 1 },
    { id: 2, name: "사슴벌레", slug: "stag", parentId: 1, path: "/insect/stag/", sortOrder: 1 },
    { id: 5, name: "포유류", slug: "mammal", parentId: null, path: "/mammal/", sortOrder: 5 },
    { id: 6, name: "강아지", slug: "dog", parentId: 5, path: "/mammal/dog/", sortOrder: 1 },
    { id: 7, name: "고양이", slug: "cat", parentId: 5, path: "/mammal/cat/", sortOrder: 2 },
    { id: 9, name: "기타", slug: "etc", parentId: null, path: "/etc/", sortOrder: 9 },
  ]);
});

const expectRejected = (res: ReturnType<typeof createRes>, status: number, errorCode: string) => {
  expect(res.statusCode).toBe(status);
  expect(res.body.success).toBe(false);
  expect(res.body.errorCode).toBe(errorCode);
  expect(typeof res.body.error).toBe("string");
  expect(res.body.error.length).toBeGreaterThan(0);
  // 구 클라이언트가 읽던 목록 키는 오류에도 빈 배열로 남는다
  expect(res.body.myBloodlines).toEqual([]);
  expect(mockClient.bloodlineCard.create).not.toHaveBeenCalled();
  expect(mockCaptureServerEvent).not.toHaveBeenCalled();
};

describe("POST /api/bloodline-cards — 만들기", () => {
  it("이름·종·사진으로 만들고 응답에 만든 혈통 하나를 준다", async () => {
    const res = await create({
      ...validBody,
      description: "  공주 산 왕사슴 혈통  ",
      originSido: "충청남도",
      originSigungu: "공주시",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.errorCode).toBeUndefined();
    expect(mockClient.bloodlineCard.create).toHaveBeenCalledTimes(1);
    const { data } = mockClient.bloodlineCard.create.mock.calls[0][0];
    expect(data).toEqual({
      creatorId: ME,
      currentOwnerId: ME,
      cardType: "BLOODLINE",
      name: "강산 라인",
      speciesType: "사슴벌레",
      image: "cf-image-1",
      description: "공주 산 왕사슴 혈통",
      originSido: "충청남도",
      originSigungu: "공주시",
    });

    const item = res.body.myBloodlines[0];
    expect(res.body.myBloodlines).toHaveLength(1);
    expect(res.body.myCreatedCards).toEqual([item]);
    expect(res.body.ownedCards).toEqual([item]);
    expect(res.body.receivedBloodlines).toEqual([]);
    expect(res.body.receivedLines).toEqual([]);
    expect(item).toMatchObject({
      name: "강산 라인",
      cardType: "BLOODLINE",
      speciesType: "사슴벌레",
      originSido: "충청남도",
      originSigungu: "공주시",
      originLabel: "충남 공주",
      isOwnedByMe: true,
      creator: { id: ME, name: "브리더" },
      currentOwner: { id: ME, name: "브리더" },
      receivedCount: 0,
      visualStyle: "noir",
    });

    // 보유자 거울·생성 기록·이벤트가 같은 트랜잭션에서 생긴다
    expect(mockClient.$transaction).toHaveBeenCalledTimes(1);
    expect(db.owners).toEqual([{ bloodlineCardId: item.id, userId: ME }]);
    expect(db.transfers).toEqual([
      expect.objectContaining({ cardId: item.id, fromUserId: null, toUserId: ME }),
    ]);
    expect(db.events).toEqual([
      expect.objectContaining({
        cardId: item.id,
        action: "BLOODLINE_CREATED",
        actorUserId: ME,
        toUserId: ME,
        note: "혈통을 만들었어요",
      }),
    ]);
  });

  it("구 앱 필드(visualStyle·transferPolicy)를 같이 보내도 만들고 저장하지 않는다", async () => {
    const res = await create({
      ...validBody,
      description: "예전 앱 소개",
      visualStyle: "clean",
      transferPolicy: "ONE_TIME",
    });

    expect(res.statusCode).toBe(200);
    expect(mockClient.$executeRaw).not.toHaveBeenCalled();
    const { data } = mockClient.bloodlineCard.create.mock.calls[0][0];
    expect(data).not.toHaveProperty("visualStyle");
    expect(data).not.toHaveProperty("transferPolicy");
    expect(res.body.myBloodlines[0].visualStyle).toBe("noir");
    expect(res.body.myBloodlines[0].transferPolicy).toBe("NONE");
  });

  it("구 앱 payload({name, description, visualStyle}) 는 종이 없어 400 BLOODLINE_SPECIES_REQUIRED 와 문구를 준다", async () => {
    const res = await create({ name: "강산라인", description: "소개", visualStyle: "noir" });
    expectRejected(res, 400, "BLOODLINE_SPECIES_REQUIRED");
    expect(res.body.error).toBe("종을 골라 주세요");
  });

  it("소개 없이 만든다", async () => {
    const res = await create(validBody);
    expect(res.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.create.mock.calls[0][0].data.description).toBeNull();
    expect(db.events[0].note).toBe("혈통을 만들었어요");
  });

  it("띄어쓰기를 허용하고 연속 공백을 하나로 줄여 저장한다", async () => {
    const res = await create({ ...validBody, name: "  강산   라인 " });
    expect(res.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.create.mock.calls[0][0].data.name).toBe("강산 라인");
  });

  it("정규화 키가 같은 이름은 409 BLOODLINE_DUPLICATE_NAME 이고 검사는 트랜잭션 안에서 한다", async () => {
    db.cards.push(card({ id: 3, name: "강산라인", creatorId: 1, currentOwnerId: 1 }));

    const res = await create({ ...validBody, name: "강산 라인" });

    expectRejected(res, 409, "BLOODLINE_DUPLICATE_NAME");
    expect(res.body.error).toBe("이미 사용 중인 이름이에요");
    expect(mockClient.$queryRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = mockClient.$queryRaw.mock.calls[0];
    const sql = (strings as string[]).join("?");
    expect(sql).toContain("lower(regexp_replace(name, '\\s', '', 'g'))");
    expect(sql).toContain(`"cardType" = 'BLOODLINE'`);
    expect(sql).toContain(`status IN ('ACTIVE', 'INACTIVE')`);
    expect(values).toEqual(["강산라인"]);
    // 같은 트랜잭션: 트랜잭션이 먼저 열리고 그 안에서 조회한다
    expect(mockClient.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
      mockClient.$queryRaw.mock.invocationCallOrder[0]
    );
    expect(mockClient.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("대소문자만 다른 영문 이름도 같은 이름이다", async () => {
    db.cards.push(card({ id: 3, name: "Kangsan Line", creatorId: 1, currentOwnerId: 1 }));
    const res = await create({ ...validBody, name: "kangsanline" });
    expectRejected(res, 409, "BLOODLINE_DUPLICATE_NAME");
  });

  it("운영 숨김(INACTIVE) 혈통도 이름을 잡고 있어 409 다(숨김을 풀 때 같은 이름이 둘이 되지 않게)", async () => {
    db.cards.push(card({ id: 3, name: "강산 라인", status: "INACTIVE", creatorId: 1, currentOwnerId: 1 }));
    const res = await create({ ...validBody, name: "강산라인" });
    expectRejected(res, 409, "BLOODLINE_DUPLICATE_NAME");
  });

  it("회수된 혈통이나 출처 카드와 이름이 같아도 만든다", async () => {
    db.cards.push(card({ id: 3, name: "강산라인", status: "REVOKED", creatorId: 1, currentOwnerId: 1 }));
    db.cards.push(
      card({ id: 4, name: "강산라인", cardType: "LINE", bloodlineReferenceId: 3, creatorId: 1, currentOwnerId: 5 })
    );
    const res = await create(validBody);
    expect(res.statusCode).toBe(200);
  });

  it("이름이 없으면 400 이고 닉네임으로 이름을 만들지 않는다", async () => {
    const res = await create({ speciesType: "사슴벌레", image: "cf" });
    expectRejected(res, 400, "BLOODLINE_INVALID_NAME");
    expect(res.body.error).toBe("이름은 한글·영문·숫자·띄어쓰기로 2~40자예요");
  });

  it.each([
    ["특수문자", "강산!"],
    ["1자", "강"],
    ["41자", "가".repeat(41)],
    ["공백만", "   "],
    ["문자열이 아님", 12345],
  ])("%s 이름은 400 BLOODLINE_INVALID_NAME", async (_label, name) => {
    const res = await create({ ...validBody, name });
    expectRejected(res, 400, "BLOODLINE_INVALID_NAME");
  });

  it("종이 없으면 400", async () => {
    const res = await create({ name: "강산 라인", image: "cf" });
    expectRejected(res, 400, "BLOODLINE_SPECIES_REQUIRED");
    const blank = await create({ ...validBody, speciesType: "  " });
    expect(blank.body.errorCode).toBe("BLOODLINE_SPECIES_REQUIRED");
  });

  it("노출 카테고리가 아닌 종은 400 이고 강아지·고양이는 통과", async () => {
    for (const speciesType of ["기타곤충", "왕사슴벌레", "dog"]) {
      const res = await create({ ...validBody, speciesType });
      expectRejected(res, 400, "BLOODLINE_INVALID_SPECIES");
      expect(res.body.error).toBe("고를 수 없는 종이에요");
    }

    const dog = await create({ ...validBody, name: "초코 혈통", speciesType: "강아지" });
    expect(dog.statusCode).toBe(200);
    const cat = await create({ ...validBody, name: "나비 혈통", speciesType: "고양이" });
    expect(cat.statusCode).toBe(200);
    const etc = await create({ ...validBody, name: "기타 혈통", speciesType: "기타" });
    expect(etc.statusCode).toBe(200);
    expect(
      mockClient.bloodlineCard.create.mock.calls.map((args: Row[]) => args[0].data.speciesType)
    ).toEqual(["강아지", "고양이", "기타"]);
  });

  it("사진이 없으면 400", async () => {
    const res = await create({ name: "강산 라인", speciesType: "사슴벌레" });
    expectRejected(res, 400, "BLOODLINE_IMAGE_REQUIRED");
    expect(res.body.error).toBe("대표 사진 1장이 필요해요");
    const blank = await create({ ...validBody, image: "   " });
    expect(blank.body.errorCode).toBe("BLOODLINE_IMAGE_REQUIRED");
  });

  it("산지 조합이 잘못되면 400", async () => {
    for (const origin of [
      { originSigungu: "공주시" },
      { originSido: "충청남도", originSigungu: "강남구" },
      { originSido: "충남", originSigungu: "공주시" },
      { originSido: 3 },
    ]) {
      const res = await create({ ...validBody, ...origin });
      expectRejected(res, 400, "BLOODLINE_INVALID_ORIGIN");
      expect(res.body.error).toBe("알 수 없는 지역이에요");
    }
  });

  it("산지는 선택이고 시·도만 골라도 만든다", async () => {
    const none = await create(validBody);
    expect(none.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.create.mock.calls[0][0].data).toMatchObject({
      originSido: null,
      originSigungu: null,
    });
    expect(none.body.myBloodlines[0].originLabel).toBeNull();

    const sidoOnly = await create({ ...validBody, name: "백두 라인", originSido: "충청남도", originSigungu: "" });
    expect(sidoOnly.statusCode).toBe(200);
    expect(mockClient.bloodlineCard.create.mock.calls[1][0].data).toMatchObject({
      originSido: "충청남도",
      originSigungu: null,
    });
    expect(sidoOnly.body.myBloodlines[0].originLabel).toBe("충남");
  });

  it("만들면 bloodline_created 를 1회 보낸다(트랜잭션이 끝난 뒤)", async () => {
    const res = await create({ ...validBody, description: "소개", originSido: "충청남도", originSigungu: "공주시" });
    expect(res.statusCode).toBe(200);
    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(ME, "bloodline_created", {
      bloodline_id: res.body.myBloodlines[0].id,
      species_type: "사슴벌레",
      has_origin: true,
      has_description: true,
    });
    expect(mockCaptureServerEvent.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockClient.bloodlineCardEvent.create.mock.invocationCallOrder[0]
    );
  });

  it("P2021 만 503 으로 분류한다", async () => {
    mockClient.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("The table `public.BloodlineCard` does not exist", {
        code: "P2021",
        clientVersion: "test",
      })
    );
    const missing = await create(validBody);
    expect(missing.statusCode).toBe(503);
    expect(missing.body.errorCode).toBe("BLOODLINE_UNAVAILABLE");

    mockClient.$transaction.mockRejectedValueOnce(
      new Error("Invalid `prisma.bloodlineCard.create()` invocation: bloodlinecard")
    );
    const other = await create(validBody);
    expect(other.statusCode).toBe(500);
    expect(other.body.errorCode).toBe("BLOODLINE_SERVER_ERROR");
    expect(other.body.myBloodlines).toEqual([]);
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  it("동시에 같은 이름을 만들다 직렬화 충돌이 나면 409 BLOODLINE_CONFLICT", async () => {
    mockClient.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("could not serialize access", {
        code: "P2034",
        clientVersion: "test",
      })
    );
    const res = await create(validBody);
    expect(res.statusCode).toBe(409);
    expect(res.body.errorCode).toBe("BLOODLINE_CONFLICT");
  });
});

describe("GET /api/bloodline-cards — 내 목록", () => {
  const seedLineage = () => {
    db.cards.push(
      // 10: 내가 만들고 보유. 출처 카드 20(도윤파파), 21(레거시 본인 발급), 22(백두, 회수됨)
      card({ id: 10, name: "강산 라인", creatorId: ME, currentOwnerId: ME, originSido: "충청남도", originSigungu: "공주시" }),
      card({ id: 20, name: "강산 라인", cardType: "LINE", bloodlineReferenceId: 10, parentCardId: 10, creatorId: ME, currentOwnerId: 5 }),
      card({ id: 21, name: "브리더라인", cardType: "LINE", bloodlineReferenceId: 10, parentCardId: 10, creatorId: ME, currentOwnerId: ME }),
      card({ id: 22, name: "강산 라인", cardType: "LINE", bloodlineReferenceId: 10, parentCardId: 10, creatorId: ME, currentOwnerId: 3, status: "REVOKED" }),
      // 11: 강산이 만들어 나에게 넘김(혈통 넘기기)
      card({ id: 11, name: "백두 혈통", creatorId: 1, currentOwnerId: ME, updatedAt: new Date("2026-09-20T00:00:00.000Z") }),
      // 12: 내가 만들었지만 한라에게 넘김 → 내 혈통이 아니다
      card({ id: 12, name: "넘긴 혈통", creatorId: ME, currentOwnerId: 8 }),
      // 50: 강산의 혈통. 출처 카드 30 을 내가 받음, 31 은 한라가 받음
      card({ id: 50, name: "한라 왕사슴", speciesType: "사슴벌레", creatorId: 1, currentOwnerId: 1, originSido: "제주특별자치도", originSigungu: "서귀포시", image: "cf-root-50" }),
      card({
        id: 30,
        name: "한라 왕사슴",
        cardType: "LINE",
        bloodlineReferenceId: 50,
        parentCardId: 50,
        creatorId: 1,
        currentOwnerId: ME,
        createdAt: new Date("2026-09-12T00:00:00.000Z"),
        updatedAt: new Date("2026-09-12T00:00:00.000Z"),
      }),
      card({ id: 31, name: "한라 왕사슴", cardType: "LINE", bloodlineReferenceId: 50, parentCardId: 50, creatorId: 1, currentOwnerId: 8 }),
      // 60: 회수된 혈통의 출처 카드 32 를 내가 가짐(카드 자체는 ACTIVE 로 남은 레거시)
      card({ id: 60, name: "회수 혈통", creatorId: 3, currentOwnerId: 3, status: "REVOKED" }),
      card({ id: 32, name: "회수 혈통", cardType: "LINE", bloodlineReferenceId: 60, parentCardId: 60, creatorId: 3, currentOwnerId: ME })
    );
  };

  it("내 혈통은 지금 보유한 혈통이다", async () => {
    seedLineage();
    const res = await list();

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.myBloodlines.map((c: Row) => c.id).sort()).toEqual([10, 11]);
    expect(res.body.receivedBloodlines.map((c: Row) => c.id)).toEqual([11]);
    expect(res.body.myCreatedCards.map((c: Row) => c.id).sort()).toEqual([10, 11]);
    expect(res.body.myBloodlines.every((c: Row) => c.isOwnedByMe === true)).toBe(true);
    // 받은 사람 수: 만든 사람 보유분(21)·회수된 것(22) 제외 → 도윤파파 1명
    const mine = res.body.myBloodlines.find((c: Row) => c.id === 10);
    expect(mine.receivedCount).toBe(1);
    expect(mine.originLabel).toBe("충남 공주");
    expect(res.body.myBloodlines.find((c: Row) => c.id === 11).receivedCount).toBe(0);
    // 넘긴 혈통은 어디에도 없다
    expect(res.body.ownedCards.map((c: Row) => c.id)).not.toContain(12);
    expect(res.body.attachable).toBeUndefined();
  });

  it("받은 출처 카드는 남이 만든 LINE 이다", async () => {
    seedLineage();
    const res = await list();

    expect(res.body.receivedLines.map((c: Row) => c.id).sort()).toEqual([30, 32]);
    expect(res.body.createdLines.map((c: Row) => c.id)).toEqual([21]);
    expect(res.body.receivedCards.map((c: Row) => c.id).sort()).toEqual([11, 30, 32]);
    expect(res.body.ownedCards.map((c: Row) => c.id).sort()).toEqual([10, 11, 21, 30, 32]);
    expect(res.body.receivedLines.every((c: Row) => c.isOwnedByMe === true)).toBe(true);
  });

  it("받은 출처 카드의 넘기기 기록은 상세와 같은 규칙으로 가리고 메모는 당사자에게만 준다", async () => {
    // 출처 카드 40: 강산(1)이 도윤파파(5)에게 보내고 → 도윤파파가 백두(3)에게 → 백두가 나(7)에게 넘겼다
    db.cards.push(
      card({ id: 50, name: "한라 왕사슴", creatorId: 1, currentOwnerId: 1 }),
      card({
        id: 40,
        name: "한라 왕사슴",
        cardType: "LINE",
        bloodlineReferenceId: 50,
        parentCardId: 50,
        creatorId: 1,
        currentOwnerId: ME,
        transferCount: 2,
        description: "도윤님 입금 확인했어요",
      })
    );
    db.transfers.push(
      { id: 901, cardId: 40, fromUserId: 5, toUserId: 3, note: "도윤-백두 거래", createdAt: new Date("2026-09-20T00:00:00.000Z") },
      { id: 902, cardId: 40, fromUserId: 3, toUserId: ME, note: "잘 부탁해요", createdAt: new Date("2026-09-25T00:00:00.000Z") }
    );
    db.events.push(
      { id: 801, cardId: 50, action: "LINE_ISSUED", actorUserId: 1, fromUserId: 1, toUserId: 5, relatedCardId: 40, note: "도윤님 입금 확인했어요" },
      { id: 802, cardId: 40, action: "LINE_TRANSFER", actorUserId: 5, fromUserId: 5, toUserId: 3, note: "도윤-백두 거래" },
      { id: 803, cardId: 40, action: "LINE_TRANSFER", actorUserId: 3, fromUserId: 3, toUserId: ME, note: "잘 부탁해요" }
    );

    const res = await list();
    const line = res.body.receivedLines.find((c: Row) => c.id === 40);
    expect(line.transfers).toEqual([
      // 나에게 보낸 백두는 보이고 메모도 보인다
      expect.objectContaining({ fromUser: { id: 3, name: "백두" }, toUser: { id: ME, name: "브리더" }, note: "잘 부탁해요" }),
      // 나와 직접 주고받지 않은 도윤파파는 가리고, 그 거래 메모도 주지 않는다
      expect.objectContaining({
        fromUser: { id: 0, name: "닉네임 비공개", masked: true },
        toUser: { id: 3, name: "백두" },
        note: null,
      }),
    ]);
    // 발급자(뿌리 만든 사람)는 공개, 출처 카드 메모는 지금 보유자인 나에게 보인다
    expect(line.creator).toEqual({ id: 1, name: "강산" });
    expect(line.description).toBe("도윤님 입금 확인했어요");
  });

  it("attach 모드는 보유 혈통과 받은 출처 카드의 뿌리를 준다", async () => {
    seedLineage();
    db.transfers.push({
      id: 900,
      cardId: 30,
      fromUserId: 1,
      toUserId: ME,
      note: null,
      createdAt: new Date("2026-09-15T00:00:00.000Z"),
    });
    const res = await list({ mode: "attach" });

    expect(res.statusCode).toBe(200);
    // 기존 목록 키도 그대로 준다
    expect(res.body.myBloodlines.map((c: Row) => c.id).sort()).toEqual([10, 11]);
    const byRoot = new Map(res.body.attachable.map((a: Row) => [a.rootId, a]));
    expect(Array.from(byRoot.keys()).sort()).toEqual([10, 11, 50]);
    expect(byRoot.get(10)).toEqual({
      rootId: 10,
      name: "강산 라인",
      speciesType: "사슴벌레",
      originLabel: "충남 공주",
      creator: { id: ME, name: "브리더" },
      relation: "mine",
      image: "cf",
    });
    expect(byRoot.get(11)).toMatchObject({ rootId: 11, relation: "mine", creator: { id: 1, name: "강산" } });
    expect(byRoot.get(50)).toEqual({
      rootId: 50,
      name: "한라 왕사슴",
      speciesType: "사슴벌레",
      originLabel: "제주 서귀포",
      creator: { id: 1, name: "강산" },
      relation: "received",
      // 썸네일은 뿌리 혈통 사진(PRD S-7 44 썸네일)
      image: "cf-root-50",
      lineCardId: 30,
      receivedFrom: { id: 1, name: "강산" },
      receivedAt: "2026-09-15T00:00:00.000Z",
    });
    // mine 이 먼저, 그다음 received
    expect(res.body.attachable[res.body.attachable.length - 1].rootId).toBe(50);
  });

  it("attach 모드: 직접 받은 출처 카드는 보낸 사람 = 발급자, 받은 날 = 발급일이다", async () => {
    seedLineage();
    const res = await list({ mode: "attach" });
    const received = res.body.attachable.find((a: Row) => a.rootId === 50);
    expect(received.receivedFrom).toEqual({ id: 1, name: "강산" });
    expect(received.receivedAt).toBe("2026-09-12T00:00:00.000Z");
  });

  it("mode=create 는 지금 보유한 혈통만 준다", async () => {
    seedLineage();
    const res = await list({ mode: "create" });
    expect(res.body.myBloodlines.map((c: Row) => c.id).sort()).toEqual([10, 11]);
    expect(res.body.ownedCards.map((c: Row) => c.id).sort()).toEqual([10, 11]);
    expect(res.body.receivedLines).toEqual([]);
    expect(res.body.createdLines).toEqual([]);
  });

  it("목록을 읽지 못하면 errorCode 와 빈 목록을 준다", async () => {
    mockClient.bloodlineCard.findMany.mockRejectedValueOnce(new Error("db down"));
    const res = await list();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      errorCode: "BLOODLINE_SERVER_ERROR",
      myBloodlines: [],
      receivedLines: [],
      ownedCards: [],
    });
    expect(typeof res.body.error).toBe("string");
  });
});
