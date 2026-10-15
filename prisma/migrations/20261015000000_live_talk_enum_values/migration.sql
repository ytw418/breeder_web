-- 찬반 토론·동네 사랑방(앱 docs/prd/live-talk.md): 알림 종류·신고 대상 추가 (새 값은 다음 마이그레이션부터 쓴다)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEBATE_RESULT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEBATE_MILESTONE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TOWN_REPLY';
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'TOWN_MESSAGE';
