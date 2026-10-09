-- 운영 제재: 사용자 제재 이력(UserSanction)과 신고 처리 결과 열. 추가만 한다(앱 docs/prd/admin-moderation.md).

-- CreateEnum
CREATE TYPE "SanctionType" AS ENUM ('WARNING', 'SUSPENSION', 'BAN', 'LIFT');

-- AlterTable
ALTER TABLE "AuctionReport" ADD COLUMN     "sanctionId" INTEGER;

-- AlterTable
ALTER TABLE "ModerationLog" ADD COLUMN     "reasonCode" TEXT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "contentAction" "ModerationActionType",
ADD COLUMN     "sanctionId" INTEGER;

-- CreateTable
CREATE TABLE "UserSanction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "type" "SanctionType" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "messageToUser" TEXT,
    "internalNote" TEXT,
    "days" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "reportId" INTEGER,
    "auctionReportId" INTEGER,
    "targetType" "ModerationTargetType",
    "targetId" INTEGER,
    "snapshot" JSONB,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSanction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSanction_userId_createdAt_idx" ON "UserSanction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserSanction_userId_acknowledgedAt_idx" ON "UserSanction"("userId", "acknowledgedAt");

-- CreateIndex
CREATE INDEX "UserSanction_actorId_createdAt_idx" ON "UserSanction"("actorId", "createdAt");
