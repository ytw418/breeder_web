import type { NextApiRequest, NextApiResponse } from "next";

const mockSeed = {
  users: [] as Array<Record<string, unknown>>,
  follows: [],
  products: [],
  posts: [],
  likes: [],
  comments: [],
  favs: [],
  auctions: [],
};
jest.mock(
  "data/service-initial-data.json",
  () => ({ __esModule: true, default: mockSeed }),
  { virtual: true }
);

const mockTx = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};
const mockClient = {
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/adminAccess", () => ({
  hasAdminAccess: () => Promise.resolve(true),
  canRunSensitiveAdminAction: () => true,
}));

import bootstrapHandler from "../pages/api/admin/bootstrap-service-data";

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
  };
  return res;
}

async function bootstrap() {
  const res = createRes();
  await bootstrapHandler(
    {
      method: "POST",
      headers: {},
      query: {},
      body: {},
      user: { id: 1, name: "관리자" },
    } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EXISTING_ID = 11;
const CREATED_ID = 12;

beforeEach(() => {
  jest.clearAllMocks();
  mockSeed.users = [];
  mockClient.user.findUnique.mockResolvedValue({ email: "ytw418@gmail.com" });
  mockClient.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockTx));
  mockTx.user.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
    Promise.resolve(
      where.snsId === "seed-existing"
        ? { id: EXISTING_ID, status: "ACTIVE", provider: "seed", avatar: null, role: "USER" }
        : null
    )
  );
  mockTx.user.update.mockResolvedValue({ id: EXISTING_ID });
  mockTx.user.create.mockResolvedValue({ id: CREATED_ID });
  mockTx.user.updateMany.mockResolvedValue({ count: 1 });
});

describe("/api/admin/bootstrap-service-data 시드 유저 상태", () => {
  it("정지·차단 상태는 setUserStatus 로 기록해 만료 시각과 tokenVersion 을 함께 맞춘다", async () => {
    mockSeed.users = [
      { seedKey: "e", snsId: "seed-existing", name: "기존", status: "SUSPENDED_7D" },
      { seedKey: "n", snsId: "seed-new", name: "신규", status: "BANNED" },
    ];
    const before = Date.now();

    const res = await bootstrap();

    expect(res.statusCode).toBe(200);
    // 기존 유저 프로필 갱신과 신규 생성은 상태를 직접 쓰지 않는다.
    expect(mockTx.user.update.mock.calls[0][0].data).not.toHaveProperty("status");
    expect(mockTx.user.create.mock.calls[0][0].data.status).toBe("ACTIVE");

    expect(mockTx.user.updateMany).toHaveBeenCalledTimes(2);
    const [suspend, ban] = mockTx.user.updateMany.mock.calls.map(([args]) => args);
    expect(suspend.where).toEqual({ id: EXISTING_ID, status: { not: "DELETED" } });
    expect(suspend.data.status).toBe("SUSPENDED_7D");
    expect(suspend.data.tokenVersion).toEqual({ increment: 1 });
    expect(suspend.data.suspendedUntil.getTime()).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
    expect(ban).toEqual({
      where: { id: CREATED_ID, status: { not: "DELETED" } },
      data: { status: "BANNED", suspendedUntil: null, tokenVersion: { increment: 1 } },
    });
  });

  it("상태가 같거나 없으면 상태를 건드리지 않는다", async () => {
    mockSeed.users = [
      { seedKey: "e", snsId: "seed-existing", name: "기존", status: "ACTIVE" },
      { seedKey: "n", snsId: "seed-new", name: "신규" },
    ];

    const res = await bootstrap();

    expect(res.statusCode).toBe(200);
    expect(mockTx.user.updateMany).not.toHaveBeenCalled();
  });

  it("DELETED 시드는 탈퇴 처리(개인정보 분리)를 거치지 않으므로 400 으로 거절한다", async () => {
    mockSeed.users = [{ seedKey: "d", snsId: "seed-new", name: "탈퇴", status: "DELETED" }];

    const res = await bootstrap();

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });
});
