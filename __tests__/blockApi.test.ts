import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  userBlock: {
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  follow: { deleteMany: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import blocksHandler from "../pages/api/blocks/index";
import unblockHandler from "../pages/api/blocks/[userId]";
import syncHandler from "../pages/api/blocks/sync";
import { BLOCK_LIMIT } from "@libs/server/blocks";

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
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
    },
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

const me = { id: 7, name: "차단하는사람" } as NextApiRequest["user"];

type BlockRow = { id: number; blockerId: number; blockedId: number; createdAt: Date };
const USERS: Record<number, { id: number; name: string; avatar: string | null }> = {
  9: { id: 9, name: "상대", avatar: "avatar-9" },
  12: { id: 12, name: "다른상대", avatar: null },
};

// 차단 테이블을 메모리로 흉내 낸다(멱등성 검증용).
let blocks: BlockRow[] = [];
let nextId = 1;
let clock = Date.parse("2026-10-01T00:00:00.000Z");

function addBlock(blockerId: number, blockedId: number) {
  const row = { id: nextId++, blockerId, blockedId, createdAt: new Date((clock += 1000)) };
  blocks.push(row);
  return row;
}

beforeEach(() => {
  jest.clearAllMocks();
  blocks = [];
  nextId = 1;

  mockClient.user.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
    Promise.resolve(USERS[where.id] ? { id: where.id } : null)
  );
  mockClient.user.findMany.mockImplementation(
    ({ where }: { where: { id: { in: number[] } } }) =>
      Promise.resolve(where.id.in.map((id) => ({ id })))
  );

  mockClient.userBlock.findMany.mockImplementation(
    ({ where, select }: { where: { blockerId: number }; select?: Record<string, unknown> }) => {
      const rows = blocks
        .filter((b) => b.blockerId === where.blockerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return Promise.resolve(
        rows.map((row) =>
          select?.blocked
            ? {
                id: row.id,
                createdAt: row.createdAt,
                blockedId: row.blockedId,
                blocked: USERS[row.blockedId],
              }
            : { blockedId: row.blockedId }
        )
      );
    }
  );
  mockClient.userBlock.count.mockImplementation(
    ({ where }: { where: { blockerId: number; blockedId?: { not: number } } }) =>
      Promise.resolve(
        blocks.filter(
          (b) =>
            b.blockerId === where.blockerId &&
            (where.blockedId === undefined || b.blockedId !== where.blockedId.not)
        ).length
      )
  );
  mockClient.userBlock.upsert.mockImplementation(
    ({ where }: { where: { blockerId_blockedId: { blockerId: number; blockedId: number } } }) => {
      const { blockerId, blockedId } = where.blockerId_blockedId;
      const existing = blocks.find(
        (b) => b.blockerId === blockerId && b.blockedId === blockedId
      );
      return Promise.resolve(existing ?? addBlock(blockerId, blockedId));
    }
  );
  mockClient.userBlock.deleteMany.mockImplementation(
    ({ where }: { where: { blockerId: number; blockedId: number } }) => {
      const before = blocks.length;
      blocks = blocks.filter(
        (b) => !(b.blockerId === where.blockerId && b.blockedId === where.blockedId)
      );
      return Promise.resolve({ count: before - blocks.length });
    }
  );
  mockClient.userBlock.createMany.mockImplementation(
    ({
      data,
      skipDuplicates,
    }: {
      data: { blockerId: number; blockedId: number }[];
      skipDuplicates?: boolean;
    }) => {
      let count = 0;
      for (const item of data) {
        const exists = blocks.some(
          (b) => b.blockerId === item.blockerId && b.blockedId === item.blockedId
        );
        if (exists) {
          if (!skipDuplicates) return Promise.reject(new Error("unique violation"));
          continue;
        }
        addBlock(item.blockerId, item.blockedId);
        count += 1;
      }
      return Promise.resolve({ count });
    }
  );
  mockClient.follow.deleteMany.mockResolvedValue({ count: 0 });
  mockClient.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
});

describe("GET /api/blocks", () => {
  it("로그인하지 않으면 401", async () => {
    const res = await call(blocksHandler, { method: "GET" });
    expect(res.statusCode).toBe(401);
  });

  it("내 차단 목록(최근순)과 id 목록, private 캐시", async () => {
    const first = addBlock(7, 9);
    const second = addBlock(7, 12);
    addBlock(99, 9); // 다른 사람의 차단은 섞이지 않는다

    const res = await call(blocksHandler, { method: "GET", user: me });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      blocks: [
        { id: second.id, user: USERS[12], createdAt: second.createdAt },
        { id: first.id, user: USERS[9], createdAt: first.createdAt },
      ],
      blockedUserIds: [12, 9],
    });
    expect(res.headers["cache-control"]).toMatch(/^private, no-store/);
    expect(mockClient.userBlock.findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: { blockerId: 7 },
        orderBy: { createdAt: "desc" },
      })
    );
  });
});

describe("POST /api/blocks", () => {
  const block = (userId: unknown) =>
    call(blocksHandler, { method: "POST", user: me, body: { userId } });

  it("로그인하지 않으면 401", async () => {
    const res = await call(blocksHandler, { method: "POST", body: { userId: 9 } });
    expect(res.statusCode).toBe(401);
  });

  it.each(["abc", 0, -3, 1.5, null, undefined, true])(
    "userId=%p 는 400 BLOCK_INVALID_USER_ID",
    async (userId) => {
      const res = await block(userId);
      expect(res.statusCode).toBe(400);
      expect(res.body.errorCode).toBe("BLOCK_INVALID_USER_ID");
      expect(res.body.success).toBe(false);
    }
  );

  it("본인은 400 BLOCK_SELF_NOT_ALLOWED", async () => {
    const res = await block(7);
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("BLOCK_SELF_NOT_ALLOWED");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("없는 사용자는 404 BLOCK_USER_NOT_FOUND", async () => {
    const res = await block(404);
    expect(res.statusCode).toBe(404);
    expect(res.body.errorCode).toBe("BLOCK_USER_NOT_FOUND");
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it(`이미 ${BLOCK_LIMIT}명을 차단했으면 400 BLOCK_LIMIT_EXCEEDED`, async () => {
    mockClient.userBlock.count.mockResolvedValueOnce(BLOCK_LIMIT);
    const res = await block(9);
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("BLOCK_LIMIT_EXCEEDED");
    // 이미 차단한 대상은 개수에서 빼고 센다(재차단은 멱등이어야 하므로)
    expect(mockClient.userBlock.count.mock.calls[0][0].where).toEqual({
      blockerId: 7,
      blockedId: { not: 9 },
    });
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it("성공: upsert 와 양방향 팔로우 삭제를 한 트랜잭션으로 처리", async () => {
    const res = await block(9);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, blocked: true, blockedUserIds: [9] });

    expect(mockClient.$transaction).toHaveBeenCalledTimes(1);
    expect(mockClient.$transaction.mock.calls[0][0]).toHaveLength(2);
    expect(mockClient.userBlock.upsert).toHaveBeenCalledWith({
      where: { blockerId_blockedId: { blockerId: 7, blockedId: 9 } },
      create: { blockerId: 7, blockedId: 9 },
      update: {},
    });
    expect(mockClient.follow.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { followerId: 7, followingId: 9 },
          { followerId: 9, followingId: 7 },
        ],
      },
    });
  });

  it("숫자 문자열 userId 도 받는다", async () => {
    const res = await block("9");
    expect(res.statusCode).toBe(200);
    expect(res.body.blockedUserIds).toEqual([9]);
  });

  it("같은 사용자를 다시 차단해도 200 이고 한 건만 남는다", async () => {
    const firstRes = await block(9);
    const secondRes = await block(9);
    expect(firstRes.statusCode).toBe(200);
    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.body).toEqual({ success: true, blocked: true, blockedUserIds: [9] });
    expect(blocks.filter((b) => b.blockerId === 7 && b.blockedId === 9)).toHaveLength(1);
  });
});

describe("DELETE /api/blocks/[userId]", () => {
  const unblock = (userId: string) =>
    call(unblockHandler, { method: "DELETE", user: me, query: { userId } });

  it("로그인하지 않으면 401", async () => {
    const res = await call(unblockHandler, { method: "DELETE", query: { userId: "9" } });
    expect(res.statusCode).toBe(401);
  });

  it("잘못된 userId 는 400 BLOCK_INVALID_USER_ID", async () => {
    const res = await unblock("abc");
    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe("BLOCK_INVALID_USER_ID");
  });

  it("해제 후 남은 차단 목록을 돌려주고, 다시 해제해도 200", async () => {
    addBlock(7, 9);
    addBlock(7, 12);

    const firstRes = await unblock("9");
    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.body).toEqual({ success: true, blocked: false, blockedUserIds: [12] });
    expect(mockClient.userBlock.deleteMany).toHaveBeenCalledWith({
      where: { blockerId: 7, blockedId: 9 },
    });

    const secondRes = await unblock("9");
    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.body).toEqual({ success: true, blocked: false, blockedUserIds: [12] });
  });
});

describe("POST /api/blocks/sync", () => {
  const sync = (body: unknown) =>
    call(syncHandler, { method: "POST", user: me, body: body as NextApiRequest["body"] });

  it("로그인하지 않으면 401", async () => {
    const res = await call(syncHandler, { method: "POST", body: { userIds: [9] } });
    expect(res.statusCode).toBe(401);
  });

  it.each([{}, { userIds: "9,12" }, { userIds: null }, { userIds: { 0: 9 } }])(
    "배열이 아닌 body(%p)는 400 BLOCK_SYNC_INVALID_BODY",
    async (body) => {
      const res = await sync(body);
      expect(res.statusCode).toBe(400);
      expect(res.body.errorCode).toBe("BLOCK_SYNC_INVALID_BODY");
      expect(mockClient.userBlock.createMany).not.toHaveBeenCalled();
    }
  );

  it("숫자 문자열은 정수로 바꾸고, 중복·본인·잘못된 값은 뺀다", async () => {
    const res = await sync({ userIds: ["9", 9, 7, "7", "abc", -1, 1.5, null, 12] });
    expect(res.statusCode).toBe(200);
    expect(mockClient.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: [9, 12] } },
      select: { id: true },
    });
    expect(mockClient.userBlock.createMany).toHaveBeenCalledWith({
      data: [
        { blockerId: 7, blockedId: 9 },
        { blockerId: 7, blockedId: 12 },
      ],
      skipDuplicates: true,
    });
    expect(res.body).toEqual({ success: true, imported: 2, blockedUserIds: [12, 9] });
  });

  it("POST /api/blocks 와 같이 가져온 차단 상대와의 양방향 팔로우를 한 트랜잭션으로 지운다", async () => {
    const res = await sync({ userIds: [9, 12] });
    expect(res.statusCode).toBe(200);

    expect(mockClient.$transaction).toHaveBeenCalledTimes(1);
    expect(mockClient.$transaction.mock.calls[0][0]).toHaveLength(2);
    expect(mockClient.follow.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { followerId: 7, followingId: { in: [9, 12] } },
          { followerId: { in: [9, 12] }, followingId: 7 },
        ],
      },
    });
    expect(res.body.imported).toBe(2);
  });

  it("201개를 보내면 앞의 200개만 처리한다", async () => {
    const ids = Array.from({ length: 201 }, (_, i) => 100 + i);
    await sync({ userIds: ids });
    const inIds = mockClient.user.findMany.mock.calls[0][0].where.id.in;
    expect(inIds).toHaveLength(200);
    expect(inIds).toEqual(ids.slice(0, 200));
  });

  it("존재하지 않는 사용자는 제외한다", async () => {
    mockClient.user.findMany.mockResolvedValueOnce([{ id: 9 }]);
    const res = await sync({ userIds: [9, 404] });
    expect(mockClient.userBlock.createMany.mock.calls[0][0].data).toEqual([
      { blockerId: 7, blockedId: 9 },
    ]);
    expect(res.body).toEqual({ success: true, imported: 1, blockedUserIds: [9] });
  });

  it("이미 서버에 있는 차단은 건너뛰고 새로 들어간 수만 imported 로 센다", async () => {
    addBlock(7, 9);
    const res = await sync({ userIds: [9, 12] });
    expect(res.statusCode).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.blockedUserIds.sort()).toEqual([12, 9].sort());
  });

  it("빈 배열이면 아무것도 만들지 않고 현재 목록을 돌려준다", async () => {
    addBlock(7, 12);
    const res = await sync({ userIds: [] });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, imported: 0, blockedUserIds: [12] });
    expect(mockClient.userBlock.createMany).not.toHaveBeenCalled();
    expect(mockClient.follow.deleteMany).not.toHaveBeenCalled();
    expect(mockClient.$transaction).not.toHaveBeenCalled();
  });

  it(`차단 한도(${BLOCK_LIMIT})를 넘기지 않도록 남은 자리만큼만 넣는다`, async () => {
    mockClient.userBlock.count.mockResolvedValueOnce(BLOCK_LIMIT - 1);
    await sync({ userIds: [9, 12] });
    expect(mockClient.userBlock.createMany.mock.calls[0][0].data).toEqual([
      { blockerId: 7, blockedId: 9 },
    ]);
  });
});
