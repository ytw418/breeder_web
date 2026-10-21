-- 주간 요약 푸시·운영자 발송(커뮤니티 감사 #22): 알림 종류 추가 (새 값은 다음 마이그레이션부터 쓴다)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WEEKLY_DIGEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADMIN_BROADCAST';
