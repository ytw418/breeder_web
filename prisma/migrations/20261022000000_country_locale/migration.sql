-- 해외 진출 대비: 나라·언어 컬럼. 상수 기본값이라 기존 행은 다시 쓰지 않고(KR·ko) 데이터를 지우거나 바꾸지 않는다.
ALTER TABLE "User" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'KR';
ALTER TABLE "User" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ko';
ALTER TABLE "Post" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'KR';
ALTER TABLE "Post" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ko';
ALTER TABLE "Product" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'KR';
ALTER TABLE "Auction" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'KR';
