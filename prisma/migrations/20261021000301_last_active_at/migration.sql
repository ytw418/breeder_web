-- 마지막 활동 시각(커뮤니티 감사 #22): 인증에서 KST 하루 한 번 갱신, 주간 요약·운영자 발송 대상 조회용. 컬럼·인덱스 추가만.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");
