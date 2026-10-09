-- 댓글 좋아요 표와 댓글 알림의 댓글 id. 표·열·인덱스만 더한다(기존 데이터는 그대로).
-- relationMode = "prisma" 라 FK 는 두지 않는다.
-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "commentId" INTEGER;

-- CreateTable
CREATE TABLE "CommentLike" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "commentId" INTEGER NOT NULL,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentLike_commentId_idx" ON "CommentLike"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentLike_userId_commentId_key" ON "CommentLike"("userId", "commentId");

