-- 운영 제재: 계정 상태·알림 enum 값 추가 (새 값은 다음 마이그레이션부터 쓴다)
ALTER TYPE "UserStatus"       ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MODERATION';
