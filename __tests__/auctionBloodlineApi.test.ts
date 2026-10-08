/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";

/**
 * 경매에 혈통 붙이기(설계 §3.6, PRD AC-99).
 * - 권한은 canAttachBloodline: 지금 보유한 혈통 또는 그 뿌리의 출처 카드 보유. 만든 사람이라도 넘긴 뒤에는 403.
 *   오류 코드는 그대로 AUCTION_INVALID_BLOODLINE_ROOT / AUCTION_BLOODLINE_FORBIDDEN.
 * - pedigreeNote: 등록은 검사 후 저장, 수정은 보낸 때만 갱신. bloodlineRootId 는 기존처럼 전체 교체이고
 *   null 이 되면 pedigreeNote 도 null.
 * - 상세 auction.bloodline 요약, winnerReceived 는 판매자·종료·낙찰자 있음이고 판매자가 지금 보낼 수 있을 때만 계산.
 * - 붙이면 auction_bloodline_attached 1회.
 */

type CardRow = {
  id: number;
  cardType: "BLOODLINE" | "LINE";
  status: "ACTIVE" | "INACTIVE" | "REVOKED";
  name: string;
  speciesType: string | null;
  originSido: string | null;
  originSigungu: string | null;
  creatorId: number;
  currentOwnerId: number;
  bloodlineReferenceId: number | null;
  transferCount: number;
  createdAt: Date;
  creator: { id: number; name: string };
};

let cards: CardRow[] = [];

const findCard = jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
  const row = cards.find((card) =>
    Object.entries(where).every(([key, value]) => (card as Record<string, unknown>)[key] === value)
  );
  return row ?? null;
});

const mockClient = {
  user: { findUnique: jest.fn() },
  auction: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  bloodlineCard: { findFirst: findCard },
  bloodlineCardTransfer: { findFirst: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/auctionSettlement", () => ({
  settleExpiredAuctions: jest.fn(),
}));
jest.mock("@libs/server/breeder-programs", () => ({
  breederProgramSummarySelect: {},
  getSortedActiveBreederProgramSummaries: () => [],
}));
jest.mock("@libs/server/notification", () => ({
  createNotification: jest.fn(),
}));
const mockCapture = jest.fn();
jest.mock("@libs/server/analytics", () => ({
  captureServerEvent: (...args: unknown[]) => mockCapture(...args),
}));

import createHandler from "../pages/api/auctions/index";
import detailHandler from "../pages/api/auctions/[id]/index";

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

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: Partial<NextApiRequest>
) {
  const res = createRes();
  await handler(
    { headers: {}, query: {}, body: {}, cookies: {}, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-08T03:00:00.000Z");
const ME = 7;
const WINNER = 9;
const me = { id: ME, name: "브리더" } as NextApiRequest["user"];
const KANGSAN = { id: 1, name: "강산" };

const baseBody = {
  title: "왕사슴 유충 경매",
  description: "건강한 3령 유충입니다.",
  photos: ["img-1"],
  category: "곤충",
  startPrice: 10000,
};

const root = (patch: Partial<CardRow> = {}): CardRow => ({
  id: 10,
  cardType: "BLOODLINE",
  status: "ACTIVE",
  name: "강산 라인",
  speciesType: "왕사슴벌레",
  originSido: "충청남도",
  originSigungu: "공주시",
  creatorId: KANGSAN.id,
  currentOwnerId: KANGSAN.id,
  bloodlineReferenceId: null,
  transferCount: 0,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  creator: KANGSAN,
  ...patch,
});

const sourceCard = (ownerId: number, patch: Partial<CardRow> = {}): CardRow => ({
  ...root(),
  id: 20 + ownerId,
  cardType: "LINE",
  currentOwnerId: ownerId,
  bloodlineReferenceId: 10,
  createdAt: new Date("2026-09-12T03:00:00.000Z"),
  ...patch,
});

/** 수정 가능한 경매(5분 전 등록, 진행중, 입찰 0). */
const editableAuction = (patch: Record<string, unknown> = {}) => {
  const createdAt = new Date(NOW.getTime() - 5 * 60 * 1000);
  return {
    id: 5,
    userId: ME,
    status: "진행중",
    createdAt,
    endAt: new Date(createdAt.getTime() + HOUR),
    startPrice: 10000,
    minBidIncrement: 1000,
    bloodlineRootId: null,
    pedigreeNote: null,
    _count: { bids: 0 },
    ...patch,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  cards = [];
  mockClient.user.findUnique.mockResolvedValue({ status: "ACTIVE", phone: null, email: null });
  mockClient.auction.count.mockResolvedValue(0);
  mockClient.auction.findFirst.mockResolvedValue(null);
  mockClient.auction.findUnique.mockResolvedValue(editableAuction());
  mockClient.auction.create.mockImplementation(({ data }) => Promise.resolve({ id: 11, ...data }));
  mockClient.auction.update.mockImplementation(({ data }) => Promise.resolve({ id: 5, ...data }));
  mockClient.bloodlineCardTransfer.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

const create = (body: Record<string, unknown>) =>
  call(createHandler, {
    method: "POST",
    user: me,
    body: { ...baseBody, endAt: new Date(NOW.getTime() + 2 * HOUR).toISOString(), ...body },
  });

const update = (body: Record<string, unknown>) =>
  call(detailHandler, {
    method: "POST",
    user: me,
    query: { id: "5" },
    body: { action: "update", ...baseBody, ...body },
  });

const createdData = () => mockClient.auction.create.mock.calls[0][0].data;
const updatedData = () => mockClient.auction.update.mock.calls[0][0].data;

describe("POST /api/auctions 혈통 연결(등록)", () => {
  it("구 앱 등록(혈통 필드 없음)은 혈통 없이 저장하고 계측하지 않는다", async () => {
    const res = await create({});
    expect(res.statusCode).toBe(200);
    expect(createdData().bloodlineRootId).toBeNull();
    expect(createdData()).not.toHaveProperty("pedigreeNote");
    expect(findCard).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("넘긴 뒤에는 연결할 수 없다", async () => {
    cards = [root({ creatorId: ME, currentOwnerId: 2 })];
    const res = await create({ bloodlineRootId: 10 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("AUCTION_BLOODLINE_FORBIDDEN");
    expect(mockClient.auction.create).not.toHaveBeenCalled();
  });

  it("출처 카드를 받은 혈통을 연결하고 부모 정보를 저장한다", async () => {
    cards = [root(), sourceCard(ME)];
    const res = await create({
      bloodlineRootId: 10,
      pedigreeNote: { generation: "F3", sireMm: "81.2", damMm: 47.5, memo: "x" },
    });
    expect(res.statusCode).toBe(200);
    expect(createdData().bloodlineRootId).toBe(10);
    expect(createdData().pedigreeNote).toEqual({ generation: "F3", sireMm: 81.2, damMm: 47.5 });
  });

  it("붙이면 auction_bloodline_attached 를 1회 보낸다", async () => {
    cards = [root({ currentOwnerId: ME })];
    await create({ bloodlineRootId: 10 });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(ME, "auction_bloodline_attached", {
      auction_id: 11,
      bloodline_id: 10,
      relation: "mine",
      has_pedigree: false,
      generation: null,
    });
  });

  it("남의 혈통은 403", async () => {
    cards = [root()];
    const res = await create({ bloodlineRootId: 10 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("AUCTION_BLOODLINE_FORBIDDEN");
  });

  it("없거나 회수된 혈통은 400", async () => {
    cards = [root({ status: "REVOKED", currentOwnerId: ME })];
    const res = await create({ bloodlineRootId: 10 });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_INVALID_BLOODLINE_ROOT");
    expect(mockClient.auction.create).not.toHaveBeenCalled();
  });

  it("혈통 없이 부모 정보만 오면 400", async () => {
    const res = await create({ pedigreeNote: { generation: "F3" } });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_PEDIGREE_WITHOUT_BLOODLINE");
    expect(mockClient.auction.create).not.toHaveBeenCalled();
  });

  it("부모 정보가 규칙 밖이면 400", async () => {
    cards = [root({ currentOwnerId: ME })];
    const res = await create({ bloodlineRootId: 10, pedigreeNote: { sireMm: 81.25 } });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_INVALID_PEDIGREE_NOTE");
    expect(mockClient.auction.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auctions/:id 혈통 연결(수정)", () => {
  it("넘긴 뒤에는 연결할 수 없다", async () => {
    cards = [root({ creatorId: ME, currentOwnerId: 2 })];
    const res = await update({ bloodlineRootId: 10 });
    expect(res.statusCode).toBe(403);
    expect(res.body.errorCode).toBe("AUCTION_BLOODLINE_FORBIDDEN");
    expect(mockClient.auction.update).not.toHaveBeenCalled();
  });

  it("출처 카드를 받은 혈통을 연결한다(새로 붙이면 계측 1회)", async () => {
    cards = [root(), sourceCard(ME)];
    const res = await update({ bloodlineRootId: 10, pedigreeNote: { generation: "F2" } });
    expect(res.statusCode).toBe(200);
    expect(updatedData()).toMatchObject({ bloodlineRootId: 10, pedigreeNote: { generation: "F2" } });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(ME, "auction_bloodline_attached", {
      auction_id: 5,
      bloodline_id: 10,
      relation: "received",
      has_pedigree: true,
      generation: "F2",
    });
  });

  it("부모 정보는 보낸 때만 바꾼다", async () => {
    cards = [root({ currentOwnerId: ME })];
    mockClient.auction.findUnique.mockResolvedValue(
      editableAuction({ bloodlineRootId: 10, pedigreeNote: { generation: "F3" } })
    );

    // 구 앱: pedigreeNote 를 모른다 → 기존 값 유지
    let res = await update({ bloodlineRootId: 10 });
    expect(res.statusCode).toBe(200);
    expect(updatedData().bloodlineRootId).toBe(10);
    expect(updatedData()).not.toHaveProperty("pedigreeNote");

    // 새 앱: 보낸 값으로 바꾼다
    mockClient.auction.update.mockClear();
    res = await update({ bloodlineRootId: 10, pedigreeNote: { generation: "F4", damMm: 47.5 } });
    expect(res.statusCode).toBe(200);
    expect(updatedData().pedigreeNote).toEqual({ generation: "F4", damMm: 47.5 });

    // null 이면 지운다
    mockClient.auction.update.mockClear();
    res = await update({ bloodlineRootId: 10, pedigreeNote: null });
    expect(res.statusCode).toBe(200);
    expect(updatedData().pedigreeNote).toBe(Prisma.DbNull);
  });

  it("혈통 id 는 전체 교체를 유지한다(안 보내면 해제되고 부모 정보도 지운다)", async () => {
    mockClient.auction.findUnique.mockResolvedValue(
      editableAuction({ bloodlineRootId: 10, pedigreeNote: { generation: "F3" } })
    );
    const res = await update({});
    expect(res.statusCode).toBe(200);
    expect(updatedData().bloodlineRootId).toBeNull();
    expect(updatedData().pedigreeNote).toBe(Prisma.DbNull);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("이미 연결된 혈통을 그대로 두는 수정은 권한을 다시 보지 않고 계측하지 않는다", async () => {
    cards = [root({ status: "REVOKED" })];
    mockClient.auction.findUnique.mockResolvedValue(editableAuction({ bloodlineRootId: 10 }));
    const res = await update({ title: "제목만 수정", bloodlineRootId: 10 });
    expect(res.statusCode).toBe(200);
    expect(updatedData().bloodlineRootId).toBe(10);
    expect(findCard).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("혈통을 안 보내고 부모 정보만 보내면 400", async () => {
    const res = await update({ pedigreeNote: { generation: "F3" } });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_PEDIGREE_WITHOUT_BLOODLINE");
    expect(mockClient.auction.update).not.toHaveBeenCalled();
  });

  it("부모 정보가 규칙 밖이면 400", async () => {
    cards = [root({ currentOwnerId: ME })];
    const res = await update({ bloodlineRootId: 10, pedigreeNote: { generation: "WD" } });
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("AUCTION_INVALID_PEDIGREE_NOTE");
    expect(mockClient.auction.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/auctions/:id 혈통 요약·winnerReceived", () => {
  const endedAuction = (patch: Record<string, unknown> = {}) => ({
    ...editableAuction(),
    status: "종료",
    winnerId: WINNER,
    bloodlineRootId: 10,
    pedigreeNote: { generation: "F3", sireMm: 81.2 },
    isHidden: false,
    user: { id: ME, name: "브리더", avatar: null, breederPrograms: [] },
    bids: [],
    _count: { bids: 3 },
    ...patch,
  });
  const get = (user?: NextApiRequest["user"]) =>
    call(detailHandler, { method: "GET", user, query: { id: "5" } });

  beforeEach(() => {
    cards = [root({ currentOwnerId: ME, creatorId: ME, creator: { id: ME, name: "브리더" } })];
    mockClient.auction.findUnique.mockResolvedValue(endedAuction());
  });

  it("상세는 혈통 요약과 부모 정보를 준다", async () => {
    const res = await get({ id: 99, name: "남" } as NextApiRequest["user"]);
    expect(res.statusCode).toBe(200);
    expect(res.body.auction.bloodline).toEqual({
      id: 10,
      name: "강산 라인",
      speciesType: "왕사슴벌레",
      originLabel: "충남 공주",
      creator: { id: ME, name: "브리더" },
      sellerRelation: "creator",
      receivedAt: null,
    });
    expect(res.body.auction.pedigreeNote).toEqual({ generation: "F3", sireMm: 81.2 });
  });

  it("winnerReceived 는 판매자에게만 계산한다", async () => {
    const seller = await get(me);
    expect(seller.body.auction.bloodline.winnerReceived).toBe(false);

    const anonymous = await get();
    expect(anonymous.body.auction.bloodline).not.toHaveProperty("winnerReceived");

    const winner = await get({ id: WINNER, name: "낙찰자" } as NextApiRequest["user"]);
    expect(winner.body.auction.bloodline).not.toHaveProperty("winnerReceived");
  });

  it("낙찰자가 출처 카드를 받았으면 winnerReceived true", async () => {
    cards.push(sourceCard(WINNER));
    const res = await get(me);
    expect(res.body.auction.bloodline.winnerReceived).toBe(true);
  });

  it("판매자가 혈통을 넘겼고 출처 카드도 없으면 winnerReceived 를 싣지 않는다(눌러도 보낼 수 없는 제안 행을 막는다)", async () => {
    // 판매자(나)가 만든 혈통을 강산에게 넘겼다. 요약 관계는 그대로 creator
    cards = [root({ currentOwnerId: KANGSAN.id, creatorId: ME, creator: { id: ME, name: "브리더" } })];
    const res = await get(me);
    expect(res.body.auction.bloodline).toMatchObject({ id: 10, sellerRelation: "creator" });
    expect(res.body.auction.bloodline).not.toHaveProperty("winnerReceived");

    // 그 혈통의 출처 카드를 가졌으면 다음 분에게 보내기로 보낼 수 있어 계산한다
    cards.push(sourceCard(ME));
    const holder = await get(me);
    expect(holder.body.auction.bloodline.winnerReceived).toBe(false);
  });

  it.each([
    ["진행중", { status: "진행중", winnerId: null }],
    ["유찰", { status: "유찰", winnerId: null }],
    ["종료인데 낙찰자 없음", { winnerId: null }],
  ])("%s 이면 winnerReceived 를 계산하지 않는다", async (_label, patch) => {
    mockClient.auction.findUnique.mockResolvedValue(endedAuction(patch));
    const res = await get(me);
    expect(res.body.auction.bloodline).not.toHaveProperty("winnerReceived");
  });

  it("회수된 혈통은 요약이 null", async () => {
    cards = [root({ status: "REVOKED" })];
    const res = await get(me);
    expect(res.statusCode).toBe(200);
    expect(res.body.auction.bloodline).toBeNull();
  });

  it("혈통 요약 조회가 실패해도 상세는 200 이고 요약만 null", async () => {
    findCard.mockRejectedValueOnce(new Error("db down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await get(me);
    spy.mockRestore();
    expect(res.statusCode).toBe(200);
    expect(res.body.auction.bloodline).toBeNull();
  });

  it("혈통이 없으면 요약 null, 혈통 조회도 하지 않는다", async () => {
    mockClient.auction.findUnique.mockResolvedValue(
      endedAuction({ bloodlineRootId: null, pedigreeNote: null })
    );
    const res = await get(me);
    expect(res.body.auction.bloodline).toBeNull();
    expect(res.body.auction.pedigreeNote).toBeNull();
    expect(findCard).not.toHaveBeenCalled();
  });
});
