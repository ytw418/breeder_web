-- 알림 종류별 끄기·방해 금지(앱 docs/prd/notifications.md, 2026-10-21). 칸 추가만 한다. 비어 있으면 모두 켜짐.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notificationPrefs" JSONB;
