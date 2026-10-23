-- 가족 찾아요·임보 구해요 글 작성자 동네(앱 docs/prd/pet-space.md §5.9). 열 추가만, 기존 행은 null 그대로.
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "regionSido" TEXT,
ADD COLUMN     "regionSigungu" TEXT;
