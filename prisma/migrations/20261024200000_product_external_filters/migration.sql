-- 보호소 아이들 필터(품종·크기·지역·마감순, 앱 design/mockups/adoption-v2). 컬럼·색인 추가만(데이터 그대로). 값은 동기화가 채운다.
ALTER TABLE "Product" ADD COLUMN "externalBreed" TEXT, ADD COLUMN "externalWeightKg" DOUBLE PRECISION, ADD COLUMN "externalNoticeEnd" TIMESTAMP(3);

CREATE INDEX "Product_externalSource_category_regionSido_idx" ON "Product"("externalSource", "category", "regionSido");
