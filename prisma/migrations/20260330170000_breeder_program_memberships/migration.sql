DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'breederprogramtype' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "BreederProgramType" AS ENUM (
      'FOUNDING_BREEDER',
      'PARTNER_BREEDER',
      'VERIFIED_BREEDER'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'breederprogramstatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "BreederProgramStatus" AS ENUM ('ACTIVE', 'REVOKED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'breederprogramsource' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "BreederProgramSource" AS ENUM (
      'AUTO_SIGNUP',
      'MANUAL_ADMIN',
      'SELF_VERIFICATION'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE LOWER(t.typname) = 'breederprogramfeebenefittype' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "BreederProgramFeeBenefitType" AS ENUM (
      'NONE',
      'LIFETIME_AUCTION_FEE_FREE',
      'AUCTION_FEE_PERCENT_DISCOUNT'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "BreederProgramMembership" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "programType" "BreederProgramType" NOT NULL,
  "status" "BreederProgramStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "BreederProgramSource" NOT NULL,
  "badgeLabel" TEXT NOT NULL,
  "frameVariant" TEXT NOT NULL,
  "foundingNo" INTEGER,
  "feeBenefitType" "BreederProgramFeeBenefitType" NOT NULL DEFAULT 'NONE',
  "feeDiscountPercent" INTEGER,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BreederProgramMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BreederProgramMembership_userId_programType_key"
ON "BreederProgramMembership"("userId", "programType");

CREATE UNIQUE INDEX IF NOT EXISTS "BreederProgramMembership_programType_foundingNo_key"
ON "BreederProgramMembership"("programType", "foundingNo");

CREATE INDEX IF NOT EXISTS "BreederProgramMembership_userId_status_idx"
ON "BreederProgramMembership"("userId", "status");

CREATE INDEX IF NOT EXISTS "BreederProgramMembership_programType_status_grantedAt_idx"
ON "BreederProgramMembership"("programType", "status", "grantedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreederProgramMembership_userId_fkey'
  ) THEN
    ALTER TABLE "BreederProgramMembership"
    ADD CONSTRAINT "BreederProgramMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
