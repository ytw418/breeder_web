-- 동네 브리더 '손 흔들어 인사하기'(2026-10-12). 테이블 추가만 한다.
CREATE TABLE IF NOT EXISTS "ChatWave" (
  "id" SERIAL NOT NULL,
  "senderId" INTEGER NOT NULL,
  "recipientId" INTEGER NOT NULL,
  "chatRoomId" INTEGER NOT NULL,
  "presetId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatWave_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatWave_senderId_recipientId_key" ON "ChatWave"("senderId", "recipientId");

CREATE INDEX IF NOT EXISTS "ChatWave_senderId_day_idx" ON "ChatWave"("senderId", "day");

CREATE INDEX IF NOT EXISTS "ChatWave_recipientId_idx" ON "ChatWave"("recipientId");
