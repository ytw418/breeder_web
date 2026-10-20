-- 대표 칭호 key(앱 docs/prd/community-vibe.md §3.3, 2026-10-21 감사 #29). 칸 추가만 한다.
-- 값은 랭킹 크론(ranking-alerts)이 하루 한 번 채운다(libs/server/breederTitles.ts refreshTitleKeys).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "titleKey" TEXT;
