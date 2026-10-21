import type { NextApiRequest, NextApiResponse } from "next";

/**
 * 채팅방 나가기·알림 끄기(앱 docs/prd/chat-room-settings.md).
 * - 나가기는 나만 지운다: 나간 뒤 새 메시지가 없으면 목록에서 빠지고, 방을 열면 나간 뒤 메시지만 보인다.
 * - 알림 끈 방은 푸시를 보내지 않는다. 상대의 설정은 응답에 들어가지 않는다.
 * 채팅 분양글 카드(앱 docs/prd/trade-review.md §1.1): 분양글에서 연 방의 첫 메시지와 함께 서버가 카드 행을 방·글당 1번 넣고,
 * 문맥 바는 ?card=1 일 때만, 안 읽은 수는 카드 행을 빼고 센다.
 */

const mockClient = {
  userBlock: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  chatRoom: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  chatRoomMember: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  message: { create: jest.fn(), count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  product: { findFirst: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));
const mockPush = jest.fn();
jest.mock("@libs/server/pushGateway", () => ({ sendAllPushToUsers: (...a: unknown[]) => mockPush(...a) }));

import chatListHandler from "../pages/api/chat/chatList";
import roomHandler from "../pages/api/chat/[chatRoomId]/index";
import messageHandler from "../pages/api/chat/[chatRoomId]/message";
import leaveHandler from "../pages/api/chat/[chatRoomId]/leave";
import muteHandler from "../pages/api/chat/[chatRoomId]/mute";

const ME = 7;
const PARTNER = 9;
const LEFT_AT = new Date("2026-10-20T10:00:00.000Z");
const BEFORE = new Date("2026-10-20T09:00:00.000Z");
const AFTER = new Date("2026-10-20T11:00:00.000Z");

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  req: Partial<NextApiRequest>
) {
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
    setHeader: jest.fn(),
  };
  await handler(
    { method: "POST", headers: {}, query: {}, body: {}, cookies: {}, user: { id: ME }, ...req } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const member = (userId: number, extra: Record<string, unknown> = {}) => ({
  userId,
  lastReadAt: null,
  leftAt: null,
  mutedAt: null,
  user: { id: userId, name: `u${userId}`, avatar: null },
  ...extra,
});
const room = (id: number, lastAt: Date | null, mine: Record<string, unknown> = {}) => ({
  id,
  updatedAt: lastAt ?? BEFORE,
  chatRoomMembers: [member(ME, mine), member(PARTNER, { mutedAt: AFTER, lastReadAt: AFTER })],
  messages: lastAt ? [{ id: id * 10, type: "TEXT", message: "hi", image: null, createdAt: lastAt, userId: PARTNER }] : [],
});

/** 상대(PARTNER)의 분양중 분양글 */
const productRow = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `개체${id}`,
  price: 150000,
  mainImage: null,
  photos: [`img${id}`],
  status: "판매중",
  userId: PARTNER,
  productType: "생물",
  categoryId: null,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockClient.userBlock.findMany.mockResolvedValue([]);
  mockClient.user.findUnique.mockResolvedValue({ id: PARTNER, status: "ACTIVE" });
  mockClient.message.count.mockResolvedValue(1);
  mockClient.message.findMany.mockResolvedValue([]);
  mockClient.message.findFirst.mockResolvedValue(null);
  mockClient.product.findFirst.mockResolvedValue(null);
  mockClient.product.findMany.mockResolvedValue([]);
  mockClient.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function" ? arg(mockClient) : Promise.all(arg as unknown[])
  );
  mockPush.mockResolvedValue(undefined);
});

describe("GET /api/chat/chatList", () => {
  it("나간 방은 새 메시지가 올 때까지 빼고, 내 알림 상태·최근 카드 분양글 썸네일을 내려주며 카드는 안 읽은 수에서 뺀다", async () => {
    mockClient.chatRoom.findMany.mockResolvedValue([
      room(1, BEFORE, { leftAt: LEFT_AT }), // 나간 뒤 메시지 없음 → 숨김
      room(2, AFTER, { leftAt: LEFT_AT, lastReadAt: LEFT_AT, mutedAt: BEFORE }), // 다시 나타남
    ]);
    mockClient.message.findMany.mockResolvedValue([{ chatRoomId: 2, productId: 70 }]);
    mockClient.product.findMany.mockResolvedValue([productRow(70)]);

    const res = await call(chatListHandler, { method: "GET" });

    expect(res.body.chatRooms.map((r: { id: number }) => r.id)).toEqual([2]);
    expect(res.body.chatRooms[0].muted).toBe(true);
    expect(res.body.chatRooms[0].product).toEqual({ id: 70, name: "개체70", image: "img70" });
    expect(mockClient.message.count.mock.calls[0][0].where).toMatchObject({ createdAt: { gt: LEFT_AT }, productId: null });
    // 상대의 알림·읽음·나가기 상태는 응답에 없다.
    expect(res.body.chatRooms[0].chatRoomMembers).toEqual([
      { user: { id: ME, name: `u${ME}`, avatar: null } },
      { user: { id: PARTNER, name: `u${PARTNER}`, avatar: null } },
    ]);
  });
});

describe("GET /api/chat/:id", () => {
  it("나간 방을 열면 나간 뒤 메시지만 조회하고 me.muted 를 준다", async () => {
    mockClient.chatRoom.findFirst.mockResolvedValue({ id: 3, chatRoomMembers: [] });
    mockClient.chatRoomMember.findUnique.mockResolvedValue({ leftAt: LEFT_AT, mutedAt: null });
    mockClient.message.findMany.mockResolvedValue([]);

    const res = await call(roomHandler, { method: "GET", query: { chatRoomId: "3" } });

    expect(mockClient.message.findMany.mock.calls[0][0].where).toEqual({
      chatRoomId: 3,
      createdAt: { gt: LEFT_AT },
    });
    expect(res.body.me).toEqual({ muted: false });
    // card=1 이 없으면(옛 앱) 문맥 분양글을 읽지도 내려주지도 않는다.
    expect(res.body.chatRoom.product).toBeUndefined();
    expect(mockClient.product.findFirst).not.toHaveBeenCalled();
  });

  it("card=1 이면 ?productId 글 → 없으면 방의 최근 카드 글 → 둘 다 없으면 null", async () => {
    mockClient.chatRoom.findFirst.mockResolvedValue({ id: 3, chatRoomMembers: [] });
    mockClient.chatRoomMember.findUnique.mockResolvedValue({ leftAt: null, mutedAt: null });
    const get = (query: Record<string, string>) =>
      call(roomHandler, { method: "GET", query: { chatRoomId: "3", card: "1", ...query } });

    // ?productId 글이 방 멤버의 보이는 글이고 카드가 아직 없으면: 추천 칩을 켠다.
    mockClient.product.findFirst.mockResolvedValueOnce(productRow(70));
    const requested = await get({ productId: "70" });
    expect(requested.body.chatRoom.product).toMatchObject({
      id: 70,
      sellerId: PARTNER,
      statusLabel: "분양중",
      viewerAction: null,
      showStarterChips: true,
    });

    // ?productId 글이 방 멤버 글이 아니면 방의 최근 카드 글(카드가 있으니 칩은 끈다). 메시지 행에도 카드 분양글이 붙는다.
    const sender = { id: ME, name: "나", avatar: null };
    mockClient.message.findMany.mockResolvedValueOnce([
      // 최신순으로 읽어 화면용으로 뒤집는다.
      { id: 12, type: "TEXT", message: "아직 분양 중인가요?", image: null, createdAt: AFTER, productId: null, user: sender },
      { id: 11, type: "TEXT", message: "[분양글] 개체80 · 150,000원", image: null, createdAt: BEFORE, productId: 80, user: sender },
    ]);
    mockClient.product.findMany.mockResolvedValueOnce([productRow(80)]);
    mockClient.message.findFirst.mockImplementation(async ({ where }: { where: { productId?: unknown } }) =>
      where.productId && typeof where.productId === "object" ? { productId: 80 } : null
    );
    mockClient.product.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(productRow(80, { userId: ME }));
    const fallback = await get({ productId: "71" });
    expect(fallback.body.chatRoom.product).toMatchObject({ id: 80, viewerAction: "sold", showStarterChips: false });
    const cardIds = fallback.body.chatRoom.messages.map((m: { product: { id: number } | null }) => m.product?.id ?? null);
    expect(cardIds).toEqual([80, null]);

    // 카드도 ?productId 도 없으면 null
    mockClient.message.findFirst.mockResolvedValue(null);
    const none = await get({});
    expect(none.body.chatRoom.product).toBeNull();
  });
});

describe("POST /api/chat/:id/message", () => {
  it("상대가 이 방 알림을 껐으면 저장은 하고 푸시는 보내지 않는다", async () => {
    mockClient.chatRoom.findFirst.mockResolvedValue({ id: 3 });
    mockClient.chatRoomMember.findMany.mockResolvedValue([{ userId: PARTNER, mutedAt: BEFORE }]);
    mockClient.$transaction.mockResolvedValue([
      { id: 1, type: "TEXT", message: "hi", image: null, createdAt: AFTER, user: { id: ME, name: "나", avatar: null } },
    ]);

    const res = await call(messageHandler, { query: { chatRoomId: "3" }, body: { message: "hi" } });

    expect(res.body.success).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });

  const sendWithProduct = (body: Record<string, unknown>) =>
    call(messageHandler, { query: { chatRoomId: "3" }, body: { message: "아직 분양 중인가요?", productId: 70, ...body } });

  it("분양글에서 연 방의 첫 메시지는 카드 → 본문 순서로 넣고, 카드가 이미 있으면 본문만 보낸다", async () => {
    mockClient.chatRoom.findFirst.mockResolvedValue({ id: 3 });
    mockClient.chatRoomMember.findMany.mockResolvedValue([{ userId: PARTNER, mutedAt: null }]);
    mockClient.product.findFirst.mockResolvedValue(productRow(70));
    mockClient.message.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: data.productId ? 1 : 2,
      type: "TEXT",
      message: data.message,
      image: null,
      createdAt: data.createdAt ?? AFTER,
      productId: data.productId ?? null,
      user: { id: ME, name: "나", avatar: null },
    }));

    const first = await sendWithProduct({});
    expect(first.body.cardMessage).toMatchObject({ id: 1, productId: 70, message: "[분양글] 개체70 · 150,000원", product: { id: 70 } });
    expect(first.body.message).toMatchObject({ id: 2, productId: null, product: null });
    expect(mockClient.product.findFirst.mock.calls[0][0].where).toMatchObject({ id: 70, userId: { in: [ME, PARTNER] } });
    expect(mockClient.$executeRaw).toHaveBeenCalled();
    const [cardData, bodyData] = mockClient.message.create.mock.calls.map((c) => c[0].data);
    expect((bodyData.createdAt as Date).getTime() - (cardData.createdAt as Date).getTime()).toBe(1);
    // 푸시는 본문 기준 1번
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][1].body).toBe("나: 아직 분양 중인가요?");

    mockClient.message.findFirst.mockResolvedValue({ id: 1 });
    mockClient.message.create.mockClear();
    const second = await sendWithProduct({});
    expect(second.body.cardMessage).toBeUndefined();
    expect(mockClient.message.create).toHaveBeenCalledTimes(1);
    expect(mockClient.message.create.mock.calls[0][0].data.productId).toBeUndefined();
  });

  it("클라이언트가 보낸 type 은 TEXT·IMAGE 만, productId 는 방 멤버의 보이는 글만 받는다", async () => {
    mockClient.chatRoom.findFirst.mockResolvedValue({ id: 3 });
    mockClient.chatRoomMember.findMany.mockResolvedValue([{ userId: PARTNER, mutedAt: null }]);

    const forged = await sendWithProduct({ type: "PRODUCT" });
    expect(forged.statusCode).toBe(400);
    expect(forged.body.errorCode).toBe("INVALID_TYPE");

    // 방 멤버의 글이 아니면(findFirst where userId in 멤버 → 없음) 400
    const notMine = await sendWithProduct({ productId: 99 });
    expect(notMine.statusCode).toBe(400);
    expect(notMine.body.errorCode).toBe("INVALID_PRODUCT");
    expect(mockClient.message.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat/:id/leave · mute", () => {
  it("나가기는 내 멤버에 나간 시각과 읽은 시각을 같이 적고, 멤버가 아니면 404", async () => {
    mockClient.chatRoomMember.findUnique.mockResolvedValueOnce({ id: 1 });
    const ok = await call(leaveHandler, { query: { chatRoomId: "3" } });
    expect(ok.body).toEqual({ success: true });
    const { where, data } = mockClient.chatRoomMember.update.mock.calls[0][0];
    expect(where).toEqual({ userId_chatRoomId: { userId: ME, chatRoomId: 3 } });
    expect(data.leftAt).toBeInstanceOf(Date);
    expect(data.lastReadAt).toBe(data.leftAt);

    mockClient.chatRoomMember.findUnique.mockResolvedValueOnce(null);
    const missing = await call(leaveHandler, { query: { chatRoomId: "4" } });
    expect(missing.statusCode).toBe(404);
  });

  it("알림 켜기는 mutedAt 을 비우고, muted 가 boolean 이 아니면 400", async () => {
    mockClient.chatRoomMember.findUnique.mockResolvedValueOnce({ id: 1 });
    const on = await call(muteHandler, { query: { chatRoomId: "3" }, body: { muted: false } });
    expect(on.body).toEqual({ success: true, muted: false });
    expect(mockClient.chatRoomMember.update.mock.calls[0][0].data).toEqual({ mutedAt: null });

    const bad = await call(muteHandler, { query: { chatRoomId: "3" }, body: { muted: "yes" } });
    expect(bad.statusCode).toBe(400);
  });
});
