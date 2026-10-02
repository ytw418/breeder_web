-- 정지·차단 토큰 즉시 무효화(#38): User.tokenVersion + 기간 정지 만료 시각 User.suspendedUntil
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "suspendedUntil" TIMESTAMP(3);

-- 기존 기간 정지 계정은 정지 시각을 따로 저장하지 않았으므로 마지막 수정 시각(updatedAt) 기준으로 만료 시각을 채운다.
-- 정지 뒤에 프로필 동기화 등 다른 수정이 있었다면 그만큼 늦게 풀린다(실제 정지 시각을 알 수 없어 짧게 잡지 않는 쪽을 택함).
UPDATE "User" SET "suspendedUntil" = "updatedAt" + INTERVAL '7 days'  WHERE "status" = 'SUSPENDED_7D'  AND "suspendedUntil" IS NULL;
UPDATE "User" SET "suspendedUntil" = "updatedAt" + INTERVAL '30 days' WHERE "status" = 'SUSPENDED_30D' AND "suspendedUntil" IS NULL;

-- 배포 시점에 이미 정지·차단·탈퇴 상태인 계정은 tokenVersion 을 올려, tv 클레임이 없는(=0) 기존 토큰이
-- 나중에 ACTIVE 로 되돌려도 다시 살아나지 않게 한다. ACTIVE 계정은 그대로라 배포 시 강제 로그아웃은 없다.
UPDATE "User" SET "tokenVersion" = "tokenVersion" + 1 WHERE "status" <> 'ACTIVE';
