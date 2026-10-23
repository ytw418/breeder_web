-- 경매 상세 조회 수(목록 '지금 많이 보는 중' 딱지 기준). 상수 기본값 열 추가만 한다(기존 행을 지우거나 바꾸지 않는다).
-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;
