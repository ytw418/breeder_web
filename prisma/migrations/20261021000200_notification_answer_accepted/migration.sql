-- 질문 답변 채택 알림(앱 docs/prd/feed-engagement.md '해결'). 새 값은 다음 마이그레이션부터 쓴다(ALTER TYPE ADD VALUE 는 같은 트랜잭션에서 못 쓴다).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ANSWER_ACCEPTED';
