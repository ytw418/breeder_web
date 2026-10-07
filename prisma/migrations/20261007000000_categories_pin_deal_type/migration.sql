-- 카테고리 고정(Pin): 카테고리 트리 테이블, 사용자 고정 목록, 게시글·상품 categoryId, 상품 거래 유형
-- 기존 문자열 카테고리(Product.category / Post.type)는 그대로 두고 categoryId 를 함께 채운다.

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" INTEGER,
    "path" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_path_key" ON "Category"("path");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pinnedCategoryIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "categoryId" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "dealType" TEXT NOT NULL DEFAULT 'sale';

ALTER TABLE "Product" ADD CONSTRAINT "Product_dealType_check"
  CHECK ("dealType" IN ('sale', 'adoption', 'rehoming'));

-- CreateIndex
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- 시드: 기존 libs/categoryTaxonomy.ts 트리를 그대로 옮기고(기존 데이터 매핑용),
-- 포유류 아래 강아지·고양이, 최상위 기타를 더한다. 강아지·고양이는 2026-10-07 사용자 결정으로 노출(isVisible=true).
INSERT INTO "Category" ("name", "slug", "parentId", "path", "isVisible", "sortOrder") VALUES
  ('곤충',   'insect',    NULL, '/insect/',    true, 1),
  ('절지류', 'arthropod', NULL, '/arthropod/', true, 2),
  ('파충류', 'reptile',   NULL, '/reptile/',   true, 3),
  ('어류',   'fish',      NULL, '/fish/',      true, 4),
  ('포유류', 'mammal',    NULL, '/mammal/',    true, 5),
  ('양서류', 'amphibian', NULL, '/amphibian/', true, 6),
  ('식물',   'plant',     NULL, '/plant/',     true, 7),
  ('기타',   'etc',       NULL, '/etc/',       true, 99);

INSERT INTO "Category" ("name", "slug", "parentId", "path", "isVisible", "sortOrder")
SELECT v.name, v.slug, p.id, p.path || v.slug || '/', true, v.sort
FROM (VALUES
  -- 곤충
  ('/insect/', '장수풍뎅이', 'rhinoceros-beetle', 1),
  ('/insect/', '사슴벌레', 'stag-beetle', 2),
  ('/insect/', '개미', 'ant', 3),
  ('/insect/', '나비', 'butterfly', 4),
  ('/insect/', '사마귀', 'mantis', 5),
  ('/insect/', '밀웜/귀뚜라미', 'mealworm-cricket', 6),
  -- 절지류
  ('/arthropod/', '타란튤라', 'tarantula', 1),
  ('/arthropod/', '지네', 'centipede', 2),
  ('/arthropod/', '전갈', 'scorpion', 3),
  ('/arthropod/', '등각류', 'isopod', 4),
  ('/arthropod/', '기타 절지류', 'other-arthropod', 5),
  -- 파충류
  ('/reptile/', '레오파드 게코', 'leopard-gecko', 1),
  ('/reptile/', '크레스티드 게코', 'crested-gecko', 2),
  ('/reptile/', '볼파이썬', 'ball-python', 3),
  ('/reptile/', '콘스네이크', 'corn-snake', 4),
  ('/reptile/', '이구아나', 'iguana', 5),
  ('/reptile/', '카멜레온', 'chameleon', 6),
  ('/reptile/', '육지거북', 'tortoise', 7),
  ('/reptile/', '수생거북', 'aquatic-turtle', 8),
  -- 어류
  ('/fish/', '구피', 'guppy', 1),
  ('/fish/', '베타', 'betta', 2),
  ('/fish/', '코리도라스', 'corydoras', 3),
  ('/fish/', '안시스트루스', 'ancistrus', 4),
  ('/fish/', '디스커스', 'discus', 5),
  ('/fish/', '금붕어', 'goldfish', 6),
  -- 포유류
  ('/mammal/', '고슴도치', 'hedgehog', 1),
  ('/mammal/', '햄스터', 'hamster', 2),
  ('/mammal/', '기니피그', 'guinea-pig', 3),
  ('/mammal/', '토끼', 'rabbit', 4),
  ('/mammal/', '페럿', 'ferret', 5),
  ('/mammal/', '친칠라', 'chinchilla', 6),
  ('/mammal/', '강아지', 'dog', 7),
  ('/mammal/', '고양이', 'cat', 8),
  -- 양서류
  ('/amphibian/', '팩맨', 'pacman-frog', 1),
  ('/amphibian/', '엑솔로틀', 'axolotl', 2),
  ('/amphibian/', '화이트트리프록', 'whites-tree-frog', 3),
  ('/amphibian/', '다트프록', 'dart-frog', 4),
  ('/amphibian/', '뉴트', 'newt', 5),
  -- 식물
  ('/plant/', '관엽식물', 'foliage-plant', 1),
  ('/plant/', '다육식물', 'succulent', 2),
  ('/plant/', '식충식물', 'carnivorous-plant', 3),
  ('/plant/', '테라리움 식물', 'terrarium-plant', 4),
  ('/plant/', '수초', 'aquatic-plant', 5)
) AS v(parent_path, name, slug, sort)
JOIN "Category" p ON p.path = v.parent_path;

-- 기존 데이터 매핑: 이름이 같은 카테고리로. 레거시 별칭(기타곤충·나비/나방)은 곤충으로.
-- 값이 있는데 어느 카테고리에도 안 맞으면 기타, 값이 없으면 NULL 유지.
UPDATE "Product" p SET "categoryId" = c.id
FROM "Category" c WHERE p."categoryId" IS NULL AND p."category" = c."name";
UPDATE "Product" p SET "categoryId" = (SELECT id FROM "Category" WHERE path = '/insect/')
WHERE p."categoryId" IS NULL AND p."category" IN ('기타곤충', '나비/나방');
UPDATE "Product" p SET "categoryId" = (SELECT id FROM "Category" WHERE path = '/etc/')
WHERE p."categoryId" IS NULL AND p."category" IS NOT NULL AND btrim(p."category") <> '';

UPDATE "Post" p SET "categoryId" = c.id
FROM "Category" c WHERE p."categoryId" IS NULL AND p."type" = c."name";
UPDATE "Post" p SET "categoryId" = (SELECT id FROM "Category" WHERE path = '/insect/')
WHERE p."categoryId" IS NULL AND p."type" IN ('기타곤충', '나비/나방');
UPDATE "Post" p SET "categoryId" = (SELECT id FROM "Category" WHERE path = '/etc/')
WHERE p."categoryId" IS NULL AND p."type" IS NOT NULL AND btrim(p."type") <> '';
