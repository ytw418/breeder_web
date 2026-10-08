import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { getBlockRelation } from "@libs/server/blocks";
import { createNotification } from "@libs/server/notification";
import { captureServerEvent } from "@libs/server/analytics";
import { replaceCardOwner } from "@libs/server/bloodline-ownership";
import { sendBloodlineError, sendResolvedBloodlineError } from "@libs/server/bloodline-error";
import { rootIdOf } from "@libs/server/bloodline-visibility";
import { isSameNickname } from "@libs/shared/nickname";
import type { BloodlineErrorCode } from "@libs/shared/bloodline-errors";
import type {
  BloodlineCardTransferResponse,
  BloodlineSendSource,
} from "@libs/shared/bloodline-card";

/**
 * POST /api/bloodline-cards/[id]/transfer — 카드 자체를 넘긴다(설계 §3.3).
 * 뿌리 혈통이면 "혈통 넘기기", 출처 카드면 "다음 분에게 보내기"다.
 * - body: { toUserId?, toUserName?(receiverNickName·receiverName 별칭), note?, source? }. body 의 cardId 는 무시한다.
 *   toUserId·toUserName 을 함께 보내면 같은 사람이어야 한다(다르면 404 BLOODLINE_RECEIVER_NOT_FOUND).
 *   링크로 미리 채운 닉네임과 실제 받는 사람이 다른 채로 넘어가지 않게 하려는 것이다.
 * - 권한은 currentOwnerId 하나다. 넘긴 뒤 이전 보유자는 만든 사람이어도 다시 넘길 수 없다.
 * - 출처 카드는 뿌리 혈통이 ACTIVE 일 때만 넘긴다(숨김·회수면 404 BLOODLINE_REVOKED, 상세·이력과 같은 규칙).
 * - 출처 카드면 닉네임 공개(ownerNameVisible)를 끈다(새 보유자가 직접 켠다). 보유자 거울 행은 replaceCardOwner.
 * - 받음 알림(BLOODLINE_RECEIVED)과 계측(bloodline_sent)은 트랜잭션이 끝난 뒤 보낸다.
 */

const NOTE_MAX_LENGTH = 300;
const SEND_SOURCE_TYPES: ReadonlyArray<BloodlineSendSource["type"]> = ["chat", "search", "auction"];

const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** 계측용 경로. 모르는 값이면 null. */
const parseSendSource = (value: unknown) => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const via = SEND_SOURCE_TYPES.find((type) => type === source.type) ?? null;
  return { via, auctionId: parsePositiveInt(source.auctionId) };
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlineCardTransferResponse>
) {
  const fail = (errorCode: BloodlineErrorCode) => sendBloodlineError(res, errorCode);

  const userId = req.user?.id;
  if (!userId) return fail("BLOODLINE_AUTH_REQUIRED");

  const cardId = parsePositiveInt(req.query.id);
  if (!cardId) return fail("BLOODLINE_NOT_FOUND");

  const body = (req.body ?? {}) as Record<string, unknown>;
  const toUserId = parsePositiveInt(body.toUserId);
  const toUserName =
    [body.toUserName, body.receiverNickName, body.receiverName].map(parseText).find(Boolean) ?? "";
  const note = parseText(body.note).slice(0, NOTE_MAX_LENGTH) || null;
  const { via, auctionId } = parseSendSource(body.source);

  try {
    const card = await client.bloodlineCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        cardType: true,
        name: true,
        status: true,
        currentOwnerId: true,
        bloodlineReferenceId: true,
      },
    });
    if (!card) return fail("BLOODLINE_NOT_FOUND");
    if (card.status !== "ACTIVE") return fail("BLOODLINE_REVOKED");
    if (card.currentOwnerId !== userId) return fail("BLOODLINE_FORBIDDEN");

    const isBloodline = card.cardType === "BLOODLINE";
    // 출처 카드: 뿌리가 숨김·회수면 넘기지 않는다(숨긴 혈통 이름이 새 사람에게 알림으로 가지 않게)
    const rootId = isBloodline ? null : rootIdOf(card);
    const readRootStatus = async (db: typeof client | Prisma.TransactionClient) =>
      rootId === null
        ? "ACTIVE"
        : (
            await db.bloodlineCard.findUnique({ where: { id: rootId }, select: { status: true } })
          )?.status ?? null;
    if (rootId !== null) {
      const rootStatus = await readRootStatus(client);
      if (!rootStatus) return fail("BLOODLINE_NOT_FOUND");
      if (rootStatus !== "ACTIVE") return fail("BLOODLINE_REVOKED");
    }

    if (!toUserId && !toUserName) return fail("BLOODLINE_RECEIVER_REQUIRED");
    const receiver = await client.user.findUnique({
      where: toUserId ? { id: toUserId } : { name: toUserName },
      select: { id: true, name: true, status: true },
    });
    if (!receiver) return fail("BLOODLINE_RECEIVER_NOT_FOUND");
    // id 와 닉네임을 함께 보냈으면 같은 사람이어야 한다(조작한 링크로 다른 사람에게 넘어가지 않게)
    if (toUserId && toUserName && !isSameNickname(receiver.name, toUserName)) {
      return fail("BLOODLINE_RECEIVER_NOT_FOUND");
    }
    if (receiver.id === userId) return fail("BLOODLINE_RECEIVER_SELF");
    if (receiver.status !== "ACTIVE") return fail("BLOODLINE_RECEIVER_INACTIVE");

    const relation = await getBlockRelation(userId, receiver.id);
    if (relation.blockedByMe || relation.blockedMe) return fail("BLOODLINE_BLOCKED");

    const result = await client.$transaction(async (tx) => {
      // 쓰기 전에 뿌리 상태를 한 번 더 본다(검사 뒤 숨김·회수가 먼저 끝난 경우). 아직 아무것도 쓰지 않았으니 그냥 끝낸다
      if (rootId !== null && (await readRootStatus(tx)) !== "ACTIVE") return "revoked" as const;

      // 첫 쓰기: 지금도 내가 보유한 ACTIVE 카드일 때만 옮긴다(동시에 넘긴 경우 0건 → 아무것도 쓰지 않고 끝낸다)
      const moved = await tx.bloodlineCard.updateMany({
        where: { id: card.id, status: "ACTIVE", currentOwnerId: userId },
        data: {
          currentOwnerId: receiver.id,
          transferCount: { increment: 1 },
          ...(isBloodline ? {} : { ownerNameVisible: false }),
        },
      });
      if (moved.count === 0) return "forbidden" as const;

      const transferRow = await tx.bloodlineCardTransfer.create({
        data: { cardId: card.id, fromUserId: userId, toUserId: receiver.id, note },
        select: { fromUser: { select: { name: true } } },
      });

      await replaceCardOwner(tx, card.id, receiver.id);

      await tx.bloodlineCardEvent.create({
        data: {
          cardId: card.id,
          action: isBloodline ? "BLOODLINE_TRANSFER" : "LINE_TRANSFER",
          actorUserId: userId,
          fromUserId: userId,
          toUserId: receiver.id,
          note,
        },
      });

      return { senderName: transferRow.fromUser?.name ?? null };
    });

    if (result === "forbidden") return fail("BLOODLINE_FORBIDDEN");
    if (result === "revoked") return fail("BLOODLINE_REVOKED");

    // 트랜잭션 밖. 둘 다 실패해도 넘기기는 이미 끝났으므로 응답을 막지 않는다.
    const senderName = result.senderName || req.user?.name || "브리더";
    await Promise.allSettled([
      createNotification({
        type: "BLOODLINE_RECEIVED",
        userId: receiver.id,
        senderId: userId,
        message: isBloodline
          ? `${senderName}님이 ${card.name} 혈통을 넘겼어요`
          : `${senderName}님이 ${card.name} 출처 카드를 보냈어요`,
        targetType: "bloodline",
        targetId: card.id,
      }),
      captureServerEvent(userId, "bloodline_sent", {
        bloodline_id: isBloodline ? card.id : card.bloodlineReferenceId,
        card_id: card.id,
        card_type: card.cardType,
        mode: "transfer",
        via,
        auction_id: auctionId,
      }),
    ]);

    return res.json({ success: true });
  } catch (error) {
    console.error("[bloodline-cards][POST transfer]", error);
    return sendResolvedBloodlineError(res, error, "카드를 넘기지 못했어요");
  }
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
