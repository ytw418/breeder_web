-- 운영자 모더레이션: 게시글·댓글·경매 숨김(isHidden) + 조치 기록(ModerationLog)
-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('POST', 'COMMENT', 'PRODUCT', 'AUCTION');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('HIDE', 'UNHIDE', 'DELETE');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "targetType" "ModerationTargetType" NOT NULL,
    "targetId" INTEGER NOT NULL,
    "targetUserId" INTEGER,
    "action" "ModerationActionType" NOT NULL,
    "reason" TEXT,
    "reportId" INTEGER,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationLog_targetType_targetId_idx" ON "ModerationLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationLog_actorId_createdAt_idx" ON "ModerationLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationLog_targetUserId_createdAt_idx" ON "ModerationLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_isHidden_createdAt_idx" ON "Post"("isHidden", "createdAt");

