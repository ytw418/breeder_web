import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { BloodlineCardEventsResponse } from "@libs/shared/bloodline-card";
import { resolveBloodlineApiError } from "@libs/server/bloodline-error";
import { ensureBloodlineSchema } from "@libs/server/bloodline-schema";
import { isCardOwner } from "@libs/server/bloodline-ownership";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlineCardEventsResponse>
) {
  const userId = req.session.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, events: [], error: "로그인이 필요합니다." });
  }

  const parsedCardId = Number(req.query.id);
  if (!parsedCardId || Number.isNaN(parsedCardId)) {
    return res
      .status(400)
      .json({ success: false, events: [], error: "유효한 혈통카드 ID가 필요합니다." });
  }

  const parsedLimit = Number(req.query.limit || "");
  const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 10 : Math.min(parsedLimit, 50);

  try {
    await ensureBloodlineSchema();
    const card = await client.bloodlineCard.findUnique({
      where: { id: parsedCardId },
      select: { creatorId: true, currentOwnerId: true, status: true },
    });

    if (!card || card.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        events: [],
        error: "카드를 찾을 수 없거나 비활성 상태입니다.",
      });
    }

    const isOwner = await isCardOwner(parsedCardId, userId);
    if (card.creatorId !== userId && !isOwner) {
      return res.status(403).json({
        success: false,
        events: [],
        error: "이 카드의 타임라인 조회 권한이 없습니다.",
      });
    }

    const events = await client.bloodlineCardEvent.findMany({
      where: { cardId: parsedCardId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        actorUser: { select: { id: true, name: true } },
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    });
    const relatedCardMap = new Map<number, { id: number; name: string }>();
    const relatedCardIds = Array.from(
      new Set(
        events
          .map((event) => event.relatedCardId)
          .filter((id): id is number => id !== null)
      )
    );

    if (relatedCardIds.length > 0) {
      const relatedCards = await client.bloodlineCard.findMany({
        where: { id: { in: relatedCardIds } },
        select: { id: true, name: true },
      });
      relatedCards.forEach((card) => {
        relatedCardMap.set(card.id, card);
      });
    }

    return res.json({
      success: true,
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        actorUser: event.actorUser,
        fromUser: event.fromUser,
        toUser: event.toUser,
        relatedCard: event.relatedCardId
          ? relatedCardMap.get(event.relatedCardId) ?? null
          : null,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const resolved = resolveBloodlineApiError(error, "이벤트 조회에 실패했습니다.");
    console.error("[bloodline-cards][GET events]", error);
    return res.status(resolved.status).json({
      success: false,
      events: [],
      error: resolved.message,
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
