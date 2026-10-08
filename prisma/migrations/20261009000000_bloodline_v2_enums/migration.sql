-- 혈통 v2: 알림·신고·운영 enum 값 추가 (새 값은 다음 마이그레이션부터 쓴다)
ALTER TYPE "NotificationType"      ADD VALUE IF NOT EXISTS 'BLOODLINE_RECEIVED';
ALTER TYPE "ReportTargetType"      ADD VALUE IF NOT EXISTS 'BLOODLINE_CARD';
ALTER TYPE "ModerationTargetType"  ADD VALUE IF NOT EXISTS 'BLOODLINE_CARD';
