DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'seasonkind' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "SeasonKind" AS ENUM ('WEEKLY');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'seasonstatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "SeasonStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'CLOSED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'badgetype' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "BadgeType" AS ENUM ('TOP_BREEDER', 'TOP_BLOODLINE', 'HIGHEST_AUCTION_SELLER');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'rankingentitytype' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "RankingEntityType" AS ENUM ('USER', 'BLOODLINE', 'AUCTION');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'alerttype' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "AlertType" AS ENUM ('BREEDER_RANK_DROP', 'BREEDER_OVERTAKEN', 'BLOODLINE_OVERTAKEN', 'AUCTION_RECORD_BROKEN');
  END IF;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BREEDER_RANK_DROP';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BREEDER_OVERTAKEN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BLOODLINE_OVERTAKEN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AUCTION_RECORD_BROKEN';

ALTER TABLE "Auction"
ADD COLUMN IF NOT EXISTS "bloodlineRootId" INTEGER;

CREATE INDEX IF NOT EXISTS "Auction_bloodlineRootId_endAt_idx"
ON "Auction"("bloodlineRootId", "endAt");

CREATE TABLE IF NOT EXISTS "Season" (
  "id" SERIAL NOT NULL,
  "kind" "SeasonKind" NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "status" "SeasonStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Season_kind_startAt_endAt_key"
ON "Season"("kind", "startAt", "endAt");

CREATE INDEX IF NOT EXISTS "Season_kind_status_startAt_endAt_idx"
ON "Season"("kind", "status", "startAt", "endAt");

CREATE TABLE IF NOT EXISTS "UserBadge" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "seasonId" INTEGER NOT NULL,
  "badgeType" "BadgeType" NOT NULL,
  "rank" INTEGER NOT NULL,
  "entityType" "RankingEntityType" NOT NULL,
  "entityId" INTEGER,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBadge_userId_seasonId_badgeType_rank_key"
ON "UserBadge"("userId", "seasonId", "badgeType", "rank");

CREATE INDEX IF NOT EXISTS "UserBadge_userId_createdAt_idx"
ON "UserBadge"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "UserBadge_seasonId_badgeType_rank_idx"
ON "UserBadge"("seasonId", "badgeType", "rank");

CREATE TABLE IF NOT EXISTS "MissionTemplate" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "targetCount" INTEGER NOT NULL,
  "rewardLabel" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MissionTemplate_key_key"
ON "MissionTemplate"("key");

CREATE TABLE IF NOT EXISTS "UserMissionProgress" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "seasonId" INTEGER NOT NULL,
  "missionKey" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserMissionProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserMissionProgress_userId_seasonId_missionKey_key"
ON "UserMissionProgress"("userId", "seasonId", "missionKey");

CREATE INDEX IF NOT EXISTS "UserMissionProgress_seasonId_missionKey_idx"
ON "UserMissionProgress"("seasonId", "missionKey");

CREATE INDEX IF NOT EXISTS "UserMissionProgress_userId_completedAt_idx"
ON "UserMissionProgress"("userId", "completedAt");

CREATE TABLE IF NOT EXISTS "AlertSubscription" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "alertType" "AlertType" NOT NULL,
  "entityType" "RankingEntityType" NOT NULL,
  "entityId" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlertSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlertSubscription_userId_alertType_entityType_entityId_key"
ON "AlertSubscription"("userId", "alertType", "entityType", "entityId");

CREATE INDEX IF NOT EXISTS "AlertSubscription_enabled_alertType_idx"
ON "AlertSubscription"("enabled", "alertType");

CREATE TABLE IF NOT EXISTS "AlertState" (
  "id" SERIAL NOT NULL,
  "subscriptionId" INTEGER NOT NULL,
  "lastObservedRank" INTEGER,
  "lastObservedValue" DOUBLE PRECISION,
  "lastNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlertState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlertState_subscriptionId_key"
ON "AlertState"("subscriptionId");

CREATE TABLE IF NOT EXISTS "BloodlineFollow" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "bloodlineRootId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BloodlineFollow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BloodlineFollow_userId_bloodlineRootId_key"
ON "BloodlineFollow"("userId", "bloodlineRootId");

CREATE INDEX IF NOT EXISTS "BloodlineFollow_bloodlineRootId_createdAt_idx"
ON "BloodlineFollow"("bloodlineRootId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserBadge_userId_fkey'
  ) THEN
    ALTER TABLE "UserBadge"
    ADD CONSTRAINT "UserBadge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserBadge_seasonId_fkey'
  ) THEN
    ALTER TABLE "UserBadge"
    ADD CONSTRAINT "UserBadge_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserMissionProgress_userId_fkey'
  ) THEN
    ALTER TABLE "UserMissionProgress"
    ADD CONSTRAINT "UserMissionProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserMissionProgress_seasonId_fkey'
  ) THEN
    ALTER TABLE "UserMissionProgress"
    ADD CONSTRAINT "UserMissionProgress_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AlertSubscription_userId_fkey'
  ) THEN
    ALTER TABLE "AlertSubscription"
    ADD CONSTRAINT "AlertSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AlertState_subscriptionId_fkey'
  ) THEN
    ALTER TABLE "AlertState"
    ADD CONSTRAINT "AlertState_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "AlertSubscription"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BloodlineFollow_userId_fkey'
  ) THEN
    ALTER TABLE "BloodlineFollow"
    ADD CONSTRAINT "BloodlineFollow_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
