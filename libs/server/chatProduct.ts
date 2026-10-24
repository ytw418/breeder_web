import type { MessageType, Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { getAllCategories } from "@libs/server/categories";
import { EMPTY_TRADE_SNAPSHOT, readTradeSnapshot, tradeStateOf } from "@libs/server/trade";
import { assertWriteAllowed, type WriteLimitBlock } from "@libs/server/writeLimits";
import { productStatusLabel } from "@libs/shared/productTerms";
import {
  chatProductAction,
  productCardSnapshot,
  type ChatMessageProduct,
  type ChatRoomProduct,
} from "@libs/shared/tradeChat";
import { SOLD_PRODUCT_STATUS } from "@libs/shared/tradeReview";

/**
 * 채팅 분양글 카드·문맥 바 서버(앱 docs/prd/trade-review.md §1.1·§3.6, docs/prd/chat.md).
 * - 카드 행은 Message{type:'TEXT', productId} 이고 이 파일만 만든다. 클라이언트가 보낸 type 은 TEXT·IMAGE 만 받는다.
 * - 방·글당 카드 1개. 분양글에서 연 방의 첫 메시지와 함께 lock 안에서 카드 → 본문 순서로 넣는다(카드 createdAt = 본문 − 1ms).
 * - 지웠거나 운영자가 숨긴 분양글은 새 카드·문맥 바·목록 썸네일에 쓰지 않고, 이미 보낸 카드의 product 는 null 로 준다.
 * - 안 읽은 수·카톡식 '1'은 카드 행을 세지 않는다(서버 unread 는 where productId:null, '1' 은 화면이 isProductCard 로 뺀다).
 */

type Db = Prisma.TransactionClient | typeof client;

/** 지우지도 숨기지도 않은 분양글만 카드·문맥 바·썸네일에 쓴다. */
const VISIBLE_PRODUCT = { isDeleted: false, isHidden: false } as const;

const chatProductSelect = {
  id: true,
  name: true,
  price: true,
  mainImage: true,
  photos: true,
  status: true,
  userId: true,
  productType: true,
  categoryId: true,
  // 강아지·고양이 글은 가격 대신 글 종류를 보인다(productPriceText).
  category: true,
  dealType: true,
  // 보호소 공고 글(externalSource 있음)은 채팅 카드로 보내지 않는다(message API 가 막는다).
  externalSource: true,
} satisfies Prisma.ProductSelect;

export type ChatProductRow = Prisma.ProductGetPayload<{ select: typeof chatProductSelect }>;

/** 문맥 바·추천 칩이 열린 판매 상태(분양중·예약중). */
const STARTER_CHIP_STATUSES = new Set(["판매중", "예약중"]);

const productImage = (product: { mainImage: string | null; photos: string[] | null }) =>
  product.mainImage || product.photos?.[0] || null;

export function toChatMessageProduct(product: ChatProductRow): ChatMessageProduct {
  return {
    id: product.id,
    name: product.name,
    price: product.price ?? null,
    image: productImage(product),
    status: product.status,
    statusLabel: productStatusLabel(product.status),
    category: product.category ?? null,
    dealType: product.dealType ?? null,
  };
}

/** 요청 본문·쿼리의 productId: 없음 → null, 양의 정수 → 그 값, 그 밖 → "invalid". */
export function parseChatProductId(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const id = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(id) && id > 0 ? id : "invalid";
}

/** 이 방에서 카드로 보낼 수 있는 분양글: 있고 · 지우거나 숨기지 않았고 · 방 멤버(보내는 사람 포함)의 글. */
export async function findRoomProduct(productId: number, memberIds: number[]): Promise<ChatProductRow | null> {
  return client.product.findFirst({
    where: { id: productId, ...VISIBLE_PRODUCT, userId: { in: memberIds } },
    select: chatProductSelect,
  });
}

/** 이 방에 이 분양글 카드가 이미 있는지(방 단위 — 나간 멤버의 기준 시각과 무관). */
async function hasProductCard(db: Db, chatRoomId: number, productId: number): Promise<boolean> {
  const card = await db.message.findFirst({ where: { chatRoomId, productId }, select: { id: true } });
  return Boolean(card);
}

/** 이 방에 이 분양글 카드가 아직 없는지(lock 밖에서 미리 본다 — 카드가 있으면 lock 없이 보내려는 것). */
export async function needsProductCard(chatRoomId: number, productId: number): Promise<boolean> {
  return !(await hasProductCard(client, chatRoomId, productId));
}

const sentMessageSelect = {
  id: true,
  type: true,
  message: true,
  image: true,
  createdAt: true,
  productId: true,
  user: { select: { id: true, name: true, avatar: true } },
} satisfies Prisma.MessageSelect;

export type SentMessageRow = Prisma.MessageGetPayload<{ select: typeof sentMessageSelect }>;

export type ProductCardSendResult =
  | { blocked: WriteLimitBlock }
  | { blocked: null; message: SentMessageRow; card: SentMessageRow | null };

/**
 * 분양글 맥락이 있는 메시지를 보낸다. 방·글 lock 안에서 카드가 없음을 다시 확인하고, 없으면 카드 → 본문 순서로 넣는다.
 * 같은 본문 한도(writeLimits)는 여기서 센다 — 카드가 이번에 새로 들어가고 보내는 사람이 분양자가 아닐 때만 본문을 뺀다.
 */
export async function sendMessageWithProductCard({
  chatRoomId,
  senderId,
  product,
  type,
  message,
  image,
}: {
  chatRoomId: number;
  senderId: number;
  product: ChatProductRow;
  type: MessageType;
  message: string;
  image: string | null;
}): Promise<ProductCardSendResult> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`chatcard:${chatRoomId}`}), ${product.id}::int)`;
    const insertCard = !(await hasProductCard(tx, chatRoomId, product.id));

    if (type === "TEXT") {
      const blocked = await assertWriteAllowed({
        userId: senderId,
        kind: "message",
        text: message,
        withNewProductCard: insertCard && product.userId !== senderId,
        db: tx,
      });
      if (blocked) return { blocked };
    }

    const now = new Date();
    const card = insertCard
      ? await tx.message.create({
          data: {
            type: "TEXT",
            message: productCardSnapshot(product),
            productId: product.id,
            chatRoomId,
            userId: senderId,
            // 본문보다 1ms 앞 — [createdAt, id] 어느 쪽으로 정렬해도 카드가 본문 바로 위에 온다.
            createdAt: new Date(now.getTime() - 1),
          },
          select: sentMessageSelect,
        })
      : null;
    const body = await tx.message.create({
      data: { type, message, image, chatRoomId, userId: senderId, createdAt: now },
      select: sentMessageSelect,
    });
    await tx.chatRoom.update({ where: { id: chatRoomId }, data: { updatedAt: now } });
    return { blocked: null, message: body, card };
  });
}

/** 메시지 행의 카드 분양글을 한 번에 읽는다. 지웠거나 숨긴 글은 맵에 없다(→ product null). */
export async function loadChatMessageProducts(
  productIds: Array<number | null | undefined>
): Promise<Map<number, ChatMessageProduct>> {
  const ids = Array.from(new Set(productIds.filter((id): id is number => typeof id === "number")));
  if (ids.length === 0) return new Map();
  const rows = await client.product.findMany({
    where: { id: { in: ids }, ...VISIBLE_PRODUCT },
    select: chatProductSelect,
  });
  return new Map(rows.map((row) => [row.id, toChatMessageProduct(row)]));
}

/**
 * 채팅 목록 행 썸네일: 방마다 가장 최근 카드의 분양글(방 단위). 카드 없는 방·지우거나 숨긴 글은 맵에 없다.
 * 카드 행은 방·글당 1개라 읽는 행이 적다.
 */
export async function loadLatestRoomProducts(
  chatRoomIds: number[]
): Promise<Map<number, { id: number; name: string; image: string | null }>> {
  if (chatRoomIds.length === 0) return new Map();
  const cards = await client.message.findMany({
    where: { chatRoomId: { in: chatRoomIds }, productId: { not: null } },
    distinct: ["chatRoomId"],
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { chatRoomId: true, productId: true },
  });
  const products = await loadChatMessageProducts(cards.map((card) => card.productId));
  const byRoom = new Map<number, { id: number; name: string; image: string | null }>();
  cards.forEach((card) => {
    const product = card.productId == null ? undefined : products.get(card.productId);
    if (product) byRoom.set(card.chatRoomId, { id: product.id, name: product.name, image: product.image });
  });
  return byRoom;
}

/** 방의 가장 최근 카드 글. 그 글을 지웠거나 숨겼으면 null(더 옛 카드로 거슬러 가지 않는다). */
async function latestCardProduct(chatRoomId: number): Promise<ChatProductRow | null> {
  const latestCard = await client.message.findFirst({
    where: { chatRoomId, productId: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { productId: true },
  });
  if (latestCard?.productId == null) return null;
  return client.product.findFirst({
    where: { id: latestCard.productId, ...VISIBLE_PRODUCT },
    select: chatProductSelect,
  });
}

/**
 * GET /api/chat/:id?card=1 의 chatRoom.product(문맥 바·추천 칩).
 * ?productId 글이 방 멤버의 보이는 글이면 그 글, 아니면 방의 가장 최근 카드 글(지웠거나 숨겼으면 null).
 * viewerAction 은 공용 chatProductAction, showStarterChips 는 분양자 아님 · 분양중·예약중 · 이 방에 그 글 카드 없음.
 */
export async function resolveChatRoomProduct({
  chatRoomId,
  viewerId,
  memberIds,
  requestedProductId,
}: {
  chatRoomId: number;
  viewerId: number;
  memberIds: number[];
  requestedProductId: number | null;
}): Promise<ChatRoomProduct | null> {
  const requested = requestedProductId ? await findRoomProduct(requestedProductId, memberIds) : null;
  const product = requested ?? (await latestCardProduct(chatRoomId));
  if (!product) return null;

  const [cardExists, snapshot, categories] = await Promise.all([
    // 최근 카드에서 고른 글이면 카드가 이미 있다.
    requested ? hasProductCard(client, chatRoomId, product.id) : true,
    product.status === SOLD_PRODUCT_STATUS ? readTradeSnapshot(client, product.id) : EMPTY_TRADE_SNAPSHOT,
    product.categoryId != null ? getAllCategories() : [],
  ]);
  const isSeller = product.userId === viewerId;

  return {
    ...toChatMessageProduct(product),
    sellerId: product.userId,
    productType: product.productType ?? null,
    categoryPath: categories.find((category) => category.id === product.categoryId)?.path ?? null,
    viewerAction: chatProductAction(tradeStateOf(product, snapshot, viewerId)),
    showStarterChips: !isSeller && STARTER_CHIP_STATUSES.has(product.status) && !cardExists,
  };
}
