-- 경매 다시 시작(앱 docs/prd/auction-restart.md, 2026-10-13). 열·표·인덱스 추가만 한다.
-- listedAt 은 기존 행 모두 이 마이그레이션 시각이 된다(목록은 id 로 한 번 더 정렬하므로 순서는 그대로).
ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "round" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Auction_listedAt_idx" ON "Auction"("listedAt");

ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AuctionRestart" (
  "id" SERIAL NOT NULL,
  "auctionId" INTEGER NOT NULL,
  "round" INTEGER NOT NULL,
  "previousStatus" TEXT NOT NULL,
  "previousEndAt" TIMESTAMP(3) NOT NULL,
  "previousPrice" INTEGER NOT NULL,
  "previousBidCount" INTEGER NOT NULL,
  "previousWinnerId" INTEGER,
  "reason" TEXT,
  "reportId" INTEGER,
  "restartedBy" INTEGER NOT NULL,
  "newEndAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuctionRestart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuctionRestart_auctionId_idx" ON "AuctionRestart"("auctionId");

CREATE INDEX IF NOT EXISTS "AuctionRestart_previousWinnerId_idx" ON "AuctionRestart"("previousWinnerId");
