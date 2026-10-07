-- 동네 브리더: 사용자 내 동네(시/도·시/군/구)와 노출 여부, '동네' 글의 지역 스냅샷. 좌표는 저장하지 않는다.
ALTER TABLE "User" ADD COLUMN "regionSido" TEXT;
ALTER TABLE "User" ADD COLUMN "regionSigungu" TEXT;
ALTER TABLE "User" ADD COLUMN "regionVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "regionUpdatedAt" TIMESTAMP(3);
CREATE INDEX "User_regionSido_regionSigungu_regionVisible_idx" ON "User"("regionSido", "regionSigungu", "regionVisible");

ALTER TABLE "Post" ADD COLUMN "regionSido" TEXT;
ALTER TABLE "Post" ADD COLUMN "regionSigungu" TEXT;
CREATE INDEX "Post_category_regionSido_regionSigungu_idx" ON "Post"("category", "regionSido", "regionSigungu");
