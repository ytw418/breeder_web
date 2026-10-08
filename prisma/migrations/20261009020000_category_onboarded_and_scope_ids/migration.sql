-- 관심 카테고리: 온보딩 마친 시각(앱·웹 공유), 경매·혈통 카드 Category.id(범위 구조만 — 아직 화면에서 쓰지 않음). 추가만 한다.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "categoryOnboardedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "categoryId" INTEGER;

-- AlterTable
ALTER TABLE "BloodlineCard" ADD COLUMN     "categoryId" INTEGER;

-- CreateIndex
CREATE INDEX "Auction_categoryId_idx" ON "Auction"("categoryId");

-- CreateIndex
CREATE INDEX "BloodlineCard_categoryId_idx" ON "BloodlineCard"("categoryId");

