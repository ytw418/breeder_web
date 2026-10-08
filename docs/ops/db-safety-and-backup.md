# DB 안전 · 백업 계획

- 작성: 2026-10-08. 계기는 dev DB 전체 삭제 사고다.
- 규칙 요약은 `AGENTS.md` 'DB 안전 규칙'에 있다.
- 이 문서에는 원인, 방어 장치, 백업·복원 절차를 적는다.

## 1. 사고와 원인

| 항목 | 내용 |
|---|---|
| 언제 | 2026-10-08 22:15 KST |
| 무엇이 | dev DB(Supabase `breeder2`)의 모든 행이 지워졌다. 운영(`bredy`)은 영향이 없었다. |
| 직접 원인 | 에이전트가 손으로 쓴 마이그레이션 SQL 을 확인하려고 `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <.env 의 DIRECT_URL>` 를 실행했다. Prisma 는 shadow DB 를 **비운 뒤** 마이그레이션을 처음부터 다시 적용하므로, shadow 자리에 넣은 dev DB 가 비워졌다. |
| 복구 | 백업이 없어 운영 데이터를 dev 로 복사했다(사용자 결정). 그래서 dev 에 운영 개인정보 사본이 있다. |

근본 원인(재발 조건):
1. **안전한 shadow DB 가 없었다.** 로컬 Postgres 도 Docker 도 없어서, 손에 있던 유일한 DB 주소인 공유 dev DB 를 넣었다.
2. **`migrate diff` 를 읽기 전용 비교 도구로 잘못 알았다.** `--from-migrations` 는 shadow DB 를 초기화한다.
3. **로컬 `.env` 에 쓰기 권한이 있는 공유 DB 주소가 있다.** 운영 주소도 주석으로 남아 있다(주석만 풀면 모든 스크립트가 운영을 향한다).
4. **막는 장치가 없었다.** 에이전트 훅도, 빌드 검사도 없었다.
5. **백업이 없었다.** 두 프로젝트 모두 Free 플랜이다. Free 는 Supabase 백업을 내려받거나 복원할 수 없다.
6. (함께 발견) **Vercel 빌드 명령이 모든 빌드에서 `prisma migrate deploy` 를 돌린다.**
   - 모든 브랜치의 프리뷰 빌드는 공유 dev DB 에, main 빌드는 운영 DB 에 적용한다.
   - 이 명령은 저장소가 아니라 대시보드에만 있었다.
   - 그래서 `DROP` 이 든 마이그레이션은 **푸시만 해도** dev 데이터를 지운다.

## 2. 방어 장치(겹겹이)

| 층 | 장치 | 막는 것 |
|---|---|---|
| 에이전트 | Claude Code PreToolUse 훅 `.claude/hooks/db-guard.py`(전역 `~/.claude` + 두 저장소 사본). 대상: Bash, 파일 쓰기, Desktop Commander, Paseo 터미널, Vercel MCP | 초기화 명령, 실제 DB 를 shadow 로 쓰는 diff, 시드 reset, `DROP`/`TRUNCATE`/WHERE 없는 `DELETE`·`UPDATE`, 조건 없는 `deleteMany`/`updateMany`, 백업 폴더 삭제는 **거부**한다. 복원·시드·`prisma studio`·운영 주소·psql 쓰기·Vercel 설정 변경은 **확인**을 받는다. 테스트: `python3 .claude/hooks/db-guard_test.py` |
| 저장소 | `scripts/check-migration-safety.mjs` | 데이터를 지우거나 덮어쓰는 마이그레이션에 `-- bredy:allow-destructive <이유>` 표시가 없으면 실패한다. 이미 나간 마이그레이션은 `scripts/migration-safety-legacy.json` 에 둔다. |
| 빌드 | `vercel.json` `buildCommand` → `npm run vercel-build` | 위 검사를 통과해야 `migrate deploy` 가 돈다. 빌드 명령을 대시보드가 아니라 git 으로 관리한다. |
| CI | `.github/workflows/db-safety.yml` | PR 마다 파괴적 마이그레이션 표시, 마이그레이션 ↔ schema 일치(러너 안 임시 Postgres), 훅 테스트를 돌린다. |
| 로컬 도구 | `npm run db:check-migrations` | 실행마다 소켓만 여는 임시 Postgres 를 shadow 로 쓴다. 예전 차이는 `scripts/migration-drift-baseline.sql` 에 두고 새 차이만 실패로 본다. |
| 규칙 | 두 저장소 `AGENTS.md` 'DB 안전 규칙', Codex `~/.codex/AGENTS.md` | 훅이 없는 도구(Codex 등)에도 같은 규칙을 적용한다. |
| 백업 | 아래 3장 | 위가 모두 뚫려도 되살린다. |

남은 위험(사람이 지킨다):
- Supabase 대시보드에서 직접 지우는 일
- 관리자 API 로 하나씩 지우는 일(Prisma 가 흉내 내는 cascade 로 번진다)
- 훅이 없는 다른 에이전트

## 3. 백업 계획

### 3.1 목표
- **RPO(잃어도 되는 최대 시간) 24시간**: 매일 1회 백업한다.
- **RTO(복구 시간) 1시간**: 복원 절차를 문서로 두고 매달 연습한다.
- 백업은 **Supabase 밖**에 둔다. 프로젝트가 지워지거나 계정이 막혀도 남아야 한다.

### 3.2 층

| 층 | 방식 | 주기 · 보관 | 비용 | 상태 |
|---|---|---|---|---|
| A. 자동 일간 백업 | 비공개 저장소 `ytw418/bredy-db-backups` 의 GitHub Actions 가 운영 DB 를 읽기 전용 역할로 `pg_dump` 한다. 복원 검사를 하고 age 로 암호화해 artifact 로 보관한다. | 매일 03:00 KST. 일간 35일, 일요일 것은 90일 | 0원(GitHub Free 비공개 저장소: Actions 2,000분/월·artifact 500MB 안. 하루 약 3분, 보관 약 15MB) | **켜짐**(2026-10-08 사용자 승인, 첫 실행·복원 연습 통과) |
| B. 수동 스냅샷 | `npm run db:backup -- prod` → `~/bredy-backups/prod/*.dump`(권한 600) + `npm run db:restore-check -- <덤프>` | 운영 배포·파괴적 마이그레이션·데이터 이전 **직전마다** | 0원 | 사용 가능. 2026-10-08 첫 백업 완료(256KB, 43테이블, 복원 검사 통과) |
| C. Supabase 관리형 백업 | 조직을 Pro 로 올리면 매일 자동 백업이 생기고 7일 보관한다. 대시보드 Database → Backups 에서 클릭으로 복원한다. PITR(초 단위 복원)은 +$100/월 이고 Small 컴퓨트 이상이 필요하다. | 매일 · 7일 | $25/월 + 프로젝트 컴퓨트 | **사용자 결정**. 사용자가 늘면 켠다. |

dev DB 는 운영 사본이라 따로 매일 백업하지 않는다. 운영 백업에서 언제든 다시 만들 수 있다. 필요하면 `npm run db:backup -- dev` 를 쓴다.

### 3.3 보안
- 덤프에는 개인정보(이메일·채팅 등)가 있다.
  - 공개 저장소(breeder_web)에는 **어떤 형태로도** 올리지 않는다.
  - 자동 백업은 비공개 저장소에 **age 공개키로 암호화한 파일만** 둔다.
- 복호화 개인키는 대표가 비밀번호 관리자 + 오프라인 사본으로 보관한다. GitHub·Vercel·저장소에는 두지 않는다.
- 백업용 DB 계정은 **읽기 전용 역할 `backup_reader`** 다. 운영에 쓰기 권한이 있는 비밀번호는 Vercel 환경변수에만 둔다.
  - 로컬 `~/.config/bredy-backup/prod.url` 은 `backup_reader` 주소다(2026-10-08 교체).
  - 로컬 `.env` 의 운영 주석 줄은 지운다(운영 비밀번호 교체 때 함께).
- 탈퇴한 사용자 데이터는 백업 보관 기간(최대 90일)이 지나면 사라진다. 개인정보 처리방침의 보관 기간과 맞춘다.

### 3.4 자동 백업 구성(2026-10-08 켬)
- **저장소**: 비공개 `ytw418/bredy-db-backups`
  - 워크플로: `.github/workflows/backup.yml`
  - 스크립트: `scripts/db-backup.sh`·`db-restore-check.sh`. 이 저장소 scripts 의 사본이다. 비밀값을 공개 저장소 코드에 넘기지 않으려고 복사해 둔다. 원본을 고치면 사본도 맞춘다.
- **순서**(러너 안): PostgreSQL 17·age 설치 → `backup_reader` 로 덤프 → 임시 Postgres 복원 검사 → age 암호화(평문 삭제) → artifact 업로드
- **읽기 전용 역할 `backup_reader`**(운영)
  - 권한: public 스키마 SELECT. 이후 생기는 테이블·시퀀스도 SELECT 가 자동으로 붙는다(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres`).
  - 쓰기 권한은 없다. `has_table_privilege` 로 확인했다.
  - 접속: 세션 풀러(5432), 사용자 이름 `backup_reader.<project ref>`. GitHub 러너는 IPv6 직접 접속이 안 돼서 풀러를 쓴다.
  - 비밀번호를 바꿀 때: 운영에서 `ALTER ROLE backup_reader PASSWORD …` → 저장소 비밀값과 로컬 `prod.url` 을 함께 갱신한다.
- **GitHub 설정**: 비밀값 `PROD_BACKUP_DATABASE_URL`(backup_reader 주소), 변수 `AGE_RECIPIENT`(age 공개키 `age1dkp2a69ke2frvx75v0v7p4auylm8smxnn0lfgm0qkq3ruv9ulyhqj5znxs`)
- **개인키**
  - 지금 위치: `~/.config/bredy-backup/age-key.txt`(600)
  - 대표가 비밀번호 관리자에 옮기고 오프라인 사본을 만든 뒤 로컬 파일을 정리한다.
  - **개인키를 잃으면 자동 백업을 하나도 열 수 없다.**
- **첫 실행**: 2026-10-08 수동 실행이 성공했다(run 37796707408). artifact 를 내려받아 복호화하고 복원 검사까지 통과했다(User 80·Post 105).

- 실패하면 GitHub 가 워크플로를 마지막으로 바꾼 사람에게 메일을 보낸다.
- 90일보다 오래 보관하려면 월 1회 artifact 를 Cloudflare R2 같은 곳으로 옮긴다(후속 결정).

### 3.5 운영에 위험한 변경을 하기 전(매번)
1. `npm run db:backup -- prod`
2. `npm run db:restore-check -- ~/bredy-backups/prod/<방금 파일>.dump` 가 통과한다.
3. 파괴적 마이그레이션이면 사용자 확인을 받고, `-- bredy:allow-destructive <이유>` 를 적고, 영향 행 수를 SELECT 로 먼저 센다.
4. dev → main 배포.

### 3.6 복원(사고 때 — 사용자 결정 후에만)
1. 범위를 정한다.
   - **일부 행·테이블**: 덤프를 임시 Postgres 에 풀고(`db-restore-check.sh` 와 같은 방식), 필요한 행만 SQL 로 옮긴다. 가장 안전하다.
   - **DB 전체**: 새 Supabase 프로젝트에 복원한 뒤 Vercel `DATABASE_URL`/`DIRECT_URL` 을 바꾼다. 기존 DB 는 조사용으로 남긴다.
2. 자동 백업 파일을 쓸 때
   - 내려받기: `gh run download <run-id> -R ytw418/bredy-db-backups`
   - 복호화: `age -d -i <개인키> -o x.dump x.dump.age`
   - 확인: `scripts/db-restore-check.sh x.dump`
3. 새 프로젝트에 복원한다: `pg_restore --no-owner --no-privileges --dbname=<새 프로젝트 세션 풀러 주소> x.dump`
   - 훅이 확인을 요청한다.
   - 기존 DB 에 덮어쓰지 않는다.
4. `npx prisma migrate status` 로 기록을 맞추고, 앱으로 로그인·목록·채팅을 확인한다.
5. 매달 첫 주에 2번만(내려받기 → 복호화 → 복원 검사) 연습한다.
