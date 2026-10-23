-- 강아지·고양이 분양글 정보(성별·나이·건강·이유·임보 기간). 추가만 한다(앱 docs/prd/pet-space.md).
ALTER TABLE "Product" ADD COLUMN "petInfo" JSONB;
