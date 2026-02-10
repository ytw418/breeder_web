/*
  Warnings:

  - You are about to drop the column `buyerConfirmed` on the `ChatRoom` table. All the data in the column will be lost.
  - You are about to drop the column `isCompleted` on the `ChatRoom` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `ChatRoom` table. All the data in the column will be lost.
  - You are about to drop the column `sellerConfirmed` on the `ChatRoom` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `ChatRoom` table. All the data in the column will be lost.
  - You are about to drop the column `isBuyer` on the `ChatRoomMember` table. All the data in the column will be lost.
  - Made the column `chatRoomId` on table `Message` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE');

-- CreateEnum
CREATE TYPE "GuinnessRecordType" AS ENUM ('size', 'weight');

-- CreateEnum
CREATE TYPE "GuinnessSubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "GuinnessRejectionReasonCode" AS ENUM ('photo_blur', 'measurement_not_visible', 'contact_missing', 'invalid_value', 'insufficient_description', 'suspected_manipulation', 'other');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LIKE', 'COMMENT', 'CHAT', 'FOLLOW', 'FAV', 'NEW_PRODUCT', 'NEW_POST', 'BID', 'OUTBID', 'AUCTION_WON', 'AUCTION_END', 'NEW_RECORD');

-- DropIndex
DROP INDEX "ChatRoom_productId_idx";

-- AlterTable
ALTER TABLE "ChatRoom" DROP COLUMN "buyerConfirmed",
DROP COLUMN "isCompleted",
DROP COLUMN "productId",
DROP COLUMN "sellerConfirmed",
DROP COLUMN "type";

-- AlterTable
ALTER TABLE "ChatRoomMember" DROP COLUMN "isBuyer";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "image" TEXT,
ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'TEXT',
ALTER COLUMN "chatRoomId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "productType" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "targetId" INTEGER,
    "targetType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photos" TEXT[],
    "category" TEXT,
    "startPrice" INTEGER NOT NULL,
    "currentPrice" INTEGER NOT NULL,
    "minBidIncrement" INTEGER NOT NULL DEFAULT 1000,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT '진행중',
    "userId" INTEGER NOT NULL,
    "winnerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "auctionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsectRecord" (
    "id" SERIAL NOT NULL,
    "species" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "photo" TEXT NOT NULL,
    "description" TEXT,
    "userId" INTEGER NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsectRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuinnessSpecies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOfficial" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuinnessSpecies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuinnessSubmission" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userName" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "speciesId" INTEGER,
    "speciesRawText" TEXT,
    "recordType" "GuinnessRecordType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measurementDate" TIMESTAMP(3),
    "description" TEXT,
    "proofPhotos" TEXT[],
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "consentToContact" BOOLEAN NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slaDueAt" TIMESTAMP(3) NOT NULL,
    "resubmitCount" INTEGER NOT NULL DEFAULT 0,
    "status" "GuinnessSubmissionStatus" NOT NULL DEFAULT 'pending',
    "reviewReasonCode" "GuinnessRejectionReasonCode",
    "reviewMemo" TEXT,
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "approvedRecordId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuinnessSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminBanner" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "bgClass" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_senderId_idx" ON "Notification"("senderId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Auction_userId_idx" ON "Auction"("userId");

-- CreateIndex
CREATE INDEX "Auction_status_idx" ON "Auction"("status");

-- CreateIndex
CREATE INDEX "Auction_endAt_idx" ON "Auction"("endAt");

-- CreateIndex
CREATE INDEX "Auction_category_idx" ON "Auction"("category");

-- CreateIndex
CREATE INDEX "Bid_auctionId_idx" ON "Bid"("auctionId");

-- CreateIndex
CREATE INDEX "Bid_userId_idx" ON "Bid"("userId");

-- CreateIndex
CREATE INDEX "InsectRecord_species_recordType_idx" ON "InsectRecord"("species", "recordType");

-- CreateIndex
CREATE INDEX "InsectRecord_userId_idx" ON "InsectRecord"("userId");

-- CreateIndex
CREATE INDEX "InsectRecord_species_recordType_value_idx" ON "InsectRecord"("species", "recordType", "value");

-- CreateIndex
CREATE UNIQUE INDEX "GuinnessSpecies_name_key" ON "GuinnessSpecies"("name");

-- CreateIndex
CREATE INDEX "GuinnessSubmission_userId_idx" ON "GuinnessSubmission"("userId");

-- CreateIndex
CREATE INDEX "GuinnessSubmission_species_recordType_idx" ON "GuinnessSubmission"("species", "recordType");

-- CreateIndex
CREATE INDEX "GuinnessSubmission_status_idx" ON "GuinnessSubmission"("status");

-- CreateIndex
CREATE INDEX "AdminBanner_order_idx" ON "AdminBanner"("order");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");

-- CreateIndex
CREATE INDEX "LandingPage_isPublished_idx" ON "LandingPage"("isPublished");

-- CreateIndex
CREATE INDEX "ChatRoomMember_userId_idx" ON "ChatRoomMember"("userId");

-- CreateIndex
CREATE INDEX "Post_category_idx" ON "Post"("category");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");
