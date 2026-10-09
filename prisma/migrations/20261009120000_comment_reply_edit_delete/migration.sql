-- 댓글 대댓글(1단계)·수정 표시·작성자 삭제 자리. 열·인덱스만 더한다(기존 데이터는 그대로).
-- relationMode = "prisma" 라 parentId 에 FK 는 두지 않는다.
ALTER TABLE "Comment" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "parentId" INTEGER;

CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");
