/*
  Warnings:

  - A unique constraint covering the columns `[userId,chatRoomId]` on the table `ChatRoomMember` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ChatRoomMember_chatRoomId_idx";

-- DropIndex
DROP INDEX "ChatRoomMember_userId_idx";

-- AlterTable
ALTER TABLE "ChatRoomMember" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastReadAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoomMember_userId_chatRoomId_key" ON "ChatRoomMember"("userId", "chatRoomId");
