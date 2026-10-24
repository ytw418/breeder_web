-- 보호소 아이들(앱 docs/prd/shelter-animals.md): 외부 공고에서 옮겨 온 글 표시. 컬럼·색인 추가만(데이터 그대로).
ALTER TABLE "Product" ADD COLUMN "externalSource" TEXT, ADD COLUMN "externalId" TEXT;

-- 회원 글은 둘 다 NULL 이라 고유 색인에 걸리지 않는다(Postgres 는 NULL 끼리 같다고 보지 않는다).
CREATE UNIQUE INDEX "Product_externalSource_externalId_key" ON "Product"("externalSource", "externalId");
