-- 기존에 혈통카드 생성자 기준 고유 인덱스가 존재하면 제거
DROP INDEX IF EXISTS "BloodlineCard_creatorId_key";

-- 내 혈통카드 여러 장 생성 허용을 위해 생성자 인덱스를 non-unique로 전환
CREATE INDEX IF NOT EXISTS "BloodlineCard_creatorId_idx" ON "BloodlineCard"("creatorId");
