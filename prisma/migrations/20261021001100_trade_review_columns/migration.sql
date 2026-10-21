-- 입양자 지정·채팅 분양글 카드·거래 후기(앱 docs/prd/trade-review.md). 가산만: 널 허용 열·기본값 열·인덱스.
-- 기존 행은 그대로 둔다(백필 없음). 옛 Sale(buyerId null)은 '미지정', 옛 Review(productId null)는 거래 후기가 아니다.

-- AlterTable: 분양자가 지정한 입양자
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "buyerId" INTEGER;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "buyerSource" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "buyerAssignedAt" TIMESTAMP(3);

-- AlterTable: 채팅 분양글 카드 행
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "productId" INTEGER;

-- AlterTable: 거래 후기(키워드·분양자 답글·운영자 숨김)
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "productId" INTEGER;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "reply" VARCHAR(300);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Sale_buyerId_idx" ON "Sale"("buyerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_chatRoomId_productId_idx" ON "Message"("chatRoomId", "productId");

-- CreateIndex: 기존 Review 행은 productId 가 모두 NULL 이라 충돌하지 않는다(Postgres 는 NULL 끼리 다르게 본다).
CREATE UNIQUE INDEX IF NOT EXISTS "Review_productId_createdById_key" ON "Review"("productId", "createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Review_createdForId_isHidden_idx" ON "Review"("createdForId", "isHidden");
