-- CreateEnum
CREATE TYPE "VoiceInquiryType" AS ENUM ('BUG_REPORT', 'FEATURE_REQUEST', 'DEV_TEAM_REQUEST');

-- CreateEnum
CREATE TYPE "VoiceInquiryStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'DONE', 'REJECTED');

-- CreateTable
CREATE TABLE "VoiceInquiry" (
    "id" SERIAL NOT NULL,
    "type" "VoiceInquiryType" NOT NULL,
    "status" "VoiceInquiryStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "requesterId" INTEGER,
    "requesterName" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceInquiry_status_createdAt_idx" ON "VoiceInquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceInquiry_type_createdAt_idx" ON "VoiceInquiry"("type", "createdAt");
