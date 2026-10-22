-- 상시 토론(앱 docs/prd/evergreen-debate.md): 칸 추가 + endsAt NOT NULL 해제. 데이터를 지우거나 덮어쓰지 않는다.
-- AlterTable
ALTER TABLE "Debate" ADD COLUMN     "evergreenField" VARCHAR(20),
ADD COLUMN     "evergreenOrder" INTEGER,
ALTER COLUMN "endsAt" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Debate_evergreenField_evergreenOrder_idx" ON "Debate"("evergreenField", "evergreenOrder");
