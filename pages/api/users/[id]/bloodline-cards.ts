import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import {
  BloodlineCardItem,
  BloodlineCardTransferItem,
  BloodlineCardVisualStyle,
} from "@libs/shared/bloodline-card";

type ProfileCardRow = {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  cardType: string;
  speciesType: string | null;
  bloodlineReferenceId: number | null;
  parentCardId: number | null;
  status: string;
  transferPolicy: string;
  issueCount: number;
  transferCount: number;
  visualStyle: string | null;
  creatorId: number | null;
  currentOwnerId: number | null;
  creatorName: string | null;
  currentOwnerName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const VALID_VISUAL_STYLES: readonly BloodlineCardVisualStyle[] = [
  "noir",
  "clean",
  "editorial",
];

const VALID_CARD_TYPES = ["BLOODLINE", "LINE"] as const;
const VALID_TRANSFER_POLICIES = [
  "NONE",
  "ONE_TIME",
  "LIMITED_CHAIN",
  "LIMITED_COUNT",
  "VERIFIED_ONLY",
] as const;
const VALID_STATUSES = ["ACTIVE", "INACTIVE", "REVOKED"] as const;

const normalizeVisualStyle = (value: string | null): BloodlineCardVisualStyle => {
  return (VALID_VISUAL_STYLES as readonly string[]).includes(String(value))
    ? (value as BloodlineCardVisualStyle)
    : "noir";
};

const isValidCardType = (value: string): value is "BLOODLINE" | "LINE" => {
  return (VALID_CARD_TYPES as readonly string[]).includes(value);
};

const isValidStatus = (
  value: string
): value is "ACTIVE" | "INACTIVE" | "REVOKED" => {
  return (VALID_STATUSES as readonly string[]).includes(value);
};

const isValidTransferPolicy = (
  value: string
): value is
  | "NONE"
  | "ONE_TIME"
  | "LIMITED_CHAIN"
  | "LIMITED_COUNT"
  | "VERIFIED_ONLY" => {
  return (VALID_TRANSFER_POLICIES as readonly string[]).includes(value);
};

export interface UserBloodlineCardsResponse {
  success: boolean;
  cards: BloodlineCardItem[];
}

const toCardItem = (card: ProfileCardRow): BloodlineCardItem => ({
  id: card.id,
  name: card.name,
  description: card.description,
  image: card.image,
  cardType: isValidCardType(card.cardType) ? card.cardType : "BLOODLINE",
  speciesType: card.speciesType,
  bloodlineReferenceId: card.bloodlineReferenceId,
  parentCardId: card.parentCardId,
  status: isValidStatus(card.status) ? card.status : "ACTIVE",
  transferPolicy: isValidTransferPolicy(card.transferPolicy) ? card.transferPolicy : "NONE",
  issueCount: card.issueCount,
  transferCount: card.transferCount,
  creator: {
    id: card.creatorId ?? 0,
    name: card.creatorName || "탈퇴한 사용자",
  },
  currentOwner: {
    id: card.currentOwnerId ?? 0,
    name: card.currentOwnerName || "탈퇴한 사용자",
  },
  createdAt: card.createdAt.toISOString(),
  updatedAt: card.updatedAt.toISOString(),
  visualStyle: normalizeVisualStyle(card.visualStyle),
  transfers: [] as BloodlineCardTransferItem[],
});

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType | UserBloodlineCardsResponse>
) {
  const {
    query: { id },
  } = req;

  const userId = Number(id);
  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ success: false, error: "사용자 ID가 필요합니다." });
  }

  if (req.method !== "GET") {
    return;
  }

  const cards = await client.$queryRaw<ProfileCardRow[]>`
    SELECT
      bc.id,
      bc.name,
      bc.description,
      bc.image,
      bc."cardType",
      bc."speciesType",
      bc."bloodlineReferenceId",
      bc."parentCardId",
      bc.status,
      bc."transferPolicy",
      bc."issueCount",
      bc."transferCount",
      bc."visualStyle",
      bc."creatorId",
      bc."currentOwnerId",
      cu.name AS "creatorName",
      co.name AS "currentOwnerName",
      bc."createdAt",
      bc."updatedAt"
    FROM "BloodlineCard" bc
    LEFT JOIN "User" cu ON cu.id = bc."creatorId"
    LEFT JOIN "User" co ON co.id = bc."currentOwnerId"
    WHERE (bc."creatorId" = ${userId} OR bc."currentOwnerId" = ${userId})
      AND bc.status = 'ACTIVE'
    ORDER BY bc."updatedAt" DESC
  `;

  return res.json({
    success: true,
    cards: cards.map(toCardItem),
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
);
