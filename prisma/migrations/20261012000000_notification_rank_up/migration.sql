-- 커뮤니티 참여 유도(앱 docs/prd/community-vibe.md §5b): 주간 순위 상승 알림 종류 추가 (새 값은 다음 마이그레이션부터 쓴다)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RANK_UP';
