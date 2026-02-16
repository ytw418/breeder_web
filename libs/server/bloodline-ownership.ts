import { Prisma } from "@prisma/client";
import client from "@libs/server/client";

type BloodlineOwnerRow = {
  bloodlineCardId: number;
};

type CardOwnershipExistsRow = {
  exists: boolean;
};

const isDefined = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

export const fetchOwnedCardIds = async (userId: number): Promise<Set<number>> => {
  const rows = await client.$queryRaw<BloodlineOwnerRow[]>`
    SELECT "bloodlineCardId"
    FROM "BloodlineCardOwner"
    WHERE "userId" = ${userId}
  `;

  const fallbackRows = await client.bloodlineCard.findMany({
    where: { currentOwnerId: userId },
    select: { id: true },
  });

  return new Set(
    [...rows.map((row) => row.bloodlineCardId), ...fallbackRows.map((row) => row.id)]
  );
};

export const isCardOwner = async (cardId: number, userId: number): Promise<boolean> => {
  const rows = await client.$queryRaw<CardOwnershipExistsRow[]>`
    SELECT EXISTS (
      SELECT 1
      FROM "BloodlineCardOwner"
      WHERE "bloodlineCardId" = ${cardId}
        AND "userId" = ${userId}
    ) AS exists
  `;

  const fallback = await client.bloodlineCard.findFirst({
    where: {
      id: cardId,
      currentOwnerId: userId,
    },
    select: { id: true },
  });

  return !!rows[0]?.exists || isDefined(fallback?.id);
};

export const addCardOwner = async (
  tx: typeof client | Prisma.TransactionClient,
  cardId: number,
  userId: number
): Promise<void> => {
  await tx.$executeRaw`
    INSERT INTO "BloodlineCardOwner" ("bloodlineCardId", "userId")
    VALUES (${cardId}, ${userId})
    ON CONFLICT ("bloodlineCardId", "userId") DO NOTHING
  `;
};
