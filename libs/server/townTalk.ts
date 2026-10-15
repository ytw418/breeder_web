import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { getViewerRegionScope } from "@libs/server/nearby";
import { getTopSpeciesByUserIds } from "@libs/server/profileSpecies";
import { createNotification } from "@libs/server/notification";
import { regionScopeOr, NEIGHBOR_RADIUS_KM } from "@libs/shared/regionScope";
import {
  TOWN_DAILY_LIMIT,
  TOWN_MESSAGE_MAX,
  TOWN_NEWCOMER_DAYS,
  TOWN_PAGE_SIZE,
  TOWN_PREVIEW_COUNT,
  TOWN_RATE_SECONDS,
  TOWN_VISIBLE_DAYS,
  townMessagePreview,
  townPromptsFor,
  townQuietMinutes,
  townWelcomeMessage,
} from "@libs/shared/townTalk";
import { BLOCKED_WORD_MESSAGE, hasBlockedWord } from "@libs/shared/contentFilter";
import { maskContactsInText } from "@libs/shared/contactInText";
import type { TownMessage, TownMessagesResult, TownPreviewResult } from "@libs/shared/liveTalk";

/**
 * 동네 사랑방 서버 로직(앱 docs/prd/live-talk.md §3.4). 방이 아니라 보낸 사람의 시/군/구가
 * 읽는 사람의 반경 50km 범위 안이면 보인다. 최근 7일만, 양방향 차단 관계는 뺀다.
 */

export class TownError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string
  ) {
    super(message);
  }
}

const messageSelect = {
  id: true,
  createdAt: true,
  userId: true,
  regionSigungu: true,
  type: true,
  body: true,
  image: true,
  productId: true,
  replyToId: true,
  deletedAt: true,
  user: { select: { id: true, name: true, avatar: true, createdAt: true } },
} satisfies Prisma.TownMessageSelect;

type MessageRow = Prisma.TownMessageGetPayload<{ select: typeof messageSelect }>;

/** viewer 와 양방향 차단 관계인 사용자 id. */
async function blockedBothWays(viewerId: number): Promise<number[]> {
  const rows = await client.userBlock.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
    take: 1000,
  });
  return Array.from(new Set(rows.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId))));
}

async function scopeWhere(viewerId: number) {
  const scope = await getViewerRegionScope(viewerId);
  if (!scope) return null;
  const blocked = await blockedBothWays(viewerId);
  const where: Prisma.TownMessageWhereInput = {
    OR: regionScopeOr(scope.regions),
    isHidden: false,
    createdAt: { gte: new Date(Date.now() - TOWN_VISIBLE_DAYS * 86_400_000) },
    ...(blocked.length ? { userId: { notIn: blocked } } : {}),
  };
  return { scope, where, blocked };
}

async function toTownMessages(rows: MessageRow[], viewerId: number): Promise<TownMessage[]> {
  if (!rows.length) return [];
  const userIds = Array.from(new Set(rows.map((row) => row.userId)));
  const productIds = Array.from(new Set(rows.map((row) => row.productId).filter((id): id is number => id != null)));
  const replyIds = Array.from(new Set(rows.map((row) => row.replyToId).filter((id): id is number => id != null)));
  const [species, products, replies, firsts] = await Promise.all([
    getTopSpeciesByUserIds(userIds),
    productIds.length
      ? client.product.findMany({
          where: { id: { in: productIds }, isDeleted: false },
          select: { id: true, name: true, price: true, photos: true, status: true },
        })
      : Promise.resolve([] as { id: number; name: string; price: number | null; photos: string[]; status: string }[]),
    replyIds.length
      ? client.townMessage.findMany({
          where: { id: { in: replyIds } },
          select: { id: true, body: true, type: true, deletedAt: true, user: { select: { name: true } } },
        })
      : Promise.resolve([]),
    client.townMessage.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _min: { id: true } }),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const replyById = new Map(replies.map((reply) => [reply.id, reply]));
  const firstIdByUser = new Map(firsts.map((row) => [row.userId, row._min.id]));
  const newcomerSince = Date.now() - TOWN_NEWCOMER_DAYS * 86_400_000;
  return rows.map((row) => {
    const product = row.productId != null ? productById.get(row.productId) : undefined;
    const reply = row.replyToId != null ? replyById.get(row.replyToId) : undefined;
    const deleted = row.deletedAt != null;
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      mine: row.userId === viewerId,
      user: {
        id: row.user.id,
        name: row.user.name,
        avatar: row.user.avatar,
        isNewcomer: row.user.createdAt.getTime() >= newcomerSince,
        topSpecies: species.get(row.userId)?.[0] ?? null,
      },
      regionSigungu: row.regionSigungu,
      type: row.type,
      body: deleted ? null : row.body,
      image: deleted ? null : row.image,
      product:
        !deleted && product
          ? { id: product.id, name: product.name, price: product.price, image: product.photos?.[0] ?? null, status: product.status }
          : null,
      replyTo: reply
        ? {
            id: reply.id,
            userName: reply.user.name,
            body: townMessagePreview({ type: reply.type, body: reply.body, deleted: reply.deletedAt != null }).slice(0, 60),
          }
        : null,
      deleted,
      firstInScope: firstIdByUser.get(row.userId) === row.id,
    };
  });
}

/** 내가 반겨 준 사람(내가 '…반가워요!'로 답장한 메시지의 작성자). */
async function welcomedUserIds(viewerId: number): Promise<number[]> {
  const mine = await client.townMessage.findMany({
    where: { userId: viewerId, replyToId: { not: null }, body: { endsWith: "반가워요!" } },
    select: { replyToId: true },
    take: 200,
  });
  const ids = mine.map((row) => row.replyToId).filter((id): id is number => id != null);
  if (!ids.length) return [];
  const targets = await client.townMessage.findMany({ where: { id: { in: ids } }, select: { userId: true } });
  return Array.from(new Set(targets.map((row) => row.userId)));
}

export async function listTownMessages({
  viewerId,
  after,
  before,
  limit = TOWN_PAGE_SIZE,
}: {
  viewerId: number;
  after?: number | null;
  before?: number | null;
  limit?: number;
}): Promise<TownMessagesResult> {
  const scoped = await scopeWhere(viewerId);
  const prompts = townPromptsFor();
  if (!scoped) {
    return { success: true, scope: null, messages: [], neighbors: 0, quietMinutes: null, prompts, hasMoreBefore: false, welcomedUserIds: [] };
  }
  const { scope, where, blocked } = scoped;
  let rows: MessageRow[];
  if (after) {
    rows = await client.townMessage.findMany({
      where: { ...where, id: { gt: after } },
      select: messageSelect,
      orderBy: { id: "asc" },
      take: limit,
    });
  } else {
    rows = (
      await client.townMessage.findMany({
        where: { ...where, ...(before ? { id: { lt: before } } : {}) },
        select: messageSelect,
        orderBy: { id: "desc" },
        take: limit,
      })
    ).reverse();
  }
  const [hasMoreBefore, latest, neighbors, welcomed] = await Promise.all([
    !after && rows.length ? client.townMessage.count({ where: { ...where, id: { lt: rows[0].id } } }).then((n) => n > 0) : false,
    client.townMessage.findFirst({ where, orderBy: { id: "desc" }, select: { createdAt: true } }),
    client.user.count({
      where: {
        status: "ACTIVE",
        OR: regionScopeOr(scope.regions),
        id: { notIn: [viewerId, ...blocked] },
      },
    }),
    welcomedUserIds(viewerId),
  ]);
  return {
    success: true,
    scope: { label: scope.label, radiusKm: NEIGHBOR_RADIUS_KM },
    messages: await toTownMessages(rows, viewerId),
    neighbors,
    quietMinutes: townQuietMinutes(latest?.createdAt.toISOString() ?? null),
    prompts,
    hasMoreBefore,
    welcomedUserIds: welcomed,
  };
}

export async function previewTownMessages(viewerId: number): Promise<TownPreviewResult> {
  const scoped = await scopeWhere(viewerId);
  if (!scoped) return { success: true, scope: null, messages: [], empty: true };
  const rows = (
    await client.townMessage.findMany({
      where: { ...scoped.where, deletedAt: null },
      select: messageSelect,
      orderBy: { id: "desc" },
      take: TOWN_PREVIEW_COUNT,
    })
  ).reverse();
  return {
    success: true,
    scope: { label: scoped.scope.label },
    messages: await toTownMessages(rows, viewerId),
    empty: rows.length === 0,
  };
}

export async function sendTownMessage({
  viewerId,
  type,
  body,
  image,
  productId,
  replyToId,
}: {
  viewerId: number;
  type: unknown;
  body: unknown;
  image?: unknown;
  productId?: unknown;
  replyToId?: unknown;
}): Promise<TownMessage> {
  const kind = type === "IMAGE" || type === "PRODUCT" ? type : "TEXT";
  const viewer = await client.user.findUnique({
    where: { id: viewerId },
    select: { regionSido: true, regionSigungu: true, name: true },
  });
  if (!viewer?.regionSido || !viewer.regionSigungu) {
    throw new TownError(409, "REGION_REQUIRED", "내 동네를 정하면 근처 이웃과 이야기할 수 있어요");
  }
  const text = typeof body === "string" ? body.trim() : "";
  if (text.length > TOWN_MESSAGE_MAX) {
    throw new TownError(400, "TOWN_MESSAGE_LENGTH", `${TOWN_MESSAGE_MAX}자까지 쓸 수 있어요`);
  }
  if (kind === "TEXT" && !text) throw new TownError(400, "TOWN_MESSAGE_EMPTY", "메시지를 입력해 주세요");
  const imageId = kind === "IMAGE" && typeof image === "string" && image.trim() ? image.trim() : null;
  if (kind === "IMAGE" && !imageId) throw new TownError(400, "TOWN_IMAGE_REQUIRED", "사진을 골라 주세요");
  let product: { id: number } | null = null;
  if (kind === "PRODUCT") {
    const id = Number(productId);
    product = Number.isInteger(id)
      ? await client.product.findFirst({ where: { id, userId: viewerId, isDeleted: false }, select: { id: true } })
      : null;
    if (!product) throw new TownError(400, "TOWN_PRODUCT_INVALID", "내 분양글만 보낼 수 있어요");
  }
  if (hasBlockedWord(text)) throw new TownError(400, "BLOCKED_WORD", BLOCKED_WORD_MESSAGE);

  const last = await client.townMessage.findFirst({
    where: { userId: viewerId },
    orderBy: { id: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < TOWN_RATE_SECONDS * 1000) {
    throw new TownError(429, "RATE_LIMIT", "조금 천천히 보내 주세요");
  }
  const todayCount = await client.townMessage.count({
    where: { userId: viewerId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (todayCount >= TOWN_DAILY_LIMIT) throw new TownError(429, "RATE_LIMIT", "오늘은 더 보낼 수 없어요");

  // 답장: 내 범위에서 보이는 메시지에만.
  let reply: { id: number; userId: number } | null = null;
  if (replyToId != null) {
    const scoped = await scopeWhere(viewerId);
    const id = Number(replyToId);
    reply =
      scoped && Number.isInteger(id)
        ? await client.townMessage.findFirst({ where: { ...scoped.where, id, deletedAt: null }, select: { id: true, userId: true } })
        : null;
    if (!reply) throw new TownError(404, "TOWN_REPLY_NOT_FOUND", "답장할 메시지를 찾을 수 없어요");
  }

  const masked = maskContactsInText(text);
  const created = await client.townMessage.create({
    data: {
      userId: viewerId,
      regionSido: viewer.regionSido,
      regionSigungu: viewer.regionSigungu,
      type: kind,
      body: masked.text || null,
      image: imageId,
      productId: product?.id ?? null,
      replyToId: reply?.id ?? null,
    },
    select: messageSelect,
  });
  if (reply && reply.userId !== viewerId) {
    await createNotification({
      type: "TOWN_REPLY",
      userId: reply.userId,
      senderId: viewerId,
      message: `${viewer.name}님이 사랑방에서 답장했어요 · ${(masked.text || townMessagePreview({ type: kind, body: null })).slice(0, 20)}`,
      targetId: created.id,
      targetType: "town",
    });
  }
  return (await toTownMessages([created], viewerId))[0];
}

export async function deleteTownMessage(viewerId: number, id: number, isModerator: boolean) {
  const message = await client.townMessage.findUnique({ where: { id }, select: { userId: true, deletedAt: true } });
  if (!message || message.deletedAt) throw new TownError(404, "TOWN_MESSAGE_NOT_FOUND", "메시지를 찾을 수 없어요");
  if (message.userId !== viewerId && !isModerator) throw new TownError(403, "TOWN_FORBIDDEN", "내 메시지만 지울 수 있어요");
  await client.townMessage.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** 반겨 주기: 그 사람의 가장 최근 메시지(내 범위)에 '○○님 반가워요!' 답장. 한 사람에게 한 번. */
export async function welcomeTownNeighbor(viewerId: number, targetUserId: number): Promise<TownMessage> {
  if (targetUserId === viewerId) throw new TownError(400, "TOWN_WELCOME_SELF", "나에게는 보낼 수 없어요");
  if ((await welcomedUserIds(viewerId)).includes(targetUserId)) {
    throw new TownError(409, "TOWN_ALREADY_WELCOMED", "이미 반겨 줬어요");
  }
  const scoped = await scopeWhere(viewerId);
  if (!scoped) throw new TownError(409, "REGION_REQUIRED", "내 동네를 정하면 근처 이웃과 이야기할 수 있어요");
  const target = await client.townMessage.findFirst({
    where: { ...scoped.where, userId: targetUserId, deletedAt: null },
    orderBy: { id: "desc" },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!target) throw new TownError(404, "TOWN_REPLY_NOT_FOUND", "반겨 줄 메시지를 찾을 수 없어요");
  return sendTownMessage({
    viewerId,
    type: "TEXT",
    body: townWelcomeMessage(target.user.name),
    replyToId: target.id,
  });
}
