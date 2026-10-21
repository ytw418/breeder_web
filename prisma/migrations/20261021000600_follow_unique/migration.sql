-- 같은 팔로우 쌍이 두 행 생기지 않게 한다(앱 docs/plans/community-gap-audit-2026-10-21.md #15). 인덱스 추가만 한다.
-- 2026-10-21 운영(131행)·dev(16행) 모두 중복 쌍 0건을 읽기 전용으로 확인했다. 중복이 생겨 있으면 이 마이그레이션은 실패한다(데이터는 지우지 않는다).
CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");
