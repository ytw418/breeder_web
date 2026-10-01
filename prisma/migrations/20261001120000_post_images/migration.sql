-- 게시글 다중 이미지(최대 10장): Post.images 추가. Post.image 는 대표 이미지(images[0])로 유지한다.
-- 스키마 SQL 은 `prisma migrate diff --from-schema-datamodel <origin/dev schema> --to-schema-datamodel prisma/schema.prisma --script` 결과와 같다.
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 기존 단일 이미지 이관: 대표 이미지가 있는 글은 images = [image]
UPDATE "Post"
SET "images" = ARRAY["image"]
WHERE "image" <> ''
  AND ("images" IS NULL OR cardinality("images") = 0);
