import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { BloodlineCardEventsResponse } from "@libs/shared/bloodline-card";
import { sendBloodlineError, sendResolvedBloodlineError } from "@libs/server/bloodline-error";
import {
  canSeeBloodlineEventNote,
  loadBloodlineVisibility,
  rootIdOf,
} from "@libs/server/bloodline-visibility";

/**
 * 혈통·출처 카드 이력(공개) — 설계 §3.4.
 * 사건의 사람(actor·from·to)은 상세와 같은 닉네임 비공개 규칙으로 가린다(뿌리 기준).
 * LINE_CREATED 는 그대로 내려 주고 화면이 숨긴다. 회수·숨김 카드는 404 BLOODLINE_REVOKED.
 * 출처 카드를 열었는데 그 뿌리가 숨김·회수여도 같다(상세·받은 사람과 같은 규칙).
 * 뿌리 혈통을 열면 그 아래 출처 카드의 LINE_TRANSFER("○○님이 다음 분에게 보냈어요", 시안 S3·S3')도 함께 준다.
 * 이 행의 메모(note)는 보유자끼리 주고받은 것이라 뿌리 이력에서는 비운다.
 * 보내기·넘기기 메모(LINE_ISSUED·LINE_TRANSFER·BLOODLINE_TRANSFER)는 그 사건의 당사자(보낸 사람·받은 사람)에게만 준다
 * (canSeeBloodlineEventNote). 시스템 문구(만들기·회수)는 공개다.
 */

const userSelect = { select: { id: true, name: true } } as const;

const parseCardId = (value: unknown): number | null => {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlineCardEventsResponse>
) {
  const cardId = parseCardId(req.query.id);
  if (!cardId) return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", { body: { events: [] } });

  const parsedLimit = Number(req.query.limit || "");
  const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 10 : Math.min(parsedLimit, 50);

  try {
    const card = await client.bloodlineCard.findUnique({
      where: { id: cardId },
      select: { id: true, cardType: true, bloodlineReferenceId: true, status: true },
    });
    if (!card) return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", { body: { events: [] } });
    if (card.status !== "ACTIVE") {
      return sendBloodlineError(res, "BLOODLINE_REVOKED", { body: { events: [] } });
    }
    const rootId = rootIdOf(card);
    if (rootId !== card.id) {
      const root = await client.bloodlineCard.findUnique({
        where: { id: rootId },
        select: { id: true, status: true },
      });
      if (!root) return sendBloodlineError(res, "BLOODLINE_NOT_FOUND", { body: { events: [] } });
      if (root.status !== "ACTIVE") {
        return sendBloodlineError(res, "BLOODLINE_REVOKED", { body: { events: [] } });
      }
    }
    const viewerId = req.user?.id ?? null;

    const childLineIds =
      card.cardType === "BLOODLINE"
        ? (
            await client.bloodlineCard.findMany({
              where: { cardType: "LINE", bloodlineReferenceId: card.id },
              select: { id: true },
            })
          ).map((line) => line.id)
        : [];

    const [visibility, events] = await Promise.all([
      loadBloodlineVisibility(rootId, viewerId),
      client.bloodlineCardEvent.findMany({
        where: childLineIds.length
          ? { OR: [{ cardId }, { cardId: { in: childLineIds }, action: "LINE_TRANSFER" }] }
          : { cardId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        include: { actorUser: userSelect, fromUser: userSelect, toUser: userSelect },
      }),
    ]);

    const relatedCardIds = Array.from(
      new Set(events.map((event) => event.relatedCardId).filter((id): id is number => id !== null))
    );
    const relatedCardMap = new Map<number, { id: number; name: string }>();
    if (relatedCardIds.length > 0) {
      const relatedCards = await client.bloodlineCard.findMany({
        where: { id: { in: relatedCardIds } },
        select: { id: true, name: true },
      });
      relatedCards.forEach((related) => relatedCardMap.set(related.id, { id: related.id, name: related.name }));
    }

    return res.json({
      success: true,
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        actorUser: visibility.present(event.actorUser),
        fromUser: visibility.present(event.fromUser),
        toUser: visibility.present(event.toUser),
        relatedCard: event.relatedCardId ? relatedCardMap.get(event.relatedCardId) ?? null : null,
        note:
          event.cardId === cardId && canSeeBloodlineEventNote(viewerId, event) ? event.note : null,
        createdAt: event.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[bloodline-cards][GET events]", error);
    return sendResolvedBloodlineError(res, error, "이력을 불러오지 못했어요", { events: [] });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
