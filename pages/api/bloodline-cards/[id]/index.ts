import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { ensureBloodlineSchema } from "@libs/server/bloodline-schema";
import {
  BloodlineCardDetailResponse,
  BloodlineCardItem,
  BloodlineCardVisualStyle,
} from "@libs/shared/bloodline-card";

type RawVisualStyleRow = { id: number; visualStyle: string | null };

const bloodlineVisualStyles = ["noir", "clean", "editorial"] as const;

const isVisualStyle = (value: unknown): value is BloodlineCardVisualStyle =>
  typeof value === "string" &&
  (bloodlineVisualStyles as readonly string[]).includes(value);

const normalizeVisualStyle = (value: unknown): BloodlineCardVisualStyle =>
  isVisualStyle(value) ? value : "noir";

const includeWithTransfers = {
  creator: { select: { id: true, name: true } },
  currentOwner: { select: { id: true, name: true } },
  transfers: {
    orderBy: { createdAt: "desc" } as const,
    take: 5,
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
    },
  },
};

const fetchVisualStyles = async (cardIds: number[]) => {
  if (!cardIds.length) return new Map<number, BloodlineCardVisualStyle>();
  const rows = await client.$queryRaw<RawVisualStyleRow[]>`
    SELECT id, "visualStyle"
    FROM "BloodlineCard"
    WHERE id IN (${Prisma.join(cardIds)})
  `;

  return rows.reduce((acc, row) => {
    acc.set(row.id, normalizeVisualStyle(row.visualStyle));
    return acc;
  }, new Map<number, BloodlineCardVisualStyle>());
};

const toCardItem = (
  card: {
    id: number;
    name: string;
    description: string | null;
    image: string | null;
    cardType: "BLOODLINE" | "LINE";
    speciesType: string | null;
    bloodlineReferenceId: number | null;
    parentCardId: number | null;
    status: "ACTIVE" | "INACTIVE" | "REVOKED";
    transferPolicy: "NONE" | "ONE_TIME" | "LIMITED_CHAIN" | "LIMITED_COUNT" | "VERIFIED_ONLY";
    issueCount: number;
    transferCount: number;
    creator: { id: number; name: string };
    currentOwner: { id: number; name: string };
    createdAt: Date;
    updatedAt: Date;
    transfers: Array<{
      id: number;
      fromUser: { id: number; name: string } | null;
      toUser: { id: number; name: string };
      note: string | null;
      createdAt: Date;
    }>;
  },
  visualStyleMap: Map<number, BloodlineCardVisualStyle>,
  userId?: number
): BloodlineCardItem => ({
  id: card.id,
  name: card.name,
  description: card.description,
  image: card.image,
  cardType: card.cardType,
  speciesType: card.speciesType,
  bloodlineReferenceId: card.bloodlineReferenceId,
  parentCardId: card.parentCardId,
  status: card.status,
  transferPolicy: card.transferPolicy,
  issueCount: card.issueCount,
  transferCount: card.transferCount,
  creator: card.creator,
  currentOwner: card.currentOwner,
  isOwnedByMe: Boolean(userId && card.currentOwner.id === userId),
  createdAt: card.createdAt.toISOString(),
  updatedAt: card.updatedAt.toISOString(),
  transfers: card.transfers.map((transfer) => ({
    id: transfer.id,
    fromUser: transfer.fromUser,
    toUser: transfer.toUser,
    note: transfer.note,
    createdAt: transfer.createdAt.toISOString(),
  })),
  visualStyle: visualStyleMap.get(card.id),
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BloodlineCardDetailResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      card: null,
      bloodlineSourceCard: null,
      parentLineCard: null,
      error: "허용되지 않은 메서드입니다.",
    });
  }

  const cardId = Number(req.query.id);
  if (!cardId) {
    return res.status(400).json({
      success: false,
      card: null,
      bloodlineSourceCard: null,
      parentLineCard: null,
      error: "유효하지 않은 카드 ID입니다.",
    });
  }

  try {
    await ensureBloodlineSchema();
    const userId = req.session.user?.id;
    const card = await client.bloodlineCard.findFirst({
      where: { id: cardId, status: "ACTIVE" },
      include: includeWithTransfers,
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        card: null,
        bloodlineSourceCard: null,
        parentLineCard: null,
        error: "카드를 찾을 수 없습니다.",
      });
    }

    const relatedIds = [card.id, card.bloodlineReferenceId, card.parentCardId].filter(
      (value): value is number => Boolean(value)
    );

    const [visualStyleMap, bloodlineSourceCard, parentLineCard] = await Promise.all([
      fetchVisualStyles(relatedIds),
      card.bloodlineReferenceId
        ? client.bloodlineCard.findFirst({
            where: { id: card.bloodlineReferenceId, status: "ACTIVE" },
            include: includeWithTransfers,
          })
        : Promise.resolve(null),
      card.parentCardId
        ? client.bloodlineCard.findFirst({
            where: { id: card.parentCardId, status: "ACTIVE" },
            include: includeWithTransfers,
          })
        : Promise.resolve(null),
    ]);

    return res.json({
      success: true,
      card: toCardItem(card, visualStyleMap, userId),
      bloodlineSourceCard: bloodlineSourceCard
        ? toCardItem(bloodlineSourceCard, visualStyleMap, userId)
        : null,
      parentLineCard: parentLineCard
        ? toCardItem(parentLineCard, visualStyleMap, userId)
        : null,
    });
  } catch (error) {
    console.error("[bloodline-cards][detail][GET]", error);
    return res.status(500).json({
      success: false,
      card: null,
      bloodlineSourceCard: null,
      parentLineCard: null,
      error: "카드 정보를 불러오지 못했습니다.",
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
