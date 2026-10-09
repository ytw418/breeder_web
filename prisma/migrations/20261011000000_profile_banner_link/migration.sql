-- 프로필 v5: 커버(배너) 이미지, 대표 링크
ALTER TABLE "User" ADD COLUMN "profileBanner" TEXT;
ALTER TABLE "User" ADD COLUMN "profileLink" TEXT;
