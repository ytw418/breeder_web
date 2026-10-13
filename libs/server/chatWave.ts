import { Prisma } from "@prisma/client";

import client from "@libs/server/client";
import { captureServerEvent, type ClientPlatform } from "@libs/server/analytics";
import { assertCanChat } from "@libs/server/blocks";
import { findOrCreateDirectRoom } from "@libs/server/chatRoom";
import { getViewerRegionScope } from "@libs/server/nearby";
import { sendAllPushToUsers } from "@libs/server/pushGateway";
import { kstDate } from "@libs/server/kstDate";
import { regionScopeOr } from "@libs/shared/regionScope";
import { WAVE_DAILY_LIMIT, wavePresetText, type WaveErrorCode } from "@libs/shared/chatWave";

export type SendWaveResult =
  | { ok: true; chatRoomId: number; messageId: number; wavesLeftToday: number }
  | { ok: false; status: number; errorCode: WaveErrorCode | string; error?: string; chatRoomId?: number; wavesLeftToday?: number };

/**
 * 동네 브리더에게 인사 문구 하나를 채팅으로 보낸다(방이 없으면 만든다).
 * 한도·중복은 보낸 사람 단위 advisory lock 안에서 다시 세어 동시 요청에도 하루 10명을 넘지 않게 한다.
 */
export async function sendWave({
  senderId,
  otherId,
  presetId,
  platform,
  now = new Date(),
}: {
  senderId: number;
  otherId: number;
  presetId: unknown;
  platform: ClientPlatform;
  now?: Date;
}): Promise<SendWaveResult> {
  if (!Number.isInteger(otherId) || otherId <= 0) return { ok: false, status: 400, errorCode: "WAVE_BAD_PRESET" };
  if (senderId === otherId) return { ok: false, status: 400, errorCode: "WAVE_SELF" };
  const text = wavePresetText(presetId);
  if (!text) return { ok: false, status: 400, errorCode: "WAVE_BAD_PRESET" };

  const canChat = await assertCanChat(senderId, otherId);
  if (!canChat.ok) return { ok: false, status: canChat.status, errorCode: canChat.errorCode, error: canChat.error };

  // 동네 범위 안에서 동네 노출을 켠 브리더에게만(낯선 사람에게 DM 을 뿌리는 통로가 되지 않게).
  const scope = await getViewerRegionScope(senderId);
  const neighbor = scope
    ? await client.user.findFirst({
        where: { id: otherId, status: "ACTIVE", regionVisible: true, OR: regionScopeOr(scope.regions) },
        select: { id: true },
      })
    : null;
  if (!neighbor) return { ok: false, status: 403, errorCode: "WAVE_NOT_NEARBY" };

  const day = kstDate(now);
  const [already, sentToday] = await Promise.all([
    client.chatWave.findUnique({
      where: { senderId_recipientId: { senderId, recipientId: otherId } },
      select: { chatRoomId: true },
    }),
    client.chatWave.count({ where: { senderId, day } }),
  ]);
  if (already) return { ok: false, status: 409, errorCode: "WAVE_ALREADY", chatRoomId: already.chatRoomId };
  if (sentToday >= WAVE_DAILY_LIMIT) return { ok: false, status: 429, errorCode: "WAVE_LIMIT", wavesLeftToday: 0 };

  const room = await findOrCreateDirectRoom(senderId, otherId, platform);

  let outcome: { messageId: number; left: number } | "limit" | "already";
  try {
    outcome = await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('chat_wave'), ${senderId}::int)`;
      const count = await tx.chatWave.count({ where: { senderId, day } });
      if (count >= WAVE_DAILY_LIMIT) return "limit" as const;
      await tx.chatWave.create({
        data: { senderId, recipientId: otherId, chatRoomId: room.id, presetId: String(presetId), day },
      });
      const message = await tx.message.create({
        data: { type: "TEXT", message: text, chatRoomId: room.id, userId: senderId },
        select: { id: true },
      });
      await tx.chatRoom.update({ where: { id: room.id }, data: { updatedAt: now } });
      return { messageId: message.id, left: WAVE_DAILY_LIMIT - count - 1 };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") outcome = "already";
    else throw error;
  }
  if (outcome === "limit") return { ok: false, status: 429, errorCode: "WAVE_LIMIT", wavesLeftToday: 0 };
  if (outcome === "already") return { ok: false, status: 409, errorCode: "WAVE_ALREADY", chatRoomId: room.id };

  const sender = await client.user.findUnique({ where: { id: senderId }, select: { name: true } });
  sendAllPushToUsers([otherId], {
    title: "👋 동네 브리더의 인사",
    body: `${sender?.name ?? "동네 브리더"}님: ${text}`,
    url: `/chat/${room.id}`,
    tag: `chat-${room.id}`,
  }).catch((error) => console.error("Failed to send wave push:", error));
  await captureServerEvent(senderId, "chat_wave_sent", {
    chat_room_id: room.id,
    other_user_id: otherId,
    preset_id: String(presetId),
    room_created: room.created,
    platform,
  });

  return { ok: true, chatRoomId: room.id, messageId: outcome.messageId, wavesLeftToday: outcome.left };
}
