-- 재방문 알림(2026-10-23, 앱 docs/prd/reengagement-push.md): 알림 종류 추가 (값만 늘린다, 새 값은 다음 마이그레이션부터 쓴다)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEARBY_FREE_PRODUCT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEBATE_CLOSING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INTEREST_PRODUCTS';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUESTION_HELP';
