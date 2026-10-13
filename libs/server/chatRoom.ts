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
