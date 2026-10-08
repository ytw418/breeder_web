-- 혈통 v2: 보유자 테이블 편입(운영 DB 에는 런타임 DDL 로 이미 있을 수 있다 → IF NOT EXISTS),
-- 산지·닉네임 공개 플래그, 상품·경매 혈통 연결, 이전 보유자 행 정리

CREATE TABLE IF NOT EXISTS "BloodlineCardOwner" (
  "bloodlineCardId" INTEGER NOT NULL,
  "userId"          INTEGER NOT NULL,
  "grantedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BloodlineCardOwner_pkey" PRIMARY KEY ("bloodlineCardId", "userId")
);
CREATE INDEX IF NOT EXISTS "BloodlineCardOwner_userId_bloodlineCardId_idx"
  ON "BloodlineCardOwner"("userId", "bloodlineCardId");

ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "originSido"       TEXT;
ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "originSigungu"    TEXT;
ALTER TABLE "BloodlineCard" ADD COLUMN IF NOT EXISTS "ownerNameVisible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bloodlineRootId" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pedigreeNote"    JSONB;
CREATE INDEX IF NOT EXISTS "Product_bloodlineRootId_idx" ON "Product"("bloodlineRootId");

ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "pedigreeNote" JSONB;

-- 이전 보유자 행 정리: 보유자 테이블을 currentOwnerId 의 거울로 맞춘다.
-- 운영 데이터는 타인 보유 0장(2026-10-07 조사)이라 영향 행이 0에 가깝다. 배포 전 아래 SELECT 로 건수를 확인한다.
--   SELECT count(*) FROM "BloodlineCardOwner" o JOIN "BloodlineCard" c ON c.id = o."bloodlineCardId"
--   WHERE o."userId" <> c."currentOwnerId";
DELETE FROM "BloodlineCardOwner" o
USING "BloodlineCard" c
WHERE o."bloodlineCardId" = c.id
  AND o."userId" <> c."currentOwnerId";

INSERT INTO "BloodlineCardOwner" ("bloodlineCardId", "userId")
SELECT c.id, c."currentOwnerId" FROM "BloodlineCard" c
ON CONFLICT ("bloodlineCardId", "userId") DO NOTHING;
