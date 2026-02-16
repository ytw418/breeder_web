-- Bloodline v1 schema extension
-- 카드 타입/상태/정책 + 이벤트 로그

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'bloodlinecardtype'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "BloodlineCardType" AS ENUM ('BLOODLINE', 'LINE');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'bloodlinecardstatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "BloodlineCardStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REVOKED');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'bloodlinecardtransferpolicy'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "BloodlineCardTransferPolicy" AS ENUM ('NONE', 'ONE_TIME', 'LIMITED_CHAIN', 'LIMITED_COUNT', 'VERIFIED_ONLY');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'bloodlinecardeventtype'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "BloodlineCardEventType" AS ENUM ('BLOODLINE_CREATED', 'BLOODLINE_TRANSFER', 'LINE_CREATED', 'LINE_ISSUED', 'LINE_TRANSFER', 'CARD_REVOKED');
  END IF;
END $$;

ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "cardType" "BloodlineCardType" DEFAULT 'BLOODLINE' NOT NULL;
ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "speciesType" TEXT;
ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "bloodlineReferenceId" INTEGER;
ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "parentCardId" INTEGER;
ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "status" "BloodlineCardStatus" DEFAULT 'ACTIVE' NOT NULL;
ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "transferPolicy" "BloodlineCardTransferPolicy" DEFAULT 'NONE' NOT NULL;
ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "issueCount" INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "transferCount" INTEGER DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS "BloodlineCard_cardType_currentOwnerId_createdAt_idx" ON "BloodlineCard" ("cardType", "currentOwnerId", "createdAt");
CREATE INDEX IF NOT EXISTS "BloodlineCard_cardType_creatorId_createdAt_idx" ON "BloodlineCard" ("cardType", "creatorId", "createdAt");
CREATE INDEX IF NOT EXISTS "BloodlineCard_bloodlineReferenceId_idx" ON "BloodlineCard" ("bloodlineReferenceId");
CREATE INDEX IF NOT EXISTS "BloodlineCard_parentCardId_idx" ON "BloodlineCard" ("parentCardId");

DROP INDEX IF EXISTS "BloodlineCard_creatorId_key";
CREATE INDEX IF NOT EXISTS "BloodlineCard_creatorId_idx" ON "BloodlineCard"("creatorId");

DROP TABLE IF EXISTS "BloodlineCardEvent";
CREATE TABLE "BloodlineCardEvent" (
  "id" SERIAL NOT NULL,
  "cardId" INTEGER NOT NULL,
  "action" "BloodlineCardEventType" NOT NULL,
  "actorUserId" INTEGER,
  "fromUserId" INTEGER,
  "toUserId" INTEGER,
  "relatedCardId" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BloodlineCardEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BloodlineCardEvent_cardId_createdAt_idx" ON "BloodlineCardEvent" ("cardId", "createdAt");
CREATE INDEX IF NOT EXISTS "BloodlineCardEvent_actorUserId_createdAt_idx" ON "BloodlineCardEvent" ("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "BloodlineCardEvent_fromUserId_createdAt_idx" ON "BloodlineCardEvent" ("fromUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "BloodlineCardEvent_toUserId_createdAt_idx" ON "BloodlineCardEvent" ("toUserId", "createdAt");

-- 기존 운영 DB에서 새 외래키 제약이 즉시 필요하지 않기 때문에 초기 v1에서는 생략한다.
