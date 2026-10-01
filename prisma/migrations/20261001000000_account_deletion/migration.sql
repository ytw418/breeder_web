-- 회원탈퇴: User.deletedAt + 탈퇴자 개인정보 분리 보관 테이블
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_status_deletedAt_idx" ON "User"("status", "deletedAt");

CREATE TABLE IF NOT EXISTS "UserDeletionRecord" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "snsId" TEXT,
    "snsIdHash" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgeAt" TIMESTAMP(3) NOT NULL,
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "UserDeletionRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserDeletionRecord_userId_key" ON "UserDeletionRecord"("userId");
CREATE INDEX IF NOT EXISTS "UserDeletionRecord_snsId_idx" ON "UserDeletionRecord"("snsId");
CREATE INDEX IF NOT EXISTS "UserDeletionRecord_snsIdHash_idx" ON "UserDeletionRecord"("snsIdHash");
CREATE INDEX IF NOT EXISTS "UserDeletionRecord_purgeAt_purgedAt_idx" ON "UserDeletionRecord"("purgeAt", "purgedAt");
