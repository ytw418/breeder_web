-- 게시글 상세 대화(앱 docs/prd/post-upload.md 2026-10-21): 질문 채택·해결, 답글의 답글 대상, 이 글 새 댓글 알림 구독. 모두 추가만 한다.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "acceptedCommentId" INTEGER,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "replyToUserId" INTEGER;

-- CreateTable
CREATE TABLE "PostSubscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "postId" INTEGER NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostSubscription_postId_muted_idx" ON "PostSubscription"("postId", "muted");

-- CreateIndex
CREATE UNIQUE INDEX "PostSubscription_userId_postId_key" ON "PostSubscription"("userId", "postId");
