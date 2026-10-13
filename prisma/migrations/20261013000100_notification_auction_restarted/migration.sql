-- 경매 다시 시작(앱 docs/prd/auction-restart.md): 알림 종류 추가 (새 값은 다음 마이그레이션부터 쓴다)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AUCTION_RESTARTED';
