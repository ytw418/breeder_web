import client from "@libs/server/client";
import { captureServerEvent, type ClientPlatform } from "@libs/server/analytics";

/**
 * 두 사람의 1:1 채팅방을 찾고, 없으면 만든다(POST /api/chat·/api/chat/wave 공용).
 * 새로 만들었을 때만 chat_room_created 를 남긴다. 차단·탈퇴 확인(assertCanChat)은 부르는 쪽이 먼저 한다.
 */
export async function findOrCreateDirectRoom(
  userId: number,
  otherId: number,
  platform: ClientPlatform
): Promise<{ id: number; created: boolean }> {
  const existing = await client.chatRoom.findFirst({
    where: {
      AND: [
        { chatRoomMembers: { some: { userId } } },
        { chatRoomMembers: { some: { userId: otherId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const room = await client.chatRoom.create({
    data: {
      chatRoomMembers: {
        createMany: { data: [{ userId }, { userId: otherId }] },
      },
    },
    select: { id: true },
  });
  await captureServerEvent(userId, "chat_room_created", {
    chat_room_id: room.id,
    other_user_id: otherId,
    platform,
  });
  return { id: room.id, created: true };
}

/**
 * 채팅방 알림을 끄지 않은 사람만 남긴다(채팅방 알림 끄기, 앱 docs/prd/chat-room-settings.md).
 * 새 메시지·인사 푸시를 보내기 직전에 거른다.
 */
export async function withoutMutedMembers(chatRoomId: number, userIds: number[]): Promise<number[]> {
  if (userIds.length === 0) return [];
  const muted = await client.chatRoomMember.findMany({
    where: { chatRoomId, userId: { in: userIds }, mutedAt: { not: null } },
    select: { userId: true },
  });
  const mutedIds = new Set(muted.map((member) => member.userId));
  return userIds.filter((id) => !mutedIds.has(id));
}

/**
 * 이 시각 뒤 메시지만 '안 읽음'으로 센다. 나간 방은 나간 시각 전 메시지를 세지 않는다.
 * 둘 다 없으면 null(처음부터 센다).
 */
export function unreadSince(member: { lastReadAt: Date | null; leftAt: Date | null }): Date | null {
  const { lastReadAt, leftAt } = member;
  if (lastReadAt && leftAt) return lastReadAt > leftAt ? lastReadAt : leftAt;
  return lastReadAt ?? leftAt;
}
