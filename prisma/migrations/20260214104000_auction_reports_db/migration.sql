-- CreateEnum
CREATE TYPE "AuctionReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuctionReportAction" AS ENUM ('NONE', 'STOP_AUCTION', 'BAN_USER', 'STOP_AUCTION_AND_BAN');

-- CreateTable
CREATE TABLE "AuctionReport" (
    "id" SERIAL NOT NULL,
    "auctionId" INTEGER NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "reportedUserId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" "AuctionReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionAction" "AuctionReportAction" NOT NULL DEFAULT 'NONE',
    "resolutionNote" TEXT,
    "resolvedBy" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuctionReport_auctionId_idx" ON "AuctionReport"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionReport_reporterId_idx" ON "AuctionReport"("reporterId");

-- CreateIndex
CREATE INDEX "AuctionReport_reportedUserId_idx" ON "AuctionReport"("reportedUserId");

-- CreateIndex
CREATE INDEX "AuctionReport_status_idx" ON "AuctionReport"("status");

-- CreateIndex
CREATE INDEX "AuctionReport_createdAt_idx" ON "AuctionReport"("createdAt");
