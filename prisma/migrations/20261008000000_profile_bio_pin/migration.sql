-- 프로필 사진형(A안): 소개, 프로필 사진 고정
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "Post" ADD COLUMN "profilePinnedAt" TIMESTAMP(3);
