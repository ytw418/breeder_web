import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { getBlockRelation } from "@libs/server/blocks";
import { createNotification } from "@libs/server/notification";
import { captureServerEvent } from "@libs/server/analytics";
import { addCardOwner } from "@libs/server/bloodline-ownership";
import { toBloodlineCardItem } from "@libs/server/bloodline-mapper";
import { sendBloodlineError, sendResolvedBloodlineError } from "@libs/server/bloodline-error";
import { isSameNickname } from "@libs/shared/nickname";
import type { BloodlineErrorCode } from "@libs/shared/bloodline-errors";
import type {
  BloodlineCardIssueLineResponse,
  BloodlineSendSource,
} from "@libs/shared/bloodline-card";

/**
 * POST /api/bloodline-cards/[id]/issue-line — 출처 카드 보내기(설계 §3.2).
 * - body: { toUserId?, toUserName?(receiverNickName·receiverName 별칭), note?, source? }. toUserId 가 있으면 먼저 쓴다.
 *   둘 다 보내면 같은 사람이어야 한다(다르면 404 BLOODLINE_RECEIVER_NOT_FOUND, 조작한 링크 방지).
 *   구 클라이언트의 name·description·image 는 받되 무시한다.
 * - 뿌리 혈통(BLOODLINE)의 지금 보유자(currentOwnerId)만 보낼 수 있다. 받는 사람은 필수이고 나 자신은 안 된다.
 * - 출처 카드 이름은 뿌리 혈통 이름을 그대로 쓴다(이름 중복·패턴 검사 없음). 출처 카드는 parentCardId + currentOwnerId 로
 *   식별하므로, 같은 사람이 이미 이 혈통의 출처 카드를 가지고 있을 때만 409 BLOODLINE_ALREADY_SENT 다.
 * - 받음 알림(BLOODLINE_RECEIVED)과 계측(bloodline_sent)은 Serializable 트랜잭션이 끝난 뒤 보낸다
 *   (트랜잭션 안에서 푸시를 기다리지 않는다).
 */

const NOTE_MAX_LENGTH = 300;
const SEND_SOURCE_TYPES: ReadonlyArray<BloodlineSendSource["type"]> = ["chat", "search", "auction"];
const userSelect = { select: { id: true, name: true } } as const;

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
  res: NextApiResponse<BloodlineCardIssueLineResponse>
) {
  const fail = (errorCode: BloodlineErrorCode) =>
    sendBloodlineError(res, errorCode, { body: { card: null } });

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
    // 카드부터 본다: 없는 혈통이면 body 와 무관하게 404 BLOODLINE_NOT_FOUND(배포 확인 AC-115 가 이 응답을 쓴다)
    const source = await client.bloodlineCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        cardType: true,
        name: true,
        image: true,
        speciesType: true,
        originSido: true,
        originSigungu: true,
        status: true,
        currentOwnerId: true,
      },
    });
    if (!source) return fail("BLOODLINE_NOT_FOUND");
    if (source.status !== "ACTIVE") return fail("BLOODLINE_REVOKED");
    // 출처 카드로는 보낼 수 없고, 만든 사람이라도 넘긴 뒤에는 보낼 수 없다
    if (source.cardType !== "BLOODLINE" || source.currentOwnerId !== userId) {
      return fail("BLOODLINE_FORBIDDEN");
    }

    if (!toUserId && !toUserName) return fail("BLOODLINE_RECEIVER_REQUIRED");
    const receiver = await client.user.findUnique({
      where: toUserId ? { id: toUserId } : { name: toUserName },
      select: { id: true, name: true, status: true },
    });
    if (!receiver) return fail("BLOODLINE_RECEIVER_NOT_FOUND");
    // id 와 닉네임을 함께 보냈으면 같은 사람이어야 한다(조작한 링크로 다른 사람에게 보내지지 않게)
    if (toUserId && toUserName && !isSameNickname(receiver.name, toUserName)) {
      return fail("BLOODLINE_RECEIVER_NOT_FOUND");
    }
    if (receiver.id === userId) return fail("BLOODLINE_RECEIVER_SELF");
    if (receiver.status !== "ACTIVE") return fail("BLOODLINE_RECEIVER_INACTIVE");

    const relation = await getBlockRelation(userId, receiver.id);
    if (relation.blockedByMe || relation.blockedMe) return fail("BLOODLINE_BLOCKED");

    const result = await client.$transaction(
      async (tx) => {
        const alreadySent = await tx.bloodlineCard.findFirst({
          where: {
            cardType: "LINE",
            parentCardId: source.id,
            currentOwnerId: receiver.id,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (alreadySent) return "already-sent" as const;

        // 첫 쓰기: 지금도 내가 보유한 ACTIVE 혈통일 때만 보낸 수를 올린다(그 사이 넘겼으면 0건 → 아무것도 쓰지 않고 끝낸다)
        const claimed = await tx.bloodlineCard.updateMany({
          where: { id: source.id, cardType: "BLOODLINE", status: "ACTIVE", currentOwnerId: userId },
          data: { issueCount: { increment: 1 } },
        });
        if (claimed.count === 0) return "forbidden" as const;

        const created = await tx.bloodlineCard.create({
          data: {
            cardType: "LINE",
            name: source.name,
            description: note,
            image: source.image,
            speciesType: source.speciesType,
            originSido: source.originSido,
            originSigungu: source.originSigungu,
            bloodlineReferenceId: source.id,
            parentCardId: source.id,
            creatorId: userId,
            currentOwnerId: receiver.id,
            transferPolicy: "NONE",
            ownerNameVisible: false,
          },
          include: { creator: userSelect, currentOwner: userSelect },
        });

        await addCardOwner(tx, created.id, receiver.id);

        await tx.bloodlineCardEvent.create({
          data: {
            cardId: source.id,
            action: "LINE_ISSUED",
            actorUserId: userId,
            toUserId: receiver.id,
            relatedCardId: created.id,
            note,
          },
        });
        // 이력 화면에서는 숨기는 사건(클라이언트가 거른다)
        await tx.bloodlineCardEvent.create({
          data: {
            cardId: created.id,
            action: "LINE_CREATED",
            actorUserId: userId,
            toUserId: receiver.id,
            note: null,
          },
        });

        return created;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );

    if (result === "already-sent") return fail("BLOODLINE_ALREADY_SENT");
    if (result === "forbidden") return fail("BLOODLINE_FORBIDDEN");

    // 트랜잭션 밖. 둘 다 실패해도 보내기는 이미 끝났으므로 응답을 막지 않는다.
    const senderName = result.creator?.name || req.user?.name || "브리더";
    await Promise.allSettled([
      createNotification({
        type: "BLOODLINE_RECEIVED",
        userId: receiver.id,
        senderId: userId,
        message: `${senderName}님이 ${result.name} 출처 카드를 보냈어요`,
        targetType: "bloodline",
        targetId: result.id,
      }),
      captureServerEvent(userId, "bloodline_sent", {
        bloodline_id: source.id,
        card_id: result.id,
        mode: "issue",
        via,
        auction_id: auctionId,
      }),
    ]);

    return res.json({ success: true, card: toBloodlineCardItem(result, { viewerId: userId }) });
  } catch (error) {
    console.error("[bloodline-cards][POST issue-line]", error);
    return sendResolvedBloodlineError(res, error, "출처 카드를 보내지 못했어요", { card: null });
  }
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
