-- 강아지·고양이 '임보 구해요' 글(dealType foster)을 받는다(앱 docs/prd/pet-space.md §5.6).
-- 20261007000000 이 만든 CHECK 에 foster 가 없어 임보 글 저장이 실패했다. 허용 값만 넓히고 데이터는 건드리지 않는다.
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_dealType_check";
ALTER TABLE "Product" ADD CONSTRAINT "Product_dealType_check"
  CHECK ("dealType" IN ('sale', 'adoption', 'rehoming', 'foster'));
