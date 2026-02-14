import client from "@libs/server/client";

let ensureSchemaPromise: Promise<void> | null = null;

async function runEnsureSchema() {
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BloodlineCard" (
      "id" SERIAL NOT NULL,
      "creatorId" INTEGER NOT NULL,
      "currentOwnerId" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "image" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "BloodlineCard_pkey" PRIMARY KEY ("id")
    );
  `);

  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BloodlineCardTransfer" (
      "id" SERIAL NOT NULL,
      "cardId" INTEGER NOT NULL,
      "fromUserId" INTEGER,
      "toUserId" INTEGER NOT NULL,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BloodlineCardTransfer_pkey" PRIMARY KEY ("id")
    );
  `);

  await client.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "BloodlineCard_creatorId_key" ON "BloodlineCard"("creatorId");'
  );
  await client.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "BloodlineCard_currentOwnerId_createdAt_idx" ON "BloodlineCard"("currentOwnerId", "createdAt");'
  );
  await client.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "BloodlineCardTransfer_cardId_createdAt_idx" ON "BloodlineCardTransfer"("cardId", "createdAt");'
  );
  await client.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "BloodlineCardTransfer_toUserId_createdAt_idx" ON "BloodlineCardTransfer"("toUserId", "createdAt");'
  );
}

export async function ensureBloodlineSchema() {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = runEnsureSchema().catch((error) => {
      ensureSchemaPromise = null;
      throw error;
    });
  }

  await ensureSchemaPromise;
}
