-- 찬반 토론·라이브 댓글·동네 사랑방(앱 docs/prd/live-talk.md, 2026-10-15). 타입·테이블·칸 추가만 한다.
DO $$ BEGIN
  CREATE TYPE "DebateSide" AS ENUM ('A', 'B');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TownMessageType" AS ENUM ('TEXT', 'IMAGE', 'PRODUCT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 토론 댓글이면 쓴 순간의 쪽
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "stance" "DebateSide";

CREATE TABLE IF NOT EXISTS "Debate" (
  "postId" INTEGER NOT NULL,
  "optionA" VARCHAR(12) NOT NULL,
  "optionB" VARCHAR(12) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "firstOtherVoteAt" TIMESTAMP(3),
  "resultNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Debate_pkey" PRIMARY KEY ("postId")
);

CREATE TABLE IF NOT EXISTS "DebateVote" (
  "id" SERIAL NOT NULL,
  "postId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "side" "DebateSide" NOT NULL,
  "switchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DebateVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TownMessage" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "regionSido" TEXT NOT NULL,
  "regionSigungu" TEXT NOT NULL,
  "type" "TownMessageType" NOT NULL DEFAULT 'TEXT',
  "body" VARCHAR(300),
  "image" TEXT,
  "productId" INTEGER,
  "replyToId" INTEGER,
  "isHidden" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TownMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Debate_endsAt_idx" ON "Debate"("endsAt");
CREATE INDEX IF NOT EXISTS "DebateVote_postId_updatedAt_idx" ON "DebateVote"("postId", "updatedAt");
CREATE INDEX IF NOT EXISTS "DebateVote_userId_idx" ON "DebateVote"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "DebateVote_postId_userId_key" ON "DebateVote"("postId", "userId");
CREATE INDEX IF NOT EXISTS "TownMessage_regionSido_regionSigungu_id_idx" ON "TownMessage"("regionSido", "regionSigungu", "id");
CREATE INDEX IF NOT EXISTS "TownMessage_userId_createdAt_idx" ON "TownMessage"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "TownMessage_createdAt_idx" ON "TownMessage"("createdAt");
