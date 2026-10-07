-- 카테고리 고정 마이그레이션 뒤 dev DB 에서 확인한 레거시 값 보정.
-- Post.type 의 community/general 은 종이 아니라 옛 게시판 구분이라 종 없음(NULL)으로 둔다.
UPDATE "Post" SET "categoryId" = NULL WHERE "type" IN ('community', 'general');

-- 옛 상품 카테고리 이름을 가장 가까운 분류로 옮긴다(나머지는 기타 유지).
UPDATE "Product" p SET "categoryId" = c.id FROM "Category" c
WHERE c.path = '/fish/' AND p."category" IN ('관상어', '메다카');
UPDATE "Product" p SET "categoryId" = c.id FROM "Category" c
WHERE c.path = '/reptile/' AND p."category" IN ('뱀/도마뱀/거북이', '파충류용품');
UPDATE "Product" p SET "categoryId" = c.id FROM "Category" c
WHERE c.path = '/plant/' AND p."category" = '아가베';
