-- 커뮤니티 참여 유도(앱 docs/prd/community-vibe.md §4): 동네 홈 방문 기록(사용자당 하루 1행). 테이블 추가만 한다.
CREATE TABLE IF NOT EXISTS "RegionVisit" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "regionSido" TEXT NOT NULL,
  "regionSigungu" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegionVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegionVisit_userId_day_key" ON "RegionVisit"("userId", "day");

CREATE INDEX IF NOT EXISTS "RegionVisit_day_regionSido_regionSigungu_idx" ON "RegionVisit"("day", "regionSido", "regionSigungu");
