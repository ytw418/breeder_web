import type { NotificationType, Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { getBlockedUserIds, getBlockRelation } from "@libs/server/blocks";
import { kindOfType, shouldPush } from "@libs/shared/notificationPrefs";

/**
 * 알림을 보낼지 정하는 서버 공통 관문(앱 docs/prd/notifications.md §알림 종류, 2026-10-21).
 * - 푸시: 받는 사람이 끈 종류·방해 금지 시간이면 보내지 않는다(User.notificationPrefs, 규칙은 libs/shared/notificationPrefs).
 * - 차단: 받는 사람이 차단한 사람이 일으킨 알림은 만들지 않고, 목록·안 읽은 수에서도 뺀다(운영 알림·경매 거래 알림 제외).
 * 조회에 실패하면 예전처럼 보낸다(알림은 부가 기능이라 설정을 못 읽었다고 막지 않는다).
 */

type PushType = NotificationType | string;

/** userId 에게 이 type 의 푸시를 보낼지. 운영 알림은 조회 없이 true. */
export async function shouldPushTo(userId: number, type: PushType, now: Date = new Date()): Promise<boolean> {
  if (kindOfType(type) === null) return true;
  try {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    return shouldPush(user?.notificationPrefs ?? null, type, now);
  } catch (error) {
    console.error("[notificationGate] prefs lookup failed:", error);
    return true;
  }
}

/** 여러 사람에게 보낼 때(채팅방·질문 알림): 한 번의 조회로 이 type 푸시를 받을 사람만 남긴다. */
export async function filterPushRecipients(
  userIds: number[],
  type: PushType,
  now: Date = new Date()
): Promise<number[]> {
  if (userIds.length === 0 || kindOfType(type) === null) return userIds;
  try {
    const rows = await client.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, notificationPrefs: true },
    });
    const prefsById = new Map(rows.map((row) => [row.id, row.notificationPrefs]));
    return userIds.filter((id) => shouldPush(prefsById.get(id) ?? null, type, now));
  } catch (error) {
    console.error("[notificationGate] prefs lookup failed:", error);
    return userIds;
  }
}

/**
 * 차단과 관계없이 만들고 목록에도 남기는 알림 type.
 * - 운영 알림(MODERATION): 보낸 사람이 운영자다.
 * - 경매 거래 흐름: 차단은 반응(좋아요·댓글·팔로우·찜·새 글 등)을 막으려는 것이고, 이미 걸린 입찰·낙찰은 알아야 한다.
 *   예) A 가 B 를 차단해도 제3자 경매에서 B 에게 밀린 OUTBID, 낙찰 뒤 서로 차단해도 AUCTION_WON·AUCTION_END 는 받는다.
 * createNotification 과 visibleNotificationWhere 가 이 목록 하나를 같이 쓴다.
 */
export const BLOCK_EXEMPT_NOTIFICATION_TYPES = [
  "MODERATION",
  "BID",
  "OUTBID",
  "AUCTION_WON",
  "AUCTION_END",
  "AUCTION_RESTARTED",
] as const satisfies readonly NotificationType[];

export function isBlockExemptType(type: PushType): boolean {
  return (BLOCK_EXEMPT_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

/** 받는 사람(receiverId)이 보낸 사람(senderId)을 차단했는지. 실패하면 false(예전처럼 보낸다). */
export async function isSenderBlockedByReceiver(receiverId: number, senderId: number): Promise<boolean> {
  if (receiverId === senderId) return false;
  try {
    return (await getBlockRelation(receiverId, senderId)).blockedByMe;
  } catch (error) {
    console.error("[notificationGate] block lookup failed:", error);
    return false;
  }
}

/**
 * 알림 목록·안 읽은 수 조건: 내가 차단한 사람이 보낸 알림은 뺀다.
 * BLOCK_EXEMPT_NOTIFICATION_TYPES(운영 알림·경매 거래 알림)는 차단과 관계없이 남긴다.
 */
export async function visibleNotificationWhere(userId: number): Promise<Prisma.NotificationWhereInput> {
  const blockedIds = await getBlockedUserIds(userId);
  if (blockedIds.length === 0) return { userId };
  return {
    userId,
    OR: [{ senderId: { notIn: blockedIds } }, { type: { in: [...BLOCK_EXEMPT_NOTIFICATION_TYPES] } }],
  };
}
