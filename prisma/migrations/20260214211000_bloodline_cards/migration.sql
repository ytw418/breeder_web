-- CreateTable
CREATE TABLE "BloodlineCard" (
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

-- CreateTable
CREATE TABLE "BloodlineCardTransfer" (
    "id" SERIAL NOT NULL,
    "cardId" INTEGER NOT NULL,
    "fromUserId" INTEGER,
    "toUserId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloodlineCardTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BloodlineCard_creatorId_key" ON "BloodlineCard"("creatorId");

-- CreateIndex
CREATE INDEX "BloodlineCard_currentOwnerId_createdAt_idx" ON "BloodlineCard"("currentOwnerId", "createdAt");

-- CreateIndex
CREATE INDEX "BloodlineCardTransfer_cardId_createdAt_idx" ON "BloodlineCardTransfer"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "BloodlineCardTransfer_toUserId_createdAt_idx" ON "BloodlineCardTransfer"("toUserId", "createdAt");
